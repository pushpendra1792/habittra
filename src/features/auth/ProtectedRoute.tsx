/**
 * The gate in front of anything that needs a signed-in user.
 *
 * Three outcomes, and no fourth:
 *
 *   still asking Supabase  a skeleton of the same shape, so the page underneath
 *                         appears in place instead of arriving under a spinner
 *   signed in             the page
 *   not signed in          /login, remembering where they were going
 *
 * `unconfigured` falls into "not signed in" on purpose: there is no account to
 * have, and the sign-in screen is where the missing variables get reported.
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'

export interface ProtectedRouteProps {
  children?: ReactNode
}

/** Same height and rhythm as a real screen, so nothing jumps when it resolves. */
function GateSkeleton() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Skeleton height={30} width={140} />
      <Skeleton height={20} width={200} />
      <Skeleton height={44} radius="sm" />
      <Skeleton height={44} radius="sm" />
      <Skeleton height={48} radius="sm" />
    </div>
  )
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <GateSkeleton />
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
