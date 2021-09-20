import React from "react"

function Theatre({ theatre }) {
  return (
    <div className="border border-megaplex rounded my-3 p-2 flex justify-between items-center">
      <div>
        <p>{theatre.name}</p>
        <p className="text-gray-500 italic text-xs">
          {theatre.address1}
          <br />
          {theatre.address2}
        </p>
      </div>
      <div>
        <input type="checkbox" checked={false} />
      </div>
    </div>
  )
}

export default Theatre
