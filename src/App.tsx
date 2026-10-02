import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ToastProvider, ToastViewport } from '@/components/ui/Toast'
import { DesignPage } from '@/pages/DesignPage'
import { HomePage } from '@/pages/HomePage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ToastViewport />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/design" element={<DesignPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
