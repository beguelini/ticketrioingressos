import { writeFile } from 'node:fs/promises'

const base = process.env.VITE_SITE_URL || 'https://ticketrioingressos.com.br'
const paths = [
  '/', '/ingressos', '/ensaio-tecnico', '/transfers', '/city-tours', '/metro', '/camisetas',
  '/camarotes', '/sambodromo', '/ordem-dos-desfiles', '/sobre', '/contato',
  '/como-comprar', '/perguntas-frequentes', '/politica-de-privacidade',
  '/politica-de-cookies', '/termos-de-uso', '/termos-de-compra', '/cancelamento-e-reembolso',
]
if (process.env.MONGODB_URI) {
  const { database } = await import('../server/mongo/db.mjs')
  const { db, client } = await database()
  try {
    for (const product of await db.collection('store_products').find({ status: 'published' }, { projection: { slug: 1 } }).toArray()) {
      if (typeof product.slug === 'string') paths.push(`/produto/${encodeURIComponent(product.slug)}`)
    }
  } finally { await client.close() }
}
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  paths.map((path) => `  <url><loc>${escapeXml(new URL(path, base).href)}</loc></url>`).join('\n') +
  '\n</urlset>\n'
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), xml)
