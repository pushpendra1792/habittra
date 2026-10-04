/**
 * Create an account with an email and a password.
 *
 * The name field is not decoration: it becomes profiles.display_name through the
 * signup trigger, so it is the first thing the user sees on their own account
 * later. It is therefore required here rather than being left blank and
 * defaulted.
 */
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormMessage } from '@/features/auth/FormMessage'
import { AuthDivider, GoogleButton } from '@/features/auth/GoogleButton'
import { googleAuthEnabled } from '@/features/auth/googleAuth'
import { redirectTarget } from '@/features/auth/redirects'
import { isValid, validateSignUp, type FieldErrors } from '@/features/auth/validation'
import { useAuth } from '@/hooks/useAuth'
import { authErrorMessage } from '@/lib/api/errors'

const googleEnabled = googleAuthEnabled()

const NOT_CONFIGURED = 'Supabase is not set up. See SETUP_SUPABASE.md.'

export function SignupScreen() {
  const { status, signUpWithPassword, signInWithGoogle } = useAuth()
  const location = useLocation()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [emailError, setEmailError] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [sent, setSent] = useState(false)

  const unconfigured = status === 'unconfigured'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateSignUp({ displayName, email, password })

    setFieldErrors(errors)
    setEmailError(null)

    if (!isValid(errors)) {
      return
    }

    setBusy('email')

    try {
      await signUpWithPassword({ displayName, email, password })

      // Supabase either signs the user in straight away or sends a confirmation
      // email, depending on whether the project has confirmations on. There is no
      // way to tell from here which happened, and no useful screen either way, so
      // the form is replaced by a single line that is true in both cases.
      setSent(true)
      setBusy(null)
    } catch (thrown) {
      setEmailError(authErrorMessage(thrown, 'Could not create your account.'))
      setBusy(null)
    }
  }

  async function continueWithGoogle() {
    setGoogleError(null)
    setBusy('google')

    try {
      await signInWithGoogle()
    } catch (thrown) {
      setGoogleError(authErrorMessage(thrown, 'Could not start Google sign-up.'))
      setBusy(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submit(event)
  }

  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="If that address needs confirming, the link is on its way."
      >
        <p className="text-sm text-text-muted-on-dark">
          Nothing arriving? The account may already exist.{' '}
          <Link to="/login" className="text-accent-teal underline-offset-4 hover:underline">
            Sign in instead
          </Link>
          .
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start with the habits that matter to you.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Name"
          name="displayName"
          autoComplete="name"
          value={displayName}
          disabled={busy !== null}
          onChange={(event) => {
            setDisplayName(event.target.value)
          }}
          {...(fieldErrors['displayName'] !== undefined
            ? { error: fieldErrors['displayName'] }
            : {})}
        />

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

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="At least 6 characters."
          disabled={busy !== null}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
          {...(fieldErrors['password'] !== undefined ? { error: fieldErrors['password'] } : {})}
        />

        {unconfigured ? (
          <FormMessage message={NOT_CONFIGURED} />
        ) : (
          <FormMessage message={emailError} />
        )}

        <Button type="submit" size="lg" loading={busy === 'email'} disabled={unconfigured}>
          Create account
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
            disabled={busy === 'email' || unconfigured}
          />

          {unconfigured ? (
            <FormMessage message={NOT_CONFIGURED} />
          ) : (
            <FormMessage message={googleError} />
          )}
        </div>
      ) : null}

      <p className="text-sm text-text-muted-on-dark">
        Already have an account?{' '}
        <Link to="/login" className="text-accent-teal underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
