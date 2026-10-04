import { describe, expect, it } from 'vitest'

import {
  isValid,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
  validateResetEmail,
  validateSignIn,
  validateSignUp,
} from '@/features/auth/validation'

describe('isValid', () => {
  it('is true when there are no errors', () => {
    expect(isValid({})).toBe(true)
  })

  it('is false when there is even one', () => {
    expect(isValid({ email: 'Enter your email.' })).toBe(false)
  })
})

describe('validateSignIn', () => {
  it('accepts an ordinary address and password', () => {
    expect(validateSignIn({ email: 'pushp@example.com', password: 'correct horse' })).toEqual({})
  })

  it('asks for the address when it is empty', () => {
    expect(validateSignIn({ email: '', password: 'x' })['email']).toBe('Enter your email.')
  })

  it('treats whitespace as empty', () => {
    expect(validateSignIn({ email: '   ', password: 'x' })['email']).toBe('Enter your email.')
  })

  it('asks for the password when it is empty', () => {
    expect(validateSignIn({ email: 'pushp@example.com', password: '' })['password']).toBe(
      'Enter your password.',
    )
  })

  it('does not impose a length on a password at sign-in', () => {
    // Someone who signed up years ago under an older rule must still be able to
    // sign in. The rule belongs on the way in, not the way back.
    expect(validateSignIn({ email: 'pushp@example.com', password: 'a' })).toEqual({})
  })

  it('reports both fields at once rather than one at a time', () => {
    // Two round trips to find out that a blank form has two problems is two
    // round trips too many.
    expect(Object.keys(validateSignIn({ email: '', password: '' })).sort()).toEqual([
      'email',
      'password',
    ])
  })

  it('says nothing about a password that is wrong rather than empty', () => {
    expect(validateSignIn({ email: 'pushp@example.com', password: 'wrongpassword' })).toEqual({})
  })
})

describe('the email shape check', () => {
  const check = (email: string) => validateSignIn({ email, password: 'password' })['email']

  it('accepts ordinary addresses', () => {
    for (const email of [
      'pushp@example.com',
      'first.last@example.co.uk',
      'a@b.io',
      'pushp+habits@example.com',
      'pushp@example.museum',
    ]) {
      expect(check(email)).toBeUndefined()
    }
  })

  it('rejects an address with no at sign', () => {
    expect(check('pushp.example.com')).toBeDefined()
    expect(check('example.com')).toBeDefined()
  })

  it('rejects an address with the wrong shape of at sign', () => {
    expect(check('@example.com')).toBeDefined()
    expect(check('pushp@')).toBeDefined()
    expect(check('pushp@@example.com')).toBeDefined()
  })

  it('rejects a domain with no dot', () => {
    expect(check('pushp@example')).toBeDefined()
  })

  it('rejects a domain that starts or ends with a dot', () => {
    expect(check('pushp@.com')).toBeDefined()
    expect(check('pushp@example.')).toBeDefined()
  })

  it('ignores spaces around an otherwise valid address', () => {
    expect(check('  pushp@example.com  ')).toBeUndefined()
  })

  it('does not try to be exhaustive, and lets oddities through to the server', () => {
    // Quoted local parts and IP literals are legal and vanishingly rare. Guessing
    // at them would reject real addresses; the server is the only thing that can
    // say whether an address exists.
    expect(check('"odd name"@example.com')).toBeUndefined()
    expect(check('pushp@[127.0.0.1]')).toBeUndefined()
  })
})

describe('validateSignUp', () => {
  const valid = { displayName: 'Pushp', email: 'pushp@example.com', password: 'correct horse' }

  it('accepts an ordinary signup', () => {
    expect(validateSignUp(valid)).toEqual({})
  })

  it('requires a name, because it becomes profiles.display_name', () => {
    expect(validateSignUp({ ...valid, displayName: '' })['displayName']).toBe('Enter a name.')
    expect(validateSignUp({ ...valid, displayName: '   ' })['displayName']).toBe('Enter a name.')
  })

  it('enforces the shortest password the server accepts', () => {
    expect(
      validateSignUp({ ...valid, password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) })['password'],
    ).toBe(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)

    expect(validateSignUp({ ...valid, password: 'a'.repeat(MIN_PASSWORD_LENGTH) })).toEqual({})
  })

  it('asks for a password at all before complaining about its length', () => {
    expect(validateSignUp({ ...valid, password: '' })['password']).toBe('Enter your password.')
  })

  it('checks every field in one pass', () => {
    expect(
      Object.keys(validateSignUp({ displayName: '', email: '', password: '' })).sort(),
    ).toEqual(['displayName', 'email', 'password'])
  })
})

describe('validateResetEmail', () => {
  it('accepts an ordinary address', () => {
    expect(validateResetEmail({ email: 'pushp@example.com' })).toEqual({})
  })

  it('asks for the address when it is empty', () => {
    expect(validateResetEmail({ email: '' })['email']).toBe('Enter your email.')
  })

  it('rejects an address that is not one', () => {
    expect(validateResetEmail({ email: 'pushp@example' })['email']).toBe(
      'That does not look like an email address.',
    )
  })

  it('ignores spaces around a valid address', () => {
    expect(validateResetEmail({ email: ' pushp@example.com ' })).toEqual({})
  })
})

describe('validateNewPassword', () => {
  it('accepts a matching pair', () => {
    expect(
      validateNewPassword({ password: 'correct horse', confirmPassword: 'correct horse' }),
    ).toEqual({})
  })

  it('complains when the two do not match, even when both are valid', () => {
    expect(
      validateNewPassword({ password: 'correct horse', confirmPassword: 'battery staple' })[
        'confirmPassword'
      ],
    ).toBe('Those do not match.')
  })

  it('complains about the second field when it is empty and the first is not', () => {
    expect(
      validateNewPassword({ password: 'correct horse', confirmPassword: '' })['confirmPassword'],
    ).toBe('Those do not match.')
  })

  it('enforces the length on the first field', () => {
    expect(validateNewPassword({ password: 'abc', confirmPassword: 'abc' })['password']).toBe(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
  })

  it('does not enforce the length on the second field separately', () => {
    // If the first field is long enough and the two match, the second is by
    // definition the same string. A second rule here could only disagree.
    expect(
      validateNewPassword({ password: 'correct horse', confirmPassword: 'correct horse' }),
    ).toEqual({})
  })

  it('reports both problems at once', () => {
    expect(
      Object.keys(validateNewPassword({ password: '', confirmPassword: 'different' })).sort(),
    ).toEqual(['confirmPassword', 'password'])
  })
})
