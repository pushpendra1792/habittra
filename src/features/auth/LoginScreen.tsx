/**
 * Sign in with email and password, or with Google.
 *
 * Copy is short on purpose: the screen has a job, and a paragraph of explanation
 * is what makes a sign-in form feel slow.
 *
 * Nothing here reads the Supabase client. It calls the provider, which is the only
 * place a session is created or read.
 */
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormMessage } from '@/features/auth/FormMessage'
import { AuthDivider, GoogleButton } from '@/features/auth/GoogleButton'
import { googleAuthEnabled } from '@/features/auth/googleAuth'
import { NOT_CONFIGURED_MESSAGE } from '@/features/auth/notConfigured'
import { redirectTarget } from '@/features/auth/redirects'
import { isValid, validateSignIn, type FieldErrors } from '@/features/auth/validation'
import { useAuth } from '@/hooks/useAuth'
import { authErrorMessage } from '@/lib/api/errors'

/** Read once: it is a build-time variable, so it cannot change while the app runs. */
const googleEnabled = googleAuthEnabled()

export function LoginScreen() {
  const { status, signInWithPassword, signInWithGoogle } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [emailError, setEmailError] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)

  const unconfigured = status === 'unconfigured'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateSignIn({ email, password })

    setFieldErrors(errors)
    setEmailError(null)

    if (!isValid(errors)) {
      return
    }

    // The button stays enabled when Supabase is not set up, so the form still
    // checks itself and the message below still explains why nothing will happen.
    // Only the request is withheld. A disabled button would make the whole form
    // look broken and would give the person nothing to act on.
    if (unconfigured) {
      return
    }

    setBusy('email')

    try {
      // No navigation here. The session event lands on its own and the gate lets
      // the user through, so navigating as well would race it.
      await signInWithPassword({ email, password })
    } catch (thrown) {
      setEmailError(authErrorMessage(thrown, 'Could not sign you in.'))
      setBusy(null)
    }
  }

  async function continueWithGoogle() {
    setGoogleError(null)

    if (unconfigured) {
      return
    }

    setBusy('google')

    try {
      // On success the browser leaves for Google and never comes back to this
      // component, so there is deliberately nothing to do afterwards.
      await signInWithGoogle()
    } catch (thrown) {
      setGoogleError(authErrorMessage(thrown, 'Could not start Google sign-in.'))
      setBusy(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submit(event)
  }

  // Already signed in while sitting on /login. This is what a Google round trip
  // lands on, and what happens after signing in and coming back to this URL.
  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          disabled={busy !== null}
          onChange={(event) => {
            setEmail(event.target.value)
          }}
          {...(fieldErrors['email'] !== undefined ? { error: fieldErrors['email'] } : {})}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            disabled={busy !== null}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            {...(fieldErrors['password'] !== undefined ? { error: fieldErrors['password'] } : {})}
          />

          <Link
            to="/reset-password"
            className="self-start text-xs text-accent-teal underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {unconfigured ? (
          <FormMessage message={NOT_CONFIGURED_MESSAGE} />
        ) : (
          <FormMessage message={emailError} />
        )}

        <Button type="submit" size="lg" loading={busy === 'email'}>
          Sign in
        </Button>
      </form>

      {googleEnabled ? (
        <div className="flex flex-col gap-4">
          <AuthDivider />

          <GoogleButton
            onClick={() => {
              void continueWithGoogle()
            }}
            loading={busy === 'google'}
            disabled={busy !== null}
          />

          {unconfigured ? (
            <FormMessage message={NOT_CONFIGURED_MESSAGE} />
          ) : (
            <FormMessage message={googleError} />
          )}
        </div>
      ) : null}

      <p className="text-sm text-text-muted-on-dark">
        New here?{' '}
        <Link to="/signup" className="text-accent-teal underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
