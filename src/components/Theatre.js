import classnames from 'classnames'
import React from 'react'

function Theatre({ theatre, selected, disabled, onToggle }) {
  return (
    <button
      onClick={() => onToggle(theatre.id)}
      disabled={disabled}
      className={classnames(
        selected &&
          'bg-gradient-to-r from-megaplex to-pink-700 text-white border-opacity-0',
        'w-full text-left border border-gray-300 rounded my-3 p-2 flex justify-between items-center'
      )}
    >
      <div>
        <p className="font-semibold">{theatre.name}</p>
        <p
          className={classnames(
            selected ? 'text-gray-300' : 'text-gray-500',
            'italic text-xs'
          )}
        >
          {theatre.address1}
          <br />
          {theatre.address2}
        </p>
      </div>
    </button>
  )
}

export default Theatre
