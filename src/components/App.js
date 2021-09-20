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
    <div className="m-5 md:flex md:flex-row">
      <div className="flex-1">
        <img
          className="w-40 md:w-56 m-5 mx-auto"
          src="https://ci5.googleusercontent.com/proxy/r4Ise0p15ywUz4Q4FVKDXEqOOECld_A6JjWaNsiT635Iz2aoB2gpyq9SlVvYHYjvMvVHPFFxd-OaTZoYbs412pL-WdgYXGy5cu2v7OzJtuGxvbJDBKH50khn_A=s0-d-e1-ft#http://cdn.lhm.megaplextheatres.com/mp/assets/MegaplexLogo_Purple_v2.png"
          alt="Megaplex Theatres logo"
        />
        <p className="md:text-2xl mb-5">
          Subscribe to a theatre to receive real-time notifications for Tuesday
          showtimes with luxury seating at Megaplex Theatres!
        </p>
        <UserInfo email={user.attributes.email} />
      </div>
      <div className='flex-1'>
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
