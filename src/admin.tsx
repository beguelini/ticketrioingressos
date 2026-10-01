import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useStore } from './storeContext'
import { money, supabase } from './store'
import { validateImport } from './csv'

type Field = { key: string; label: string; kind?: 'number' | 'boolean' | 'date' | 'json' | 'textarea' | 'select'; options?: string[]; required?: boolean }
type Module = { table: string; title: string; key?: string; fields: Field[]; roles: string[]; readOnly?: boolean }
const modules: Module[] = [
  { table: 'store_products', title: 'Produtos', roles: ['administrator','commercial'], fields: [
    { key: 'sku', label: 'SKU', required: true }, { key: 'slug', label: 'Slug', required: true },
    { key: 'name_pt', label: 'Nome', required: true }, { key: 'name_en', label: 'Nome em inglês' },
    { key: 'kind', label: 'Tipo', kind: 'select', options: ['ticket','transfer','tour','metro','apparel','package'], required: true },
    { key: 'category_id', label: 'ID da categoria' }, { key: 'event_date_id', label: 'ID da data do evento' },
    { key: 'summary_pt', label: 'Resumo', kind: 'textarea' }, { key: 'description_pt', label: 'Descrição', kind: 'textarea' },
    { key: 'summary_en', label: 'Resumo em inglês', kind: 'textarea' }, { key: 'description_en', label: 'Descrição em inglês', kind: 'textarea' },
    { key: 'image_url', label: 'URL da imagem' }, { key: 'gallery', label: 'Galeria (JSON)', kind: 'json' }, { key: 'video_url', label: 'URL do vídeo' },
    { key: 'included_pt', label: 'Inclusos', kind: 'textarea' }, { key: 'excluded_pt', label: 'Não inclusos', kind: 'textarea' }, { key: 'instructions_pt', label: 'Orientações', kind: 'textarea' },
    { key: 'attributes', label: 'Atributos (JSON)', kind: 'json' },
    { key: 'seo_title_pt', label: 'Título de SEO' }, { key: 'seo_description_pt', label: 'Descrição de SEO', kind: 'textarea' },
    { key: 'status', label: 'Status', kind: 'select', options: ['draft','published','archived'] },
    { key: 'sales_mode', label: 'Modalidade', kind: 'select', options: ['inquiry','online'] },
    { key: 'featured', label: 'Destaque', kind: 'boolean' }, { key: 'sort_order', label: 'Ordem', kind: 'number' },
    { key: 'promotion_label', label: 'Etiqueta promocional' }, { key: 'promotion_color', label: 'Cor da etiqueta', kind: 'select', options: ['blue','yellow','red'] },
  ] },
  { table: 'product_variants', title: 'Variantes e estoque', roles: ['administrator','commercial'], fields: [
    { key: 'product_id', label: 'ID do produto', required: true }, { key: 'sku', label: 'SKU único', required: true },
    { key: 'name_pt', label: 'Nome', required: true }, { key: 'name_en', label: 'Nome em inglês' },
    { key: 'price_cents', label: 'Preço em centavos', kind: 'number' }, { key: 'compare_at_cents', label: 'Preço anterior validado (centavos)', kind: 'number' }, { key: 'currency', label: 'Moeda', required: true },
    { key: 'stock_total', label: 'Estoque total', kind: 'number' }, { key: 'available', label: 'Disponível', kind: 'boolean' },
    { key: 'min_quantity', label: 'Quantidade mínima', kind: 'number' }, { key: 'max_quantity', label: 'Quantidade máxima', kind: 'number' },
    { key: 'attributes', label: 'Setor, lado, tamanho etc. (JSON)', kind: 'json' },
  ] },
  { table: 'store_categories', title: 'Categorias', roles: ['administrator','commercial'], fields: [
    { key: 'slug', label: 'Slug', required: true }, { key: 'name_pt', label: 'Nome', required: true },
    { key: 'name_en', label: 'Nome em inglês' }, { key: 'description_pt', label: 'Descrição', kind: 'textarea' },
    { key: 'image_url', label: 'Imagem' }, { key: 'sort_order', label: 'Ordem', kind: 'number' },
    { key: 'status', label: 'Status', kind: 'select', options: ['draft','published','archived'] },
  ] },
  { table: 'events', title: 'Eventos', roles: ['administrator','commercial'], fields: [
    { key: 'title_pt', label: 'Nome', required: true }, { key: 'title_en', label: 'Nome em inglês' },
    { key: 'year', label: 'Ano', kind: 'number', required: true }, { key: 'notes', label: 'Observações', kind: 'textarea' },
    { key: 'status', label: 'Status', kind: 'select', options: ['draft','published','archived'] },
  ] },
  { table: 'event_dates', title: 'Datas', roles: ['administrator','commercial'], fields: [
    { key: 'event_id', label: 'ID do evento', required: true }, { key: 'event_date', label: 'Data', kind: 'date', required: true },
    { key: 'parade_group', label: 'Grupo', required: true }, { key: 'starts_at', label: 'Horário previsto' },
    { key: 'status', label: 'Status', kind: 'select', options: ['draft','published','archived'] },
  ] },
  { table: 'parade_schools', title: 'Escolas', roles: ['administrator','commercial'], fields: [{ key: 'name', label: 'Nome', required: true }] },
  { table: 'parade_lineup', title: 'Ordem dos desfiles', roles: ['administrator','commercial'], fields: [
    { key: 'event_date_id', label: 'ID da data', required: true }, { key: 'school_id', label: 'ID da escola', required: true },
    { key: 'parade_order', label: 'Ordem', kind: 'number', required: true }, { key: 'expected_at', label: 'Horário previsto' },
    { key: 'notes', label: 'Observações', kind: 'textarea' }, { key: 'status', label: 'Status', kind: 'select', options: ['draft','published'] },
  ] },
  { table: 'store_pages', title: 'Páginas e políticas', key: 'slug', roles: ['administrator','commercial'], fields: [
    { key: 'slug', label: 'Slug', required: true }, { key: 'title_pt', label: 'Título', required: true },
    { key: 'title_en', label: 'Título em inglês' }, { key: 'body_pt', label: 'Texto em português', kind: 'textarea' },
    { key: 'body_en', label: 'Texto em inglês', kind: 'textarea' },
    { key: 'status', label: 'Status', kind: 'select', options: ['draft','published'] },
    { key: 'approval_status', label: 'Aprovação', kind: 'select', options: ['pending','approved'] },
    { key: 'version', label: 'Versão', kind: 'number' },
  ] },
  { table: 'store_faqs', title: 'Perguntas frequentes', roles: ['administrator','commercial'], fields: [
    { key: 'question_pt', label: 'Pergunta', required: true }, { key: 'answer_pt', label: 'Resposta', kind: 'textarea', required: true },
    { key: 'question_en', label: 'Pergunta em inglês' }, { key: 'answer_en', label: 'Resposta em inglês', kind: 'textarea' },
    { key: 'sort_order', label: 'Ordem', kind: 'number' }, { key: 'status', label: 'Status', kind: 'select', options: ['draft','published'] },
  ] },
  { table: 'store_banners', title: 'Banners', roles: ['administrator','commercial'], fields: [
    { key: 'title_pt', label: 'Título', required: true }, { key: 'title_en', label: 'Título em inglês' },
    { key: 'image_url', label: 'URL da imagem' }, { key: 'target_url', label: 'Link' },
    { key: 'sort_order', label: 'Ordem', kind: 'number' }, { key: 'status', label: 'Status', kind: 'select', options: ['draft','published'] },
  ] },
  { table: 'home_blocks', title: 'Blocos da home', key: 'block_key', roles: ['administrator','commercial'], fields: [
    { key: 'block_key', label: 'Bloco', required: true }, { key: 'visible', label: 'Visível', kind: 'boolean' },
    { key: 'sort_order', label: 'Ordem', kind: 'number' },
  ] },
  { table: 'store_settings', title: 'Dados institucionais', key: 'key', roles: ['administrator'], fields: [
    { key: 'value', label: 'Dados de referência (JSON)', kind: 'json', required: true },
  ] },
  { table: 'transfer_routes', title: 'Rotas de transfer', roles: ['administrator','operations'], fields: [
    { key: 'product_id', label: 'ID do produto', required: true }, { key: 'service_date', label: 'Data', kind: 'date', required: true },
    { key: 'sambadrome_side', label: 'Lado', kind: 'select', options: ['even','odd'], required: true },
    { key: 'capacity', label: 'Capacidade', kind: 'number' },
    { key: 'instructions_outbound', label: 'Instruções de ida', kind: 'textarea' },
    { key: 'instructions_return', label: 'Instruções de volta', kind: 'textarea' },
    { key: 'details_due_before_checkout', label: 'Dados exigidos no checkout', kind: 'boolean' },
  ] },
  { table: 'transfer_stops', title: 'Pontos de embarque', roles: ['administrator','operations'], fields: [
    { key: 'route_id', label: 'ID da rota', required: true }, { key: 'hotel_or_stop', label: 'Hotel ou ponto', required: true },
    { key: 'pickup_at', label: 'Horário' }, { key: 'sort_order', label: 'Ordem', kind: 'number' },
  ] },
  { table: 'orders', title: 'Pedidos', roles: ['administrator','commercial','operations','finance'], readOnly: true, fields: [] },
  { table: 'payments', title: 'Pagamentos', roles: ['administrator','finance'], readOnly: true, fields: [] },
  { table: 'refunds', title: 'Reembolsos', roles: ['administrator','finance'], readOnly: true, fields: [] },
  { table: 'stock_reservations', title: 'Reservas de estoque', roles: ['administrator','operations'], readOnly: true, fields: [] },
  { table: 'deliveries', title: 'Entregas', roles: ['administrator','operations'], readOnly: true, fields: [] },
  { table: 'transfer_passengers', title: 'Passageiros', roles: ['administrator','operations'], readOnly: true, fields: [] },
  { table: 'inquiries', title: 'Consultas', roles: ['administrator','commercial'], readOnly: true, fields: [] },
  { table: 'customer_profiles', title: 'Clientes', roles: ['administrator','commercial'], readOnly: true, fields: [] },
  { table: 'notification_attempts', title: 'Notificações', roles: ['administrator','commercial','operations'], readOnly: true, fields: [] },
  { table: 'audit_log', title: 'Auditoria', roles: ['administrator'], readOnly: true, fields: [] },
  { table: 'staff_roles', title: 'Usuários internos', roles: ['administrator'], readOnly: true, fields: [] },
]
const display = (value: unknown) => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
const csvValue = (value: unknown) => `"${display(value).replace(/"/g, '""')}"`

