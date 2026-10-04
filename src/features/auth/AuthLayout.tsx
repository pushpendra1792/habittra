/**
 * The frame every auth screen shares: wordmark, one line of copy, the form.
 *
 * Full height and vertically centred, so the three screens are the same shape and
 * moving between them does not shift the content. Sized for 360px first; a wider
 * screen centres the same column rather than stretching it, because a sign-in
 * form across 1280px is harder to read, not easier.
 */
import type { ReactNode } from 'react'

import { Logo } from '@/components/ui/Logo'

export interface AuthLayoutProps {
  /** The one thing this screen is for, in the fewest words that say it. */
  title: string
  subtitle: string
  children?: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-5">
        <Logo size="lg" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-text-on-dark">{title}</h1>
          <p className="text-sm text-text-muted-on-dark">{subtitle}</p>
        </div>
      </header>

      {children}
    </main>
  )
}
