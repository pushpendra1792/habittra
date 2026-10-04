/**
 * What the auth forms check before they make a request.
 *
 * Small on purpose. The database and Supabase enforce the real rules, and these
 * checks exist so an obviously wrong form does not turn into a round trip and a
 * message about a password. Anything not caught here is caught by the server and
 * shown through `authErrorMessage`.
 *
 * Pure functions over plain objects, so the rules can be tested without a form
 * and without a network.
 */

/** The shortest password Supabase accepts. Matches the server, not a preference. */
export const MIN_PASSWORD_LENGTH = 6

/**
 * Errors keyed by field name. An absent key means the field is fine.
 *
 * Deliberately loose as a type: it is a map from a field to a sentence, and
 * spelling out a four-key union would mean every form had to carry fields it does
 * not have.
 */
export type FieldErrors = Readonly<Record<string, string>>

/** True when nothing is wrong. */
export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0
}

/**
 * A deliberate, forgiving shape check.
 *
 * Not an attempt to implement RFC 5322. It catches a missing `@` and a missing
 * domain, which is what a person typing on a phone actually gets wrong, and lets
 * everything else through to the server, which is the only thing that can tell an
 * address really exists.
 */
function emailProblem(value: string): string | undefined {
  const email = value.trim()

  if (email === '') {
    return 'Enter your email.'
  }

  const at = email.indexOf('@')

  if (at <= 0 || email.endsWith('@') || email.includes('@', at + 1)) {
    return 'That does not look like an email address.'
  }

  const domain = email.slice(at + 1)

  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return 'That does not look like an email address.'
  }

  return undefined
}

function passwordProblem(value: string, label: string): string | undefined {
  if (value === '') {
    return `Enter your ${label}.`
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }

  return undefined
}

export interface SignInInput {
  email: string
  password: string
}

/** Sign-in checks the password only for emptiness: no rule changes a valid one. */
export function validateSignIn(input: SignInInput): FieldErrors {
  const errors: Record<string, string> = {}

  const email = emailProblem(input.email)

  if (email !== undefined) {
    errors['email'] = email
  }

  if (input.password === '') {
    errors['password'] = 'Enter your password.'
  }

  return errors
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
}

/** Sign-up also checks the name, which becomes profiles.display_name. */
export function validateSignUp(input: SignUpInput): FieldErrors {
  const errors: Record<string, string> = {}

  const email = emailProblem(input.email)

  if (email !== undefined) {
    errors['email'] = email
  }

  const password = passwordProblem(input.password, 'password')

  if (password !== undefined) {
    errors['password'] = password
  }

  if (input.displayName.trim() === '') {
    errors['displayName'] = 'Enter a name.'
  }

  return errors
}

export interface ResetEmailInput {
  email: string
}

/** The address a reset link is sent to. */
export function validateResetEmail(input: ResetEmailInput): FieldErrors {
  const errors: Record<string, string> = {}

  const email = emailProblem(input.email)

  if (email !== undefined) {
    errors['email'] = email
  }

  return errors
}

export interface NewPasswordInput {
  password: string
  confirmPassword: string
}

/**
 * Choosing a new password.
 *
 * Both fields are checked because a person setting a password by hand in a field
 * that is not masked by default will mistype one, and finding that out only after
 * losing the account is worse than a second field.
 */
export function validateNewPassword(input: NewPasswordInput): FieldErrors {
  const errors: Record<string, string> = {}

  const password = passwordProblem(input.password, 'new password')

  if (password !== undefined) {
    errors['password'] = password
  }

  if (input.confirmPassword !== input.password) {
    errors['confirmPassword'] = 'Those do not match.'
  }

  return errors
}
