export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(field.trim()); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++
      row.push(field.trim()); field = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else field += char
  }
  if (quoted) throw new Error('Aspas não fechadas no CSV')
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

export function validateImport(table: 'store_products' | 'product_variants', text: string, existingSkus: string[]) {
  const [headers, ...body] = parseCsv(text.replace(/^\uFEFF/, ''))
  const errors: string[] = []
  if (!headers?.includes('sku') || !headers.includes('name_pt')) return { rows: [], errors: ['O arquivo precisa de sku e name_pt.'] }
  if (body.length > 200) return { rows: [], errors: ['Limite de 200 linhas por importação.'] }
  const seen = new Set(existingSkus)
  const rows: Record<string, string | number | boolean | null>[] = []
  for (const [index, values] of body.entries()) {
    const line = index + 2
    if (values.length !== headers.length) { errors.push(`Linha ${line}: quantidade de colunas inválida.`); continue }
    const source = Object.fromEntries(headers.map((key, column) => [key, values[column]]))
    const sku = source.sku?.trim()
    const name = source.name_pt?.trim()
    if (!sku || !name) { errors.push(`Linha ${line}: SKU e nome são obrigatórios.`); continue }
    if (seen.has(sku)) { errors.push(`Linha ${line}: SKU ${sku} duplicado.`); continue }
    seen.add(sku)
    if (table === 'store_products') {
      const kind = source.kind || 'ticket'
      if (!source.slug || !/^[a-z0-9-]+$/.test(source.slug)) { errors.push(`Linha ${line}: slug inválido.`); continue }
      if (!['ticket','transfer','tour','metro','apparel','package'].includes(kind)) { errors.push(`Linha ${line}: tipo inválido.`); continue }
      rows.push({ sku, slug: source.slug, name_pt: name, kind, summary_pt: source.summary_pt || null, status: 'draft', sales_mode: 'inquiry' })
    } else {
      if (!source.product_id || !/^[0-9a-f-]{36}$/i.test(source.product_id)) { errors.push(`Linha ${line}: product_id inválido.`); continue }
      const price = source.price_cents ? Number(source.price_cents) : null
      if (price !== null && (!Number.isSafeInteger(price) || price <= 0)) { errors.push(`Linha ${line}: preço em centavos inválido.`); continue }
      const currency = source.currency || 'BRL'
      if (!/^[A-Z]{3}$/.test(currency)) { errors.push(`Linha ${line}: moeda inválida.`); continue }
      rows.push({ sku, product_id: source.product_id, name_pt: name, price_cents: price, currency, stock_total: 0, available: false })
    }
  }
  return { rows: errors.length ? [] : rows, errors }
}
