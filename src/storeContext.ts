import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { CatalogProduct, Institution, Language } from './store'
import type { useCart } from './useCart'

export type StoreContextValue = {
  products: CatalogProduct[]
  loading: boolean
  error: string | null
  user: User | null
  language: Language
  institution: Institution
  setLanguage: (value: Language) => void
  cart: ReturnType<typeof useCart>
}
export const StoreContext = createContext<StoreContextValue | null>(null)
export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('Store context unavailable')
  return context
}
export const tr = (pt: string, en: string, language: Language) => language === 'pt' ? pt : en