function AdminTable({ module }: { module: Module }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([])
  const key = module.key ?? 'id'
  const load = useCallback(async () => {
    if (!supabase) return
    const query = supabase.from(module.table).select('*').limit(200)
    const { data, error } = await (module.table === 'store_settings' ? query.eq('key','institutional') : query)
    setRows((data ?? []) as Record<string, unknown>[])
    setMessage(error ? `Não foi possível carregar: ${error.message}` : '')
  }, [module.table])
  useEffect(() => { void load(); setEdit(null); setImportRows([]) }, [load])
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !edit) return
    let payload: Record<string, unknown>
    try {
      payload = Object.fromEntries(module.fields.filter(({ key: fieldKey }) => fieldKey in edit).map(({ key: fieldKey, kind }) => {
        const raw = edit[fieldKey]
        if (kind === 'number') return [fieldKey, raw === '' || raw === null || raw === undefined ? null : Number(raw)]
        if (kind === 'boolean') return [fieldKey, Boolean(raw)]
        if (kind === 'json') return [fieldKey, typeof raw === 'string' ? JSON.parse(raw) : raw]
        return [fieldKey, raw === '' ? null : raw]
      }))
    } catch { setMessage('JSON inválido. Revise o campo antes de salvar.'); return }
    const currentId = edit[key]
    const result = currentId
      ? await supabase.from(module.table).update(payload).eq(key, currentId)
      : await supabase.from(module.table).insert(payload)
    setMessage(result.error ? result.error.message : 'Registro salvo.')
    if (!result.error) { setEdit(null); void load() }
  }
  const download = () => {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    const csv = [columns.map(csvValue).join(','), ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `ticket-rio-${module.table}.csv`; link.click()
    URL.revokeObjectURL(url)
  }
  const previewCsv = async (file: File) => {
    try {
      const parsed = validateImport(module.table as 'store_products' | 'product_variants', await file.text(), rows.map((row) => String(row.sku)))
      setImportRows(parsed.rows)
      setMessage(parsed.errors.length ? parsed.errors.join(' ') : `Prévia: ${parsed.rows.length} registros. Todos serão rascunhos ou indisponíveis.`)
    } catch (error) { setImportRows([]); setMessage(String(error)) }
  }
  const uploadImage = async (file: File) => {
    if (!supabase) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage('Use JPG, PNG ou WebP de até 10 MB.'); return }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `products/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('ticket-rio-media').upload(path, file, { contentType: file.type, upsert: false })
    if (error) { setMessage(`Upload falhou: ${error.message}`); return }
    const { data } = supabase.storage.from('ticket-rio-media').getPublicUrl(path)
    setEdit((current) => current ? { ...current, image_url: data.publicUrl } : current)
    setMessage('Imagem enviada. Salve o produto para associá-la.')
  }
  const confirmImport = async () => {
    if (!supabase || !importRows.length || !window.confirm(`Gravar ${importRows.length} registros como rascunho?`)) return
    const { error } = await supabase.from(module.table).insert(importRows)
    setMessage(error ? `Importação cancelada: ${error.message}` : 'Importação concluída. Revise os registros antes de publicar.')
    if (!error) { setImportRows([]); void load() }
  }
  const visible = rows.filter((row) => !search || JSON.stringify(row).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  const columns = rows.length ? Object.keys(rows[0]).filter((column) => !['description_pt','description_en','body_pt','body_en','address','attributes','gallery'].includes(column)).slice(0, 7) : []
  return <section className="admin-panel"><div className="admin-panel-head"><div><span className="section-kicker">PAINEL TICKET RIO</span><h2>{module.title}</h2></div><div className="admin-actions">{!module.readOnly && module.table !== 'store_settings' && <button className="button" type="button" onClick={() => setEdit({})}>Novo registro</button>}<button className="secondary-button" type="button" onClick={download} disabled={!rows.length}>Exportar CSV</button></div></div>
    <label className="field">Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar registros" /></label>
    {['store_products','product_variants'].includes(module.table) && <div className="import-panel"><strong>Importar CSV com prévia</strong><p>Modelo: {module.table === 'store_products' ? 'sku,slug,name_pt,kind,summary_pt' : 'sku,product_id,name_pt,price_cents,currency'}. Sem sobrescrita; registros importados ficam indisponíveis.</p><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewCsv(file) }} />{importRows.length > 0 && <><p>Prévia de {importRows.length} registro(s): {importRows.slice(0, 3).map((row) => String(row.sku)).join(', ')}</p><button className="button" type="button" onClick={() => void confirmImport()}>Confirmar gravação</button></>}</div>}
    {message && <p role="status" className="admin-message">{message}</p>}
    {edit && <form className="admin-form" onSubmit={(event) => void save(event)}><h3>{edit[key] ? 'Editar' : 'Novo'} · {module.title}</h3>{module.fields.map((field) => <label key={field.key}>{field.label}{field.kind === 'boolean' ? <input type="checkbox" checked={Boolean(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.checked })} /> : field.kind === 'select' ? <select required={field.required} value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })}><option value="">Selecione</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.kind === 'textarea' || field.kind === 'json' ? <textarea required={field.required} value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })} /> : <input required={field.required} type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'} value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })} />}</label>)}{module.table === 'store_products' && <label>Enviar imagem JPG, PNG ou WebP<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file) }} /></label>}<div className="admin-actions"><button className="button" type="submit">Salvar</button><button className="secondary-button" type="button" onClick={() => setEdit(null)}>Cancelar</button></div></form>}
    {visible.length ? <div className="admin-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}{!module.readOnly && <th>Ação</th>}</tr></thead><tbody>{visible.map((row, index) => <tr key={display(row[key]) || index}>{columns.map((column) => <td key={column} title={display(row[column])}>{display(row[column]).slice(0, 90)}</td>)}{!module.readOnly && <td><button className="text-button" type="button" onClick={() => setEdit(row)}>Editar</button></td>}</tr>)}</tbody></table></div> : <p>Nenhum registro encontrado.</p>}
  </section>
}

function Dashboard() {
  const [counts, setCounts] = useState({ orders: 0, products: 0, inquiries: 0, pendingDeliveries: 0, approvedRevenue: 0, approvedOrders: 0 })
  useEffect(() => {
    if (!supabase) return
    void Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('store_products').select('id', { count: 'exact', head: true }),
      supabase.from('inquiries').select('id', { count: 'exact', head: true }),
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).neq('status','available_official_app'),
      supabase.from('orders').select('total_cents').eq('payment_status','approved'),
    ]).then(([orders, products, inquiries, deliveries, revenue]) => setCounts({
      orders: orders.count ?? 0, products: products.count ?? 0, inquiries: inquiries.count ?? 0,
      pendingDeliveries: deliveries.count ?? 0,
      approvedRevenue: (revenue.data ?? []).reduce((sum, order) => sum + order.total_cents, 0),
      approvedOrders: revenue.data?.length ?? 0,
    }))
  }, [])
  return <section className="admin-panel"><span className="section-kicker">VISÃO GERAL</span><h2>Operação Ticket Rio</h2><div className="metric-grid"><div><small>Receita aprovada</small><strong>{money(counts.approvedRevenue)}</strong></div><div><small>Pedidos</small><strong>{counts.orders}</strong></div><div><small>Produtos cadastrados</small><strong>{counts.products}</strong></div><div><small>Consultas</small><strong>{counts.inquiries}</strong></div><div><small>Entregas pendentes</small><strong>{counts.pendingDeliveries}</strong></div><div><small>Ticket médio aprovado</small><strong>{counts.approvedOrders ? money(Math.round(counts.approvedRevenue / counts.approvedOrders)) : '—'}</strong></div></div><p>Ticket médio = receita de pedidos com pagamento aprovado ÷ quantidade desses pedidos.</p></section>
}

export function AdminPage() {
  const { user } = useStore()
  const [params, setParams] = useSearchParams()
  const [role, setRole] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (!user || !supabase) { setChecked(true); setRole(null); return }
    void supabase.from('staff_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => { setRole(data?.role ?? null); setChecked(true) })
  }, [user])
  if (!checked) return <div className="page-container"><p>Verificando acesso…</p></div>
  if (!user || !role) return <div className="page-container narrow-page"><h1>Acesso restrito</h1><p>Esta área exige uma função interna autorizada.</p><Link to="/login">Entrar com conta autorizada</Link></div>
  const allowed = modules.filter((module) => module.roles.includes(role))
  const selected = allowed.find((module) => module.table === params.get('modulo'))
  return <div className="admin-layout"><aside className="admin-sidebar"><Link to="/">← Ver loja</Link><h1>Painel Ticket Rio</h1><p>Função: {role}</p><button className={!selected ? 'admin-nav-current' : ''} type="button" onClick={() => setParams({})}>Dashboard</button>{allowed.map((module) => <button className={selected?.table === module.table ? 'admin-nav-current' : ''} key={module.table} type="button" onClick={() => setParams({ modulo: module.table })}>{module.title}</button>)}</aside><div className="admin-content">{selected ? <AdminTable module={selected} /> : <Dashboard />}</div></div>
}
