import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { SyncIndicator } from '@/features/sync/SyncIndicator'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { authErrorMessage } from '@/lib/api/errors'

/**
 * The wordmark and the only account control there is for now.
 *
 * Deliberately small: it is chrome above the tracker, not a destination, and
 * there is no settings page yet for Sign out to live on.
 */
export function AppHeader() {
  const { signOut } = useAuth()
  const { push } = useToast()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-dark px-4 py-2.5 sm:px-6">
      <Logo size="sm" />

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SyncIndicator />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signOut().catch((error: unknown) => {
              push({ message: authErrorMessage(error, 'Could not sign you out.') })
            })
          }}
        >
          Sign out
        </Button>
      </div>
    </header>
  )
}
