'use client'

import { useActionState, useEffect, useState } from 'react'
import { signIn, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState)
  const [hashError, setHashError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    if (params.get('type') === 'invite') {
      window.location.replace('/accept-invite' + window.location.hash)
      return
    }
    if (params.get('error') === 'access_denied') {
      // URL hash is only readable client-side, so it has to be synced from an effect
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHashError('This invitation link has expired or is no longer valid. Please contact your administrator to request a new invitation.')
      return
    }
    if (new URLSearchParams(window.location.search).get('reason') === 'session_expired') {
      setNotice('Your session has expired for security reasons. Please sign in again to continue.')
    }
  }, [])

  return (
    <form action={action}>
      {notice && !state.error && !hashError && <p role="status">{notice}</p>}
      {(state.error || hashError) && <p role="alert">{hashError ?? state.error}</p>}

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
