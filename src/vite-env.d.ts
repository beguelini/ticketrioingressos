/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SITE_URL?: string
  readonly VITE_GTM_ID?: string
  readonly VITE_META_PIXEL_ID?: string
}
