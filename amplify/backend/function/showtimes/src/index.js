/*
Use the following code to retrieve configured secrets from SSM:

const aws = require('aws-sdk');

const { Parameters } = await (new aws.SSM())
  .getParameters({
    Names: ["SMTP_USER","SMTP_PASSWORD"].map(secretName => process.env[secretName]),
    WithDecryption: true,
  })
  .promise();

Parameters will be of the form { Name: 'secretName', Value: 'secretValue', ... }[]
*/
/* Amplify Params - DO NOT EDIT
	API_MEGAPLEX_GRAPHQLAPIIDOUTPUT
	API_MEGAPLEX_THEATRESUBSCRIPTIONTABLE_ARN
	API_MEGAPLEX_THEATRESUBSCRIPTIONTABLE_NAME
	AUTH_MEGAPLEX51291C5B_USERPOOLID
	ENV
	REGION
	STORAGE_SHOWTIMES_ARN
	STORAGE_SHOWTIMES_NAME
	STORAGE_SHOWTIMES_STREAMARN
Amplify Params - DO NOT EDIT */

const AWS = require('aws-sdk')
const axios = require('axios')
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
const cognitoIdp = new AWS.CognitoIdentityServiceProvider()
const megaplexApi = axios.create({
  baseURL: 'https://apiv2.megaplextheatres.com/api/',
})
const oneDayInSeconds = 86_400

/**
 * Load SSM secrets. Only performed once at initial container load.
 *
 * To access a secret value after calling ``loadSecrets``:
 *
 *    process.env[process.env.SMTP_USER]
 */
const loadSecrets = async () => {
  // skip if we already loaded secrets
  if (process.env.__secretsLoaded) {
    return
  }

  // load secrets from SSM
  const { Parameters } = await new AWS.SSM()
    .getParameters({
      Names: ['SMTP_USER', 'SMTP_PASSWORD'].map(
        (secretName) => process.env[secretName]
      ),
      WithDecryption: true,
    })
    .promise()

  // set secrets in env
  Parameters.forEach((param) => {
    process.env[param.Name] = param.Value
  })

  // mark loaded complete
  process.env.__secretsLoaded = true
}

/**
 * Convert a date string to a UTC timestamp in seconds.
 *
 * We append `Z` to the end of the date string to keep the date in UTC.
 *
 * @param {string} dateString
 * @returns {integer} timestamp
 */
const toTimestamp = (dateString) => new Date(`${dateString}Z`).getTime() / 1000

/**
 * Determine if a showtime has luxury seats and is on a Tuesday.
 *
 * @param {object} showtime
 * @returns {boolean}
 */
const isLuxuryTuesdayShowtime = (showtime) =>
  showtime.allowTicketSales &&
  showtime.sessionAttributesNames.includes('Luxury') &&
  new Date(`${showtime.showtime}Z`).getDay() === 2

/**
 * Get new, luxury Tuesday showtimes for a given theatre.
 *
 * Showtimes are cached in DynamoDB once they've been processed so
 * subscribers only ever get one notification.
 *
 * @param {string} theatreId
 * @returns {array} showtimes
 */
