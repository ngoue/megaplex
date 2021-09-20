import React from "react"
import Theatre from './Theatre'
import theatres from "../theatres.json"

function Subscriptions() {
  return (
    <>
      {theatres.map((theatre) => (
        <Theatre key={theatre.id} theatre={theatre} />
      ))}
    </>
  )
}

export default Subscriptions
