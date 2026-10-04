import { describe, expect, it } from 'vitest'

import { readSupabaseEnv, SupabaseConfigError } from '@/lib/supabase'

/** Both variables present, which is the only shape that should not throw. */
const complete = {
  VITE_SUPABASE_URL: 'https://abcdefghijklm.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
}

describe('readSupabaseEnv', () => {
  it('returns both values when they are set', () => {
    expect(readSupabaseEnv(complete)).toEqual({
      url: 'https://abcdefghijklm.supabase.co',
      anonKey: 'anon-key',
    })
  })

  it('trims a value that was pasted with a trailing space', () => {
    const config = readSupabaseEnv({
      VITE_SUPABASE_URL: '  https://abcdefghijklm.supabase.co  ',
      VITE_SUPABASE_ANON_KEY: '\tanon-key\n',
    })

    expect(config.url).toBe('https://abcdefghijklm.supabase.co')
    expect(config.anonKey).toBe('anon-key')
  })

  it('names the one variable that is missing', () => {
    try {
      readSupabaseEnv({ VITE_SUPABASE_ANON_KEY: 'anon-key' })
      expect.unreachable('should have thrown')
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(SupabaseConfigError)
      expect((thrown as SupabaseConfigError).missing).toEqual(['VITE_SUPABASE_URL'])
    }
  })

  it('names both variables when the project has never been set up', () => {
    try {
      readSupabaseEnv({})
      expect.unreachable('should have thrown')
    } catch (thrown) {
      expect((thrown as SupabaseConfigError).missing).toEqual([
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
      ])
    }
  })

  it('treats an unset variable and a blank one the same', () => {
    // Vite substitutes the string "undefined" for a variable that is not in the
    // file at all, so a name being present proves nothing about its value.
    for (const value of ['', '   ', '\n', undefined]) {
      try {
        readSupabaseEnv({ VITE_SUPABASE_URL: value, VITE_SUPABASE_ANON_KEY: 'anon-key' })
        expect.unreachable('should have thrown')
      } catch (thrown) {
        expect((thrown as SupabaseConfigError).missing).toEqual(['VITE_SUPABASE_URL'])
      }
    }
  })

  it('says which file to copy and where to look', () => {
    // Someone hitting this has not configured anything yet, so the message is
    // the only place that can tell them what to do next.
    try {
      readSupabaseEnv({})
      expect.unreachable('should have thrown')
    } catch (thrown) {
      const message = (thrown as Error).message

      expect(message).toContain('VITE_SUPABASE_URL')
      expect(message).toContain('VITE_SUPABASE_ANON_KEY')
      expect(message).toContain('.env.example')
      expect(message).toContain('SETUP_SUPABASE.md')
    }
  })

  it('is a named error type, so a caller can tell it apart from a rejected request', () => {
    expect(new SupabaseConfigError(['VITE_SUPABASE_URL']).name).toBe('SupabaseConfigError')
    expect(new SupabaseConfigError(['VITE_SUPABASE_URL'])).toBeInstanceOf(Error)
  })

  it('reads singular when one variable is missing and plural when two are', () => {
    expect(new SupabaseConfigError(['VITE_SUPABASE_URL']).message).toContain(
      'environment variable:',
    )
    expect(new SupabaseConfigError(['A', 'B']).message).toContain('environment variables:')
  })
})
