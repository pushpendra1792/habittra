import { createContext } from 'react'

export interface LocalCacheContextValue {
  /** True once this user's IndexedDB snapshot has been copied into the query cache. */
  ready: boolean
}

export const LocalCacheContext = createContext<LocalCacheContextValue | null>(null)
