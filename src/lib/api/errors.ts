/**
 * Turning failures into something worth reading on a phone.
 *
 * Supabase errors are written for a developer: `Invalid login credentials`,
 * `duplicate key value violates unique constraint
 * "checkins_habit_id_date_key"`. A user needs "That email and password do not
 * match" and "You already checked in today".
 *
 * Every function here is pure and reads only `message`, `code` and `status` off
 * whatever it is given, so the whole mapping is testable without a network and
 * without constructing a real Supabase error.
 */
import { CHECKINS_HABIT_DATE_CONSTRAINT } from '@/lib/api/constraints'

/** The parts of a Supabase error these functions read. */
type ErrorFields = Record<string, unknown>

const FALLBACK = 'Something went wrong. Try again.'

/**
 * Reads the fields off an unknown value.
 *
 * Returns an empty object rather than null for anything unrecognisable, so the
 * callers can stay a single lookup each instead of a null check per field. A
 * string, a number or a thrown bare `undefined` all reach here as no fields, and
 * the caller falls through to its own sentence.
 *
 * Fields are read with brackets because the object is untyped, and dot access on
 * an index signature is not allowed in this repo.
 */
function fieldsOf(error: unknown): ErrorFields {
  return typeof error === 'object' && error !== null ? (error as ErrorFields) : {}
}

/** Lowercased message, or '' when there is not one. */
function messageOf(error: unknown): string {
  const message = fieldsOf(error)['message']

  return typeof message === 'string' ? message.trim().toLowerCase() : ''
}

/** The error code as a string, or '' when there is not one. */
function codeOf(error: unknown): string {
  const code = fieldsOf(error)['code']

  return typeof code === 'string' ? code : typeof code === 'number' ? String(code) : ''
}

function statusOf(error: unknown): number {
  const status = fieldsOf(error)['status']

  return typeof status === 'number' ? status : 0
}

/**
 * True for the way a failed fetch shows up.
 *
 * Matched on the message and nothing else. A value with no status and no message
 * is not evidence of anything, and guessing "offline" from it would replace a
 * real error with a network warning about a network that is fine.
 */
function looksOffline(error: unknown): boolean {
  const message = messageOf(error)

  return message.includes('failed to fetch') || message.includes('networkerror')
}

/**
 * Auth failures, keyed by the lowercased message Supabase sends.
 *
 * Keyed on the message rather than on `code` because GoTrue reports almost
 * everything as a message: `status` is 400 for a bad password, a malformed
 * address and a taken email alike, and there is no stable code to match on. The
 * lookup is exact rather than a substring so an unfamiliar message falls
 * through to the caller's fallback instead of being force-fit.
 */
const AUTH_MESSAGES: Readonly<Record<string, string>> = {
  'invalid login credentials': 'That email and password do not match.',
  'user already registered': 'That email already has an account. Try signing in.',
  'email not confirmed': 'Confirm your email first, then sign in.',
  'password should be at least 6 characters.': 'Use at least 6 characters.',
  'new password should be at least 6 characters.': 'Use at least 6 characters.',
  'new password should be different from the old password.':
    'Choose a password you have not used here.',
  'unable to validate email address: invalid format': 'That does not look like an email address.',
  'unable to validate email address: email address must be a valid email address':
    'That does not look like an email address.',
  'error sending recovery email': 'Could not send that email. Try again in a minute.',
  'email address not enabled': 'Confirm your email first, then sign in.',
}

/** Codes GoTrue uses for throttling, which arrive as a code with no message. */
const AUTH_CODES: Readonly<Record<string, string>> = {
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  over_email_send_rate_limit: 'Too many emails requested. Wait a minute, then try again.',
  otp_expired: 'That link has expired. Ask for a new one.',
}

/** Postgres error codes worth naming, for anything that reaches the database. */
const DATABASE_CODES: Readonly<Record<string, string>> = {
  '23505': 'That is already saved.',
  '23503': 'That habit no longer exists.',
  '23514': 'The habit name or goal was rejected.',
  '42501': 'You do not have access to that.',
  PGRST116: 'That is no longer there.',
}

/**
 * Logs the raw auth failure fields in development.
 *
 * The screens keep showing the short, mapped copy from `authErrorMessage`. This
 * is the other half: the message, status and code Supabase actually sent, which
 * is what makes a failed auth call diagnosable. Passwords and tokens are never
 * part of a thrown auth error, and only these three fields are read, so nothing
 * sensitive reaches the console.
 */
export function logAuthError(context: string, error: unknown): void {
  if (!import.meta.env.DEV) {
    return
  }

  const fields = fieldsOf(error)
  const message = typeof fields['message'] === 'string' ? fields['message'] : 'Unknown auth error'
  const status = typeof fields['status'] === 'number' ? fields['status'] : undefined
  const code = typeof fields['code'] === 'string' ? fields['code'] : undefined

  console.error(`[auth] ${context} failed`, { message, status, code })
}

/**
 * Copy for a failed auth call.
 *
 * `fallback` is what the screen wants to say when it recognises nothing better,
 * so each caller sets something true of its own situation: "Could not sign you
 * in." rather than one shared sentence everywhere.
 */
export function authErrorMessage(error: unknown, fallback: string = FALLBACK): string {
  if (looksOffline(error)) {
    return 'No connection. Check your network and try again.'
  }

  const byCode = AUTH_CODES[codeOf(error)]

  if (byCode !== undefined) {
    return byCode
  }

  const byMessage = AUTH_MESSAGES[messageOf(error)]

  if (byMessage !== undefined) {
    return byMessage
  }

  if (statusOf(error) >= 500) {
    return 'Supabase is having trouble. Try again in a minute.'
  }

  return fallback
}

/**
 * Copy for a failed query or write.
 *
 * Falls back to the raw message for anything unmapped that carries one, because
 * a Postgres check violation names the constraint and that is more use to
 * somebody reading a log than a generic sentence is. It is never shown to a
 * user: callers pass their own `fallback`, which is what reaches the screen.
 */
export function databaseErrorMessage(error: unknown, fallback: string = FALLBACK): string {
  if (looksOffline(error)) {
    return 'No connection. Check your network and try again.'
  }

  const byCode = DATABASE_CODES[codeOf(error)]

  if (byCode !== undefined) {
    return byCode
  }

  if (statusOf(error) >= 500) {
    return 'Supabase is having trouble. Try again in a minute.'
  }

  return fallback
}

/**
 * True when the write failed only because the check-in already exists.
 *
 * Narrow on purpose: the unique constraint names both the table and the two
 * columns, so this cannot be confused with a duplicate habit name or a
 * different unique violation. `checkIn` uses it to treat "already recorded" as
 * success, which is what makes the call safe to fire twice from two devices.
 */
export function isCheckinAlreadyRecorded(error: unknown): boolean {
  return codeOf(error) === '23505' && messageOf(error).includes(CHECKINS_HABIT_DATE_CONSTRAINT)
}
