/**
 * Reset a password, in two halves of one journey.
 *
 * Without a recovery session this screen asks for an email address and sends a
 * link. With one, it asks for the new password instead. The link Supabase sends
 * arrives at this same URL carrying a token, so the second half is this screen
 * with a different set of fields rather than a fourth route.
 *
 * Which half is which comes from the provider, not from the URL, so a token in
 * the address bar without a real session behind it cannot unlock the form.
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormMessage } from '@/features/auth/FormMessage'
import { NOT_CONFIGURED_MESSAGE } from '@/features/auth/notConfigured'
import {
  isValid,
  validateNewPassword,
  validateResetEmail,
  type FieldErrors,
} from '@/features/auth/validation'
import { useAuth } from '@/hooks/useAuth'
import { authErrorMessage } from '@/lib/api/errors'

export function ResetPasswordScreen() {
  const { status, isRecovery, sendPasswordResetEmail, updatePassword } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const unconfigured = status === 'unconfigured'

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateResetEmail({ email })

    setFieldErrors(errors)
    setFormError(null)

    if (!isValid(errors)) {
      return
    }

    // Enabled on purpose when Supabase is not set up: the form still checks
    // itself and the message below still says why nothing will happen. Only the
    // request is withheld.
    if (unconfigured) {
      return
    }

    setBusy(true)

    try {
      await sendPasswordResetEmail(email)
      setSent(true)
      setBusy(false)
    } catch (thrown) {
      setFormError(authErrorMessage(thrown, 'Could not send that email.'))
      setBusy(false)
    }
  }

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateNewPassword({ password, confirmPassword })

    setFieldErrors(errors)
    setFormError(null)

    if (!isValid(errors)) {
      return
    }

    if (unconfigured) {
      return
    }

    setBusy(true)

    try {
      // updateUser re-signs the user in, so there is a session to walk through
      // the gate with afterwards.
      await updatePassword(password)
      void navigate('/', { replace: true })
    } catch (thrown) {
      setFormError(authErrorMessage(thrown, 'Could not change your password.'))
      setBusy(false)
    }
  }

  function handleNewPassword(event: FormEvent<HTMLFormElement>) {
    void saveNewPassword(event)
  }

  function handleRequestLink(event: FormEvent<HTMLFormElement>) {
    void requestLink(event)
  }

  if (isRecovery) {
    return (
      <AuthLayout title="Choose a new password" subtitle="Then you are back in.">
        <form className="flex flex-col gap-4" onSubmit={handleNewPassword} noValidate>
          <Input
            label="New password"
            type="password"
            name="password"
            autoComplete="new-password"
            hint="At least 6 characters."
            disabled={busy}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            {...(fieldErrors['password'] !== undefined ? { error: fieldErrors['password'] } : {})}
          />

          <Input
            label="Repeat it"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            disabled={busy}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
            }}
            {...(fieldErrors['confirmPassword'] !== undefined
              ? { error: fieldErrors['confirmPassword'] }
              : {})}
          />

          {unconfigured ? (
            <FormMessage message={NOT_CONFIGURED_MESSAGE} />
          ) : (
            <FormMessage message={formError} />
          )}

          <Button type="submit" size="lg" loading={busy}>
            Save new password
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We will email you a link.">
      {sent ? (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-text-muted-on-dark">
            If that address has an account, the link is on its way. The link opens this page again,
            with the fields for a new password.
          </p>
          <p className="text-sm text-text-muted-on-dark">
            <Link to="/login" className="text-accent-teal underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleRequestLink} noValidate>
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={busy}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
            {...(fieldErrors['email'] !== undefined ? { error: fieldErrors['email'] } : {})}
          />

          {unconfigured ? (
            <FormMessage message={NOT_CONFIGURED_MESSAGE} />
          ) : (
            <FormMessage message={formError} />
          )}

          <Button type="submit" size="lg" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}

      <p className="text-sm text-text-muted-on-dark">
        Remembered it?{' '}
        <Link to="/login" className="text-accent-teal underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
