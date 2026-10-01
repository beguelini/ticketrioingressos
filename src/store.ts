import { createClient, type User } from '@supabase/supabase-js'

export type ProductKind = 'ticket' | 'transfer' | 'tour' | 'metro' | 'apparel' | 'package'
export type Product = {
  id: string
  sku: string
  slug: string
  kind: ProductKind
  category_id: string | null
  event_date_id: string | null
  name_pt: string
  name_en: string | null
  summary_pt: string | null
  summary_en: string | null
  description_pt: string | null
  description_en: string | null
  image_url: string | null
  gallery: string[]
  included_pt: string | null
  excluded_pt: string | null
  instructions_pt: string | null
  attributes: Record<string, unknown>
  status: string
  sales_mode: 'online' | 'inquiry'
  featured: boolean
  sort_order: number
  promotion_label?: string | null
  promotion_color?: 'blue' | 'yellow' | 'red' | null
  event_dates?: { event_date: string; parade_group: string } | null
}
export type Variant = {
  id: string
  product_id: string
  sku: string
  name_pt: string
  name_en: string | null
  price_cents: number | null
  compare_at_cents?: number | null
  currency: string
  stock_total: number
  stock_reserved: number
  available: boolean
  min_quantity: number
  max_quantity: number
  attributes: Record<string, unknown>
}
export type CatalogProduct = Product & { product_variants: Variant[] }
export type CartLine = { variant_id: string; quantity: number }
export type Language = 'pt' | 'en'
export type Institution = { name: string; cnpj: string; phone: string; whatsapp: string; email: string; address: string; hours: string; confirmed: boolean }
export const referenceInstitution: Institution = {
  name: 'Ticket Rio Turismo', cnpj: '07.909.071/0001-50', phone: '(21) 2025-5000',
  whatsapp: '552120255000', email: 'atendimento@ticketrio.com.br',
  address: 'Av. das Américas, 700, bloco 8, loja 112 L, Barra da Tijuca, Rio de Janeiro',
  hours: 'Segunda a sexta, 10h às 18h', confirmed: false,
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
export const money = (cents: number, currency = 'BRL', language: Language = 'pt') =>
  new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', { style: 'currency', currency }).format(cents / 100)

export const categories: { kind: ProductKind; pt: string; en: string; image: string }[] = [
  { kind: 'ticket', pt: 'Ingressos', en: 'Tickets', image: '/images/avenida-noturna.webp' },
  { kind: 'package', pt: 'Camarotes', en: 'VIP lounges', image: '/images/camarote-vista.webp' },
  { kind: 'transfer', pt: 'Transfers', en: 'Transfers', image: '/images/rio-pelo-mar.webp' },
  { kind: 'tour', pt: 'Rio City Tour', en: 'Rio City Tour', image: '/images/pao-de-acucar.webp' },
  { kind: 'metro', pt: 'Metrô', en: 'Metro', image: '/images/santa-teresa-bonde.webp' },
  { kind: 'apparel', pt: 'Camisetas e abadás', en: 'T-shirts and costumes', image: '/images/bloco-de-rua.webp' },
]

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('store_products')
    .select('*,product_variants(*),event_dates(event_date,parade_group)')
    .eq('status', 'published')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as CatalogProduct[]
}

export async function fetchProduct(slug: string): Promise<CatalogProduct | null> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('store_products')
    .select('*,product_variants(*),event_dates(event_date,parade_group)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  return data as CatalogProduct | null
}

export async function fetchUser(): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}
export async function fetchInstitution(): Promise<Institution> {
  if (!supabase) return referenceInstitution
  const { data, error } = await supabase.from('store_settings').select('value').eq('key','institutional').maybeSingle()
  if (error || !data || typeof data.value !== 'object') return referenceInstitution
  return { ...referenceInstitution, ...data.value } as Institution
}
