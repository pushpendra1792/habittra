import { describe, expect, it } from 'vitest'

import { isGoogleAuthEnabled } from '@/features/auth/googleAuth'
import { isRecoveryUrl, redirectTarget } from '@/features/auth/redirects'

describe('isGoogleAuthEnabled', () => {
  it('is on for true, whatever the case', () => {
    expect(isGoogleAuthEnabled('true')).toBe(true)
    expect(isGoogleAuthEnabled('TRUE')).toBe(true)
    expect(isGoogleAuthEnabled(' True ')).toBe(true)
  })

  it('is off when the flag is not set at all', () => {
    // The default has to be the path that works with no Google client, so an
    // unconfigured project gets a working email form and no dead button.
    expect(isGoogleAuthEnabled(undefined)).toBe(false)
  })

  it('is off for anything that is not true', () => {
    for (const value of ['', ' ', 'false', '0', 'no', 'yes', 'enabled', 'on']) {
      expect(isGoogleAuthEnabled(value)).toBe(false)
    }
  })

  it('is off for a value that is nearly true', () => {
    // A typo that turned the button on would produce a button that fails when
    // pressed, which is worse than no button at all.
    expect(isGoogleAuthEnabled('tru')).toBe(false)
    expect(isGoogleAuthEnabled('true1')).toBe(false)
  })
})

describe('isRecoveryUrl', () => {
  it('recognises a recovery token in the fragment', () => {
    expect(isRecoveryUrl('#access_token=x&type=recovery&expires_in=3600')).toBe(true)
  })

  it('recognises a recovery token in the query string', () => {
    expect(isRecoveryUrl('?code=x&type=recovery')).toBe(true)
  })

  it('ignores an ordinary sign-in callback', () => {
    expect(isRecoveryUrl('#access_token=x&type=signup')).toBe(false)
    expect(isRecoveryUrl('')).toBe(false)
  })
})

describe('redirectTarget', () => {
  it('uses the path the visitor was trying to reach', () => {
    expect(redirectTarget({ from: '/habits' })).toBe('/habits')
  })

  it('falls back to the app root for anything else', () => {
    for (const state of [null, undefined, 'a string', 42, {}, { from: 42 }, { from: null }]) {
      expect(redirectTarget(state)).toBe('/')
    }
  })

  it('refuses a URL rather than a path', () => {
    // History state is not worth navigating to blindly, and a value starting
    // with // is protocol-relative rather than a path at all.
    expect(redirectTarget({ from: 'https://example.com' })).toBe('/')
    expect(redirectTarget({ from: '//example.com' })).toBe('/')
  })

  it('accepts a nested path', () => {
    expect(redirectTarget({ from: '/habits/2023-07' })).toBe('/habits/2023-07')
  })

  it('uses the fallback it is given', () => {
    expect(redirectTarget(null, '/login')).toBe('/login')
  })
})
