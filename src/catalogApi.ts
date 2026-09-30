import type { Option, Product } from './catalog'

type CatalogRow = {
  id: number
  kind: Product['kind']
  category: Product['category']
  title: string
  event_date: string | null
  date_label: string
  venue: string
  description: string
  image_path: string
  image_alt: string
  options: Option[]
  badge: string | null
  badge_tone: Product['badgeTone'] | null
  original_price: number | null
}

const columns = 'id,kind,category,title,event_date,date_label,venue,description,image_path,image_alt,options,badge,badge_tone,original_price'

export async function loadCatalog(): Promise<Product[]> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!projectUrl || !publishableKey) throw new Error('Catalog configuration is missing')

  const endpoint = new URL('/rest/v1/catalog_products', projectUrl)
  endpoint.searchParams.set('select', columns)
  endpoint.searchParams.set('is_published', 'eq.true')
  endpoint.searchParams.set('order', 'sort_order.asc')

  const response = await fetch(endpoint, { headers: { apikey: publishableKey } })
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`)
  const data: unknown = await response.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error('Catalog is empty')

  return data.map((value: unknown) => {
    const row = value as CatalogRow
    if (!row || typeof row.id !== 'number' || typeof row.title !== 'string' ||
      !Array.isArray(row.options) || !row.options.length ||
      row.options.some((option) => typeof option.name !== 'string' || typeof option.price !== 'number' || typeof option.note !== 'string')) {
      throw new Error('Catalog contains invalid products')
    }
    return {
      id: row.id,
      kind: row.kind,
      category: row.category,
      title: row.title,
      date: row.event_date ?? '',
      dateLabel: row.date_label,
      venue: row.venue,
      description: row.description,
      image: row.image_path,
      imageAlt: row.image_alt,
      options: row.options,
      badge: row.badge ?? undefined,
      badgeTone: row.badge_tone ?? undefined,
      originalPrice: row.original_price ?? undefined,
    }
  })
}
