import { describe, expect, it, vi } from 'vitest'

import {
  authErrorMessage,
  databaseErrorMessage,
  isCheckinAlreadyRecorded,
  logAuthError,
} from '@/lib/api/errors'
import { CHECKINS_HABIT_DATE_CONSTRAINT } from '@/lib/api/constraints'

/** The shape GoTrue and PostgREST both put errors in. */
function error(message: string, extra: { code?: string | number; status?: number } = {}) {
  return { message, status: 400, ...extra }
}

/** A PostgREST unique violation, as the database words it. */
function uniqueViolation(constraint: string): { message: string; code: string } {
  return {
    code: '23505',
    message: `duplicate key value violates unique constraint "${constraint}"`,
  }
}

describe('authErrorMessage', () => {
  it('translates a wrong password into plain copy', () => {
    expect(authErrorMessage(error('Invalid login credentials'))).toBe(
      'That email and password do not match.',
    )
  })

  it('does not say which half of the login was wrong', () => {
    // Supabase returns the same message for an unknown email and a wrong
    // password. Saying more here would turn the login form into a way of finding
    // out which addresses have accounts.
    const message = authErrorMessage(error('Invalid login credentials'))

    expect(message).not.toMatch(/no account|not found|does not exist|unknown/i)
    expect(message).not.toMatch(/wrong password|password is incorrect/i)
  })

  it('translates a taken email into a pointer at signing in', () => {
    expect(authErrorMessage(error('User already registered'))).toBe(
      'That email already has an account. Try signing in.',
    )
  })

  it('translates an unconfirmed email', () => {
    expect(authErrorMessage(error('Email not confirmed'))).toBe(
      'Confirm your email first, then sign in.',
    )
  })

  it('translates the password length rule', () => {
    expect(authErrorMessage(error('Password should be at least 6 characters.'))).toBe(
      'Use at least 6 characters.',
    )
    expect(authErrorMessage(error('New password should be at least 6 characters.'))).toBe(
      'Use at least 6 characters.',
    )
  })

  it('translates a rejected password reuse', () => {
    expect(authErrorMessage(error('New password should be different from the old password.'))).toBe(
      'Choose a password you have not used here.',
    )
  })

  it('translates both spellings of a malformed address', () => {
    for (const message of [
      'Unable to validate email address: invalid format',
      'Unable to validate email address: email address must be a valid email address',
    ]) {
      expect(authErrorMessage(error(message))).toBe('That does not look like an email address.')
    }
  })

  it('translates a reset email that would not send', () => {
    expect(authErrorMessage(error('Error sending recovery email'))).toBe(
      'Could not send that email. Try again in a minute.',
    )
  })

  it('translates the rate limit codes, which arrive with no useful message', () => {
    expect(authErrorMessage(error('', { code: 'over_request_rate_limit' }))).toBe(
      'Too many attempts. Wait a minute, then try again.',
    )
    expect(authErrorMessage(error('', { code: 'over_email_send_rate_limit' }))).toBe(
      'Too many emails requested. Wait a minute, then try again.',
    )
  })

  it('translates an expired one-time link', () => {
    expect(authErrorMessage(error('', { code: 'otp_expired' }))).toBe(
      'That link has expired. Ask for a new one.',
    )
  })

  it('ignores the case of the message it is matching', () => {
    expect(authErrorMessage(error('INVALID LOGIN CREDENTIALS'))).toBe(
      'That email and password do not match.',
    )
  })

  it('tolerates surrounding whitespace', () => {
    expect(authErrorMessage(error('  Invalid login credentials  '))).toBe(
      'That email and password do not match.',
    )
  })

  it('names being offline rather than blaming the password', () => {
    expect(authErrorMessage(error('TypeError: Failed to fetch'))).toBe(
      'No connection. Check your network and try again.',
    )
    expect(authErrorMessage(error('NetworkError when attempting to fetch resource.'))).toBe(
      'No connection. Check your network and try again.',
    )
  })

  it('says Supabase is having trouble on a server error', () => {
    expect(authErrorMessage(error('Internal Server Error', { status: 500 }))).toBe(
      'Supabase is having trouble. Try again in a minute.',
    )
    expect(authErrorMessage(error('Bad Gateway', { status: 503 }))).toBe(
      'Supabase is having trouble. Try again in a minute.',
    )
  })

  it('falls back to the caller sentence for anything it does not know', () => {
    expect(authErrorMessage(error('Something new and unforeseen'), 'Could not sign you in.')).toBe(
      'Could not sign you in.',
    )
  })

  it('does not force-fit a known message onto a similar unknown one', () => {
    // A substring match would turn "Invalid login credentials for user X" and,
    // worse, any future message containing "email not confirmed" into confident
    // wrong copy.
    expect(authErrorMessage(error('Invalid login credentials, retry'), 'Try again.')).toBe(
      'Try again.',
    )
    expect(authErrorMessage(error('Email not confirmed by the mail server'), 'Try again.')).toBe(
      'Try again.',
    )
  })

  it('has a fallback of its own when the caller does not give one', () => {
    expect(authErrorMessage(error('anything'))).toBe('Something went wrong. Try again.')
  })

  it('survives values that are not errors at all', () => {
    for (const value of [undefined, null, 'a string', 42, {}, []]) {
      expect(authErrorMessage(value, 'Could not sign you in.')).toBe('Could not sign you in.')
    }
  })

  it('survives an error object with no message and no code', () => {
    expect(authErrorMessage({})).toBe('Something went wrong. Try again.')
  })

  it('never leaks the raw message for a known failure', () => {
    expect(authErrorMessage(error('Invalid login credentials'))).not.toContain('credentials')
  })
})

