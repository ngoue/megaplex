import { AuthState, onAuthUIStateChange } from '@aws-amplify/ui-components'
import {
  AmplifyAuthContainer,
  AmplifyAuthenticator,
  AmplifySignUp,
} from '@aws-amplify/ui-react'
import React from 'react'
import Subscriptions from './Subscriptions'
import UserInfo from './UserInfo'

function App() {
  const [authState, setAuthState] = React.useState()
  const [user, setUser] = React.useState()

  React.useEffect(
    () =>
      onAuthUIStateChange((nextAuthState, authData) => {
        setAuthState(nextAuthState)
        setUser(authData)
      }),
    []
  )

  return authState === AuthState.SignedIn && user ? (
    <div className="m-5 md:mx-auto md:flex md:flex-row">
      <div className="flex-1 md:max-w-lg">
        <img
          className="w-40 md:w-56 mb-5 mx-auto"
          src="https://ci5.googleusercontent.com/proxy/r4Ise0p15ywUz4Q4FVKDXEqOOECld_A6JjWaNsiT635Iz2aoB2gpyq9SlVvYHYjvMvVHPFFxd-OaTZoYbs412pL-WdgYXGy5cu2v7OzJtuGxvbJDBKH50khn_A=s0-d-e1-ft#http://cdn.lhm.megaplextheatres.com/mp/assets/MegaplexLogo_Purple_v2.png"
          alt="Megaplex Theatres logo"
        />
        <p className="md:text-2xl mb-5">
          Subscribe to a theatre to receive real-time notifications for Tuesday
          showtimes with luxury seating at Megaplex Theatres!
        </p>
        {/*
          Immediately after signup, the user object is different from
          the CognitoUser object that gets loaded later so we access the
          email a little differently
        */}
        <UserInfo
          email={!!user.attributes ? user.attributes.email : user.username}
        />
      </div>
      <div className="w-64 my-10 mx-auto border-2 border-yellow-400 md:w-0 md:my-0 md:mx-10" />
      <div className="flex-1">
        <Subscriptions />
      </div>
    </div>
  ) : (
    <AmplifyAuthContainer>
      <AmplifyAuthenticator usernameAlias="email">
        <AmplifySignUp
          slot="sign-up"
          usernameAlias="email"
          formFields={[{ type: 'email' }, { type: 'password' }]}
        />
      </AmplifyAuthenticator>
    </AmplifyAuthContainer>
  )
}

export default App
