import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Skeleton } from '@/components/ui/Skeleton'
import { ToastProvider, ToastViewport } from '@/components/ui/Toast'
import { HomePage } from '@/pages/HomePage'

// The design review page pulls in Recharts and every UI component. It is a
// review tool and will not ship, so it stays out of the main bundle.
const DesignPage = lazy(() =>
  import('@/pages/DesignPage').then((module) => ({ default: module.DesignPage })),
)

function RouteFallback() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-12 sm:px-6">
      <Skeleton height={36} width={220} />
      <Skeleton height={16} />
      <Skeleton height={120} radius="card" />
      <Skeleton height={220} radius="card" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ToastViewport />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/design"
            element={
              <Suspense fallback={<RouteFallback />}>
                <DesignPage />
              </Suspense>
            }
          />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