const filterTheatreShowtimes = async (theatreId, allShowtimes) => {
  // Get cached showtimes from DynamoDB
  let cachedShowtimes = []
  let lastEvaluatedKey

  // Performs at least one ``DynamoDB.query`` on the showtimes table and
  // continues to scan as long as the ``LastEvaluatedKey`` is not empty.
  do {
    const data = await dynamodb
      .query({
        TableName: process.env.STORAGE_SHOWTIMES_NAME,
        KeyConditionExpression: 'cinemaId = :cinemaId',
        ExpressionAttributeValues: {
          ':cinemaId': theatreId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
      .promise()
    lastEvaluatedKey = data.LastEvaluatedKey
    cachedShowtimes = [...cachedShowtimes, ...data.Items]
  } while (!!lastEvaluatedKey)

  // Filter out showtimes that don't allow ticket sales
  let cachedShowtimeIds = cachedShowtimes.map((s) => s.sessionId)
  let showtimes = allShowtimes
    .filter(isLuxuryTuesdayShowtime)
    .filter((s) => !cachedShowtimeIds.includes(s.sessionId))

  // Add new showtimes to DynamoDB.
  // We can write a max of 25 items at a time.
  let batchSize = 25
  let batchStart = 0

  while (batchStart < showtimes.length) {
    // We can write a max of 25 items at a time
    await dynamodb
      .batchWrite({
        RequestItems: {
          [process.env.STORAGE_SHOWTIMES_NAME]: showtimes
            .slice(batchStart, batchStart + batchSize)
            .map((showtime) => ({
              PutRequest: {
                Item: {
                  cinemaId: showtime.cinemaId,
                  sessionId: showtime.sessionId,
                  expiration: toTimestamp(showtime.showtime) + oneDayInSeconds,
                },
              },
            })),
        },
      })
      .promise()
    batchStart += batchSize
  }

  return showtimes
}

/**
 * Get all subscriptions for a given theatre.
 *
 * @param {string} theatreId
 * @returns {array} subscriptions
 */
const getTheatreSubscriptions = async (theatreId) => {
  let subscriptions = []
  let lastEvaluatedKey

  // Performs at least one ``DynamoDB.scan`` on the subscriptions table
  // and continues to scan as long as the ``LastEvaluatedKey`` is not
  // empty.
  do {
    const data = await dynamodb
      .scan({
        TableName: process.env.API_MEGAPLEX_THEATRESUBSCRIPTIONTABLE_NAME,
        FilterExpression: 'theatre = :theatre',
        ExpressionAttributeValues: {
          ':theatre': theatreId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
      .promise()
    lastEvaluatedKey = data.LastEvaluatedKey
    subscriptions = [...subscriptions, ...data.Items]
  } while (!!lastEvaluatedKey)

  return subscriptions
}

/**
 * Get the email address for a given username.
 *
 * @param {string} username
 * @returns {string} email
 */
const getUserEmail = async (username) => {
  const data = await cognitoIdp
    .adminGetUser({
      UserPoolId: process.env.AUTH_MEGAPLEX51291C5B_USERPOOLID,
      Username: username,
    })
    .promise()
  const email = data.UserAttributes.find((attr) => attr.Name === 'email').Value
  const emailVerified = data.UserAttributes.find(
    (attr) => attr.Name === 'email_verified'
  ).Value

  if (!email) {
    throw Error('missing email')
  }

  if (emailVerified !== 'true') {
    throw Error('unverified email')
  }

  return email
}

/**
 * Check for new, luxury Tuesday showings at the given theatre.
 *
 * @param {object} theatre
 */
const processTheatre = async (theatre) => {
  // Retrieve films
  let films
  try {
    const { data } = await megaplexApi.get(`film/cinemaFilms/${theatre.id}`)
    films = data
  } catch (err) {
    console.error('error retrieving showtimes for theatre:', theatre.id)
    console.error(err)
    return
  }

  // Filter showtimes
  let showtimes
  let allShowtimes = films.reduce((all, film) => all.concat(film.sessions), [])
  try {
    showtimes = await filterTheatreShowtimes(theatre.id, allShowtimes)
  } catch (err) {
    console.error('error filtering showtimes for theatre:', theatre.id)
    console.error(err)
    return
  }

  // Only process further if we have new showtimes
  if (showtimes.length <= 0) {
    console.log('No new showtimes for theatre:', theatre.id)
    return
  }

  // Retrieve subscriptions
  let subscriptions
  try {
    subscriptions = await getTheatreSubscriptions(theatre.id)
  } catch (err) {
    console.error('error loading subscriptions for theatre:', theatre.id)
    console.error(err)
    return
  }

  if (subscriptions.length <= 0) {
    console.log('No subscriptions for theatre:', theatre.id)
    return
  }

  // Get email addresses from Cognito
  let emails = (
    await Promise.all(
      subscriptions.map(async ({ owner }) => {
        let email
        try {
          email = await getUserEmail(owner)
        } catch (err) {
          console.error('error retreiving email for user:', owner)
          console.error(err)
        }
        return email
      })
    )
  ).filter((email) => email)
  console.log(
    `Processing ${emails.length} subscription(s) for theatre:`,
    theatre.id
  )

  // Send email notifications
}

/**
 * Main function handler
 *
 * @param {object} event
 */
exports.handler = async (event) => {
  // load secrets
  await loadSecrets()
  console.log('process.env')
  console.log(JSON.stringify(process.env, null, 4))
  console.log('process.env.SMTP_USER', process.env[process.env.SMTP_USER])
  console.log('process.env.SMTP_PASSWORD', process.env[process.env.SMTP_PASSWORD])
  // load theatres
  const { data: theatres } = await megaplexApi.get('cinema/cinemas')
  // process theatre showtimes asynchronously
  await Promise.all(theatres.map(processTheatre))
}