describe('databaseErrorMessage', () => {
  it('names a duplicate rather than quoting the constraint', () => {
    expect(databaseErrorMessage(uniqueViolation('habits_pkey'))).toBe('That is already saved.')
  })

  it('names a missing habit', () => {
    expect(
      databaseErrorMessage({
        code: '23503',
        message: 'insert or update on table "checkins" violates foreign key constraint',
      }),
    ).toBe('That habit no longer exists.')
  })

  it('names a rejected value', () => {
    expect(
      databaseErrorMessage({
        code: '23514',
        message: 'new row for relation "habits" violates check constraint "habits_name_check"',
      }),
    ).toBe('The habit name or goal was rejected.')
  })

  it('names a permissions failure', () => {
    expect(databaseErrorMessage({ code: '42501', message: 'permission denied' })).toBe(
      'You do not have access to that.',
    )
  })

  it('names a row that is no longer there', () => {
    expect(
      databaseErrorMessage({ code: 'PGRST116', message: 'JSON object requested, multiple rows' }),
    ).toBe('That is no longer there.')
  })

  it('names being offline', () => {
    expect(databaseErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'No connection. Check your network and try again.',
    )
  })

  it('says Supabase is having trouble on a server error', () => {
    expect(
      databaseErrorMessage({ code: '57014', message: 'canceling statement', status: 503 }),
    ).toBe('Supabase is having trouble. Try again in a minute.')
  })

  it('falls back to the caller sentence, not to the raw database message', () => {
    // A constraint name is useful in a log and useless on a phone.
    const result = databaseErrorMessage(
      uniqueViolation(CHECKINS_HABIT_DATE_CONSTRAINT),
      'Could not save that check-in.',
    )

    expect(result).toBe('That is already saved.')
  })

  it('survives values that are not errors at all', () => {
    expect(databaseErrorMessage(undefined, 'Could not load your habits.')).toBe(
      'Could not load your habits.',
    )
    expect(databaseErrorMessage(null, 'Could not load your habits.')).toBe(
      'Could not load your habits.',
    )
  })
})

describe('isCheckinAlreadyRecorded', () => {
  it('recognises the check-ins unique constraint', () => {
    expect(isCheckinAlreadyRecorded(uniqueViolation(CHECKINS_HABIT_DATE_CONSTRAINT))).toBe(true)
  })

  it('ignores a different unique constraint', () => {
    // A duplicate on any other constraint is a real failure, not a day that is
    // already checked in, and swallowing it would hide a bug.
    expect(isCheckinAlreadyRecorded(uniqueViolation('habits_pkey'))).toBe(false)
    expect(isCheckinAlreadyRecorded(uniqueViolation('profiles_pkey'))).toBe(false)
  })

  it('ignores other error codes that mention a constraint', () => {
    expect(
      isCheckinAlreadyRecorded({
        code: '23503',
        message: `violates foreign key constraint "${CHECKINS_HABIT_DATE_CONSTRAINT}"`,
      }),
    ).toBe(false)
  })

  it('ignores a violation with no constraint name', () => {
    expect(isCheckinAlreadyRecorded({ code: '23505', message: 'duplicate key value' })).toBe(false)
  })

  it('ignores values that are not errors', () => {
    for (const value of [undefined, null, 'string', {}]) {
      expect(isCheckinAlreadyRecorded(value)).toBe(false)
    }
  })
})

describe('logAuthError', () => {
  it('logs only the raw message, status and code in development', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logAuthError('sign in', {
      message: 'Invalid login credentials',
      status: 400,
      code: 'invalid_credentials',
      password: 'correct horse',
      access_token: 'secret-token',
    })

    expect(spy).toHaveBeenCalledWith('[auth] sign in failed', {
      message: 'Invalid login credentials',
      status: 400,
      code: 'invalid_credentials',
    })

    const logged = JSON.stringify(spy.mock.calls)

    expect(logged).not.toContain('correct horse')
    expect(logged).not.toContain('secret-token')
  })

  it('stays quiet outside development', () => {
    vi.stubEnv('DEV', false)

    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logAuthError('sign in', error('Invalid login credentials'))

    expect(spy).not.toHaveBeenCalled()

    vi.unstubAllEnvs()
  })

  it('has something to say when the error carries no message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logAuthError('sign up', undefined)

    expect(spy).toHaveBeenCalledWith('[auth] sign up failed', {
      message: 'Unknown auth error',
      status: undefined,
      code: undefined,
    })
  })
})
