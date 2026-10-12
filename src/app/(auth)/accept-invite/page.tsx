'use client'

import { useEffect, useState } from 'react'
import { completeInviteSetup } from './actions'

export default function AcceptInvitePage() {
  const [tokens, setTokens] = useState<{ access: string; refresh: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const type = params.get('type')
    const access = params.get('access_token')
    const refresh = params.get('refresh_token')

    if (type !== 'invite' || !access || !refresh) {
      window.location.replace('/login')
      return
    }

    // URL hash is only readable client-side, so it has to be synced from an effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens({ access, refresh })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tokens) return

    const form = new FormData(e.currentTarget)
    const firstName = (form.get('firstName') as string).trim()
    const lastName = (form.get('lastName') as string).trim()
    const password = form.get('password') as string
    const confirm = form.get('confirmPassword') as string

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    setError(null)

    const { error } = await completeInviteSetup({ tokens, firstName, lastName, password })

    if (error) {
      setError(error)
      setPending(false)
      return
    }

    window.location.replace('/dashboard')
  }

  if (!tokens) return null

  return (
    <form onSubmit={handleSubmit}>
      <h1>Accept Invitation</h1>
      <p>Set up your account to get started.</p>

      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}

      <div>
        <label htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" type="text" required />
      </div>

      <div>
        <label htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" type="text" required />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" minLength={8} required />
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Setting up account…' : 'Complete setup'}
      </button>
    </form>
  )
}

