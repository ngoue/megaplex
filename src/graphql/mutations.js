/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createTheatreSubscription = /* GraphQL */ `
  mutation CreateTheatreSubscription(
    $input: CreateTheatreSubscriptionInput!
    $condition: ModelTheatreSubscriptionConditionInput
  ) {
    createTheatreSubscription(input: $input, condition: $condition) {
      id
      theatre
      createdAt
      updatedAt
      owner
    }
  }
`;
export const updateTheatreSubscription = /* GraphQL */ `
  mutation UpdateTheatreSubscription(
    $input: UpdateTheatreSubscriptionInput!
    $condition: ModelTheatreSubscriptionConditionInput
  ) {
    updateTheatreSubscription(input: $input, condition: $condition) {
      id
      theatre
      createdAt
      updatedAt
      owner
    }
  }
`;
export const deleteTheatreSubscription = /* GraphQL */ `
  mutation DeleteTheatreSubscription(
    $input: DeleteTheatreSubscriptionInput!
    $condition: ModelTheatreSubscriptionConditionInput
  ) {
    deleteTheatreSubscription(input: $input, condition: $condition) {
      id
      theatre
      createdAt
      updatedAt
      owner
    }
  }
`;
