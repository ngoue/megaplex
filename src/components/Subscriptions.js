import React from "react"
import Theatre from "./Theatre"
import theatres from "../theatres.json"
import { API, graphqlOperation } from "aws-amplify"
import {
  createTheatreSubscription,
  deleteTheatreSubscription,
} from "../graphql/mutations"
import { listTheatreSubscriptions } from "../graphql/queries"

function Subscriptions() {
  const [loading, setLoading] = React.useState(true)
  const [subscriptions, setSubscriptions] = React.useState([])

  React.useEffect(() => {
    const load = async () => {
      try {
        const subscriptionData = await API.graphql(
          graphqlOperation(listTheatreSubscriptions)
        )
        const _subscriptions =
          subscriptionData.data.listTheatreSubscriptions.items
        setSubscriptions(_subscriptions)
      } catch (err) {
        console.error("error loading subscriptions")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const toggleSubscription = async (theatreId) => {
    const subscription = subscriptions.find((s) => s.theatre === theatreId)
    if (!!subscription) {
      await API.graphql(
        graphqlOperation(deleteTheatreSubscription, {
          input: {
            id: subscription.id,
          }
        })
      )
      setSubscriptions((_subscriptions) =>
        _subscriptions.filter((s) => s.id !== subscription.id)
      )
    } else {
      const subscriptionData = await API.graphql(
        graphqlOperation(createTheatreSubscription, {
          input: {
            theatre: theatreId,
          },
        })
      )
      setSubscriptions((_subscriptions) => 
        [..._subscriptions, subscriptionData.data.createTheatreSubscription]
      )
    }
  }

  return (
    <>
      {theatres.map((theatre) => (
        <Theatre
          key={theatre.id}
          theatre={theatre}
          checked={!!subscriptions.find((s) => s.theatre === theatre.id)}
          disabled={loading}
          onToggle={toggleSubscription}
        />
      ))}
    </>
  )
}

export default Subscriptions
