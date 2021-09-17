/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getTheatreSubscription = /* GraphQL */ `
  query GetTheatreSubscription($id: ID!) {
    getTheatreSubscription(id: $id) {
      id
      theatre
      createdAt
      updatedAt
      owner
    }
  }
`;
export const listTheatreSubscriptions = /* GraphQL */ `
  query ListTheatreSubscriptions(
    $filter: ModelTheatreSubscriptionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTheatreSubscriptions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        theatre
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;
