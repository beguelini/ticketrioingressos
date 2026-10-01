import { describe, expect, it } from 'vitest'
import { parseCsv, validateImport } from './csv'

describe('CSV de catálogo', () => {
  it('lê campos entre aspas com vírgula e quebra de linha', () => {
    expect(parseCsv('sku,name_pt\nA,"Ingresso, Setor 1"\nB,"Linha\nseguinte"')).toEqual([
      ['sku','name_pt'], ['A','Ingresso, Setor 1'], ['B','Linha\nseguinte'],
    ])
  })
  it('impede SKU duplicado e não retorna linhas parciais', () => {
    const result = validateImport('store_products', 'sku,slug,name_pt,kind\nA,produto-a,Produto A,ticket\nA,produto-b,Produto B,ticket', [])
    expect(result.rows).toEqual([])
    expect(result.errors[0]).toContain('duplicado')
  })
  it('importa produtos somente como rascunho sob consulta', () => {
    const result = validateImport('store_products', 'sku,slug,name_pt,kind\nA,produto-a,Produto A,ticket', [])
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({ status: 'draft', sales_mode: 'inquiry' })
  })
  it('não inventa preço ou estoque em variantes', () => {
    const result = validateImport('product_variants', 'sku,product_id,name_pt,price_cents\nA,00000000-0000-0000-0000-000000000001,Setor A,', [])
    expect(result.rows[0]).toMatchObject({ price_cents: null, stock_total: 0, available: false })
  })
})
