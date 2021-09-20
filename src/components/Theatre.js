import React from "react"
import classnames from "classnames"

function Theatre({ theatre, checked, disabled, onToggle }) {
  return (
    <div
      className={classnames(
        disabled && "opacity-25",
        "border border-megaplex rounded my-3 p-2 flex justify-between items-center"
      )}
    >
      <div>
        <p>{theatre.name}</p>
        <p className="text-gray-500 italic text-xs">
          {theatre.address1}
          <br />
          {theatre.address2}
        </p>
      </div>
      <div>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => onToggle(theatre.id)}
        />
      </div>
    </div>
  )
}

export default Theatre
