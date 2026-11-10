import { useContext } from 'react'

import { LocalCacheContext, type LocalCacheContextValue } from './localCacheContext'

/** Whether the signed-in user's local snapshot is ready to render. */
export function useLocalCache(): LocalCacheContextValue {
  const context = useContext(LocalCacheContext)

  if (context === null) {
    throw new Error('useLocalCache must be used inside a LocalCacheProvider')
  }

  return context
}
