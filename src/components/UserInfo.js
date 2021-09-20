import { AmplifySignOut } from '@aws-amplify/ui-react'
import React from 'react'

function UserInfo({ email }) {
  return (
    <div>
      <p className="italic text-gray-500 mb-3">Signed in as {email}</p>
      <div className="w-20">
        <AmplifySignOut />
      </div>
    </div>
  )
}

export default UserInfo
