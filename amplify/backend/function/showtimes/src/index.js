/* Amplify Params - DO NOT EDIT
	API_MEGAPLEX_GRAPHQLAPIIDOUTPUT
	API_MEGAPLEX_THEATRESUBSCRIPTIONTABLE_ARN
	API_MEGAPLEX_THEATRESUBSCRIPTIONTABLE_NAME
	AUTH_MEGAPLEX51291C5B_USERPOOLID
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const AWS = require('aws-sdk')
const axios = require('axios')
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
const cognitoIdp = new AWS.CognitoIdentityServiceProvider()
const megaplexApi = axios.create({
  baseURL: 'https://apiv2.megaplextheatres.com/api/',
})

/**
 * Get new showtimes for a given theatre.
 *
 * Showtimes are cached in DynamoDB
 *
 * @param {*} theatreId
 * @returns {array} showtimes
 */
const getTheatreShowtimes = async (theatreId) => {
  let showtimes = []
  let lastEvaluatedKey

  // Performs at least one ``DynamoDB.scan`` on the showtimes table and
  // continues to scan as long as the ``LastEvaluatedKey`` is not empty.
  do {
    // lookup
  } while (!!lastEvaluatedKey)

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
        LastEvaluatedKey: lastEvaluatedKey,
      })
      .promise()
    lastEvaluatedKey = data.lastEvaluatedKey
    subscriptions = [...subscriptions, ...data.Items]
  } while (!!lastEvaluatedKey)

  return subscriptions
}

/**
 * Get the email address for a given username.
 *
 * @param {*} username
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

    // Retrieve showtimes
    let showtimes
    try {
      // get showtimes
    } catch(err) {
      console.error('error retrieving showtimes for theatre:', theatre.id)
      console.error(err)
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

    // Get email addresses from Cognito
    const emails = await Promise.all(
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

    // TODO: either send emails inline, or add the email to an SQS queue
  }
}
