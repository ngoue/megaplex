import React from "react"
import {
  AmplifyAuthContainer,
  AmplifyAuthenticator,
  AmplifySignUp,
  AmplifySignOut,
} from "@aws-amplify/ui-react"
import { AuthState, onAuthUIStateChange } from "@aws-amplify/ui-components"

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
    <div className="App">
      <AmplifySignOut />
      <h1>Welcome!</h1>
    </div>
  ) : (
    <AmplifyAuthContainer>
      <AmplifyAuthenticator usernameAlias="email">
        <AmplifySignUp
          slot="sign-up"
          usernameAlias="email"
          formFields={[{ type: "email" }, { type: "password" }]}
        />
      </AmplifyAuthenticator>
    </AmplifyAuthContainer>
  )
}

export default App
