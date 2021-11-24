/*
Use the following code to retrieve configured secrets from SSM:

const aws = require('aws-sdk');

const { Parameters } = await (new aws.SSM())
  .getParameters({
    Names: ["SENDGRID_API_KEY"].map(secretName => process.env[secretName]),
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

const AWS = require("aws-sdk")
const axios = require("axios")
const https = require("https")
const dateFormat = require("dateformat")
const sendgrid = require("@sendgrid/mail")
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" })
const cognitoIdp = new AWS.CognitoIdentityServiceProvider()
const oneDayInSeconds = 86_400
const ignoreSessionAttributes = ["2D", "CC", "DVS", "EnglishDub", "EnglishSub"]
const templateId = "d-008e503c9f4546ebaa6e9fd78aa683f4"
const megaplexApi = axios.create({
  baseURL: "https://apiv2.megaplextheatres.com/api/",
  // Disable SSL verification. Megaplex certs have caused issues in the
  // past for some reason (looks like browsers do a better job of
  // handling missing intermediate certs than Node does). Since we're
  // only retrieving information and not sending anything, we don't
  // care.
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
})

/**
 * Load SSM secrets. Only performed once at initial container load.
 *
 * To access a secret value after calling ``loadSecrets``:
 *
 *    process.env[process.env.SENDGRID_API_KEY]
 */
const loadSecrets = async () => {
  // skip if we already loaded secrets
  if (process.env.__secretsLoaded) {
    return
  }

  // load secrets from SSM
  const { Parameters } = await new AWS.SSM()
    .getParameters({
      Names: ["SENDGRID_API_KEY"].map((secretName) => process.env[secretName]),
      WithDecryption: true,
    })
    .promise()

  // set secrets in env
  Parameters.forEach((param) => {
    process.env[param.Name] = param.Value
  })

  // one-time initializations once secrets are loaded
  sendgrid.setApiKey(process.env[process.env.SENDGRID_API_KEY])

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
  showtime.sessionAttributesNames.includes("Luxury") &&
  new Date(`${showtime.showtime}Z`).getDay() === 2

/**
 * Get films with new, luxury Tuesday showtimes for a given theatre.
 *
 * Showtimes are cached in DynamoDB once they've been processed so
 * subscribers only ever get one notification.
 *
 * @param {string} theatreId
 * @returns {array} showtimes
 */
const getFilms = async (theatreId) => {
  // Get cached showtimes from DynamoDB
  let cachedShowtimes = []
  let lastEvaluatedKey

  // Performs at least one ``DynamoDB.query`` on the showtimes table and
  // continues to scan as long as the ``LastEvaluatedKey`` is not empty.
  do {
    const data = await dynamodb
      .query({
        TableName: process.env.STORAGE_SHOWTIMES_NAME,
        KeyConditionExpression: "cinemaId = :cinemaId",
        ExpressionAttributeValues: {
          ":cinemaId": theatreId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
      .promise()
    lastEvaluatedKey = data.LastEvaluatedKey
    cachedShowtimes = [...cachedShowtimes, ...data.Items]
  } while (!!lastEvaluatedKey)

  // Load films from Megaplex API
  let { data: films } = await megaplexApi.get(`film/cinemaFilms/${theatreId}`)

  // Filter and map film and session data by removing showings that are
  // not Luxury Tuesday showings or they've already been reported.
  let cachedShowtimeIds = cachedShowtimes.map((session) => session.sessionId)
  films = films
    .map((film) => ({
      ...film,
      sessions: film.sessions
        .filter(isLuxuryTuesdayShowtime)
        .filter((session) => !cachedShowtimeIds.includes(session.sessionId))
        .map((session) => ({
          ...session,
          prettyShowtime: dateFormat(
            new Date(`${session.showtime}Z`),
            "mmm. d – h:MM tt"
          ),
          sessionAttributesNames: session.sessionAttributesNames
            .filter((attr) => !ignoreSessionAttributes.includes(attr))
            .map((attr) => attr.toUpperCase())
            .join(" "),
        })),
    }))
    .filter((film) => film.sessions.length > 0)

  // Add new showtimes to DynamoDB.
  // We can write a max of 25 items at a time.
  let batchSize = 25
  let batchStart = 0
  let newShowtimes = films.reduce(
    (sessions, film) => [...sessions, ...film.sessions],
    []
  )

  while (batchStart < newShowtimes.length) {
    // We can write a max of 25 items at a time
    await dynamodb
      .batchWrite({
        RequestItems: {
          [process.env.STORAGE_SHOWTIMES_NAME]: newShowtimes
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

  return films
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
        FilterExpression: "theatre = :theatre",
        ExpressionAttributeValues: {
          ":theatre": theatreId,
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
  const email = data.UserAttributes.find((attr) => attr.Name === "email").Value
  const emailVerified = data.UserAttributes.find(
    (attr) => attr.Name === "email_verified"
  ).Value

  if (!email) {
    throw Error("missing email")
  }

  if (emailVerified !== "true") {
    throw Error("unverified email")
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
    films = await getFilms(theatre.id)
  } catch (err) {
    console.error("error retrieving showtimes for theatre:", theatre.id)
    console.error(err)
    return
  }

  // Only process further if we have new showtimes
  if (films.length <= 0) {
    console.log("No new showtimes for theatre:", theatre.id)
    return
  }

  // Retrieve subscriptions
  let subscriptions
  try {
    subscriptions = await getTheatreSubscriptions(theatre.id)
  } catch (err) {
    console.error("error loading subscriptions for theatre:", theatre.id)
    console.error(err)
    return
  }

  if (subscriptions.length <= 0) {
    console.log("No subscriptions for theatre:", theatre.id)
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
          console.error("error retreiving email for user:", owner)
          console.error(err)
        }
        return email
      })
    )
  ).filter((email) => email)

  // Send email notifications
  try {
    await sendgrid.sendMultiple({
      to: emails,
      from: "megaplex-updates@jordanthomasg.com",
      templateId,
      dynamicTemplateData: {
        unsubscribe: "https://megaplex.jordanthomasg.com",
        theatre,
        films,
      },
    })
    console.log(
      `${emails.length} notification(s) sent for theatre:`,
      theatre.id
    )
  } catch (err) {
    console.error("error sending notifications for theatre:", theatre.id)
    console.error(err)
  }
}

/**
 * Main function handler
 *
 * @param {object} event
 */
exports.handler = async (event) => {
  // load secrets
  await loadSecrets()
  // load theatres
  const { data: theatres } = await megaplexApi.get("cinema/cinemas")
  // process theatre showtimes asynchronously
  await Promise.all(theatres.map(processTheatre))
}
