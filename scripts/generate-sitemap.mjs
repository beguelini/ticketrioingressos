import { writeFile } from 'node:fs/promises'

const base = process.env.VITE_SITE_URL || 'https://ticketrioingressos.com.br'
const paths = [
  '/', '/ingressos', '/ensaio-tecnico', '/transfers', '/city-tours', '/metro', '/camisetas',
  '/camarotes', '/sambodromo', '/ordem-dos-desfiles', '/sobre', '/contato',
  '/como-comprar', '/perguntas-frequentes', '/politica-de-privacidade',
  '/politica-de-cookies', '/termos-de-uso', '/termos-de-compra', '/cancelamento-e-reembolso',
]
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (url && key) {
  try {
    const endpoint = new URL('/rest/v1/store_products', url)
    endpoint.searchParams.set('select', 'slug')
    endpoint.searchParams.set('status', 'eq.published')
    const response = await fetch(endpoint, { headers: { apikey: key } })
    if (!response.ok) throw new Error(`Supabase ${response.status}`)
    const products = await response.json()
    for (const product of products) if (typeof product.slug === 'string') paths.push(`/produto/${encodeURIComponent(product.slug)}`)
  } catch (error) { console.warn('Sitemap: não foi possível carregar produtos publicados:', error) }
}
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  paths.map((path) => `  <url><loc>${escapeXml(new URL(path, base).href)}</loc></url>`).join('\n') +
  '\n</urlset>\n'
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), xml)
