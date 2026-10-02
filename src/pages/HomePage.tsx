import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'

/**
 * The app is still a shell. This exists to keep the routes mounted and to give
 * the design review page a link to reach.
 */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-text-on-dark">Habittra</h1>

      <p className="text-sm text-text-muted-on-dark">
        No features are built yet. The design system is on the review page.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link to="/design">
          <Button variant="secondary">Open design system</Button>
        </Link>
      </div>
    </main>
  )
}
