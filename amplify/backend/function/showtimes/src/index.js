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

  // Add new showtimes to DynamoDB
  await dynamodb.batchWrite({
    RequestItems: {
      [process.env.STORAGE_SHOWTIMES_NAME]: showtimes.map((showtime) => ({
        PutRequest: {
          Item: {
            cinemaId: theatreId,
            sessionId: showtime.id,
            expiration: (toTimestamp(showtime.showtime) + oneDayInSeconds),
          },
        },
      })),
    },
  })
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
 * Main function handler
 *
 * @param {object} event
 */
exports.handler = async (event) => {
  const { data: theatres } = await megaplexApi.get('cinema/cinemas')

  for (let theatre of theatres) {
    // Retrieve films
    let films
    try {
      const data = await megaplexApi.get(`film/cinemaFilms/${theatre.id}`)
      films = data.films
    } catch (err) {
      console.error('error retrieving showtimes for theatre:', theatre.id)
      console.error(err)
    }

    // Filter showtimes
    let showtimes
    let allShowtimes = films.reduce(
      (all, film) => all.concat(film.sessions),
      []
    )
    try {
      showtimes = await filterTheatreShowtimes(theatre.id, allShowtimes)
    } catch (err) {
      console.error('error filtering showtimes for theatre:', theatre.id)
      console.error(err)
    }

    // Only process further if we have new showtimes
    if (showtimes.length <= 0) {
      console.log('No new showtimes for theatre:', theatre.id)
      continue
    }

    // Retrieve subscriptions
    let subscriptions
    try {
      subscriptions = await getTheatreSubscriptions(theatre.id)
    } catch (err) {
      console.error('error loading subscriptions for theatre:', theatre.id)
      console.error(err)
      continue
    }

    if (subscriptions.length <= 0) {
      console.log('No subscriptions for theatre:', theatre.id)
      continue
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

    // TODO: either send emails inline, or add the email to an SQS queue
    // use Handlebars (based on Mustache) for templating?
  }
}
