import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import RecordDetails from './adminRecord'
import {fieldLabel,presentValue,summaryColumns} from './adminPresentation'
import type { User } from './client'
import { useSearchParams } from 'react-router'
import { money, api } from './store'
import { validateImport } from './csv'
const Sales = lazy(() => import('./adminSales'))
const CRM = lazy(() => import('./adminCRM'))
const Media = lazy(() => import('./adminMedia'))
const Team = lazy(() => import('./adminTeam'))
const Support = lazy(() => import('./adminSupport'))

type Field = { key: string; label: string; kind?: 'number' | 'boolean' | 'date' | 'json' | 'textarea' | 'select' | 'category'; options?: string[]; required?: boolean }
type Module = { table: string; title: string; key?: string; fields: Field[]; roles: string[]; readOnly?: boolean }
const modules: Module[] = [
  { table: 'store_products', title: 'Produtos', roles: ['administrator','commercial'], fields: [
    { key: 'sku', label: 'SKU', required: true }, { key: 'slug', label: 'Slug', required: true },
    { key: 'name_pt', label: 'Nome', required: true }, { key: 'name_en', label: 'Nome em inglês' },
    { key: 'kind', label: 'Tipo', kind: 'select', options: ['ticket','transfer','tour','metro','apparel','package'], required: true },
    { key: 'category_id', label: 'Categoria', kind: 'category' }, { key: 'event_date_id', label: 'ID da data do evento' },
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
  { table: 'order_items', title: 'Itens dos pedidos', roles: ['administrator','commercial','operations','finance'], readOnly: true, fields: [] },
  { table: 'payments', title: 'Pagamentos', roles: ['administrator','finance'], readOnly: true, fields: [] },
  { table: 'refunds', title: 'Reembolsos', roles: ['administrator','finance'], readOnly: true, fields: [] },
  { table: 'stock_reservations', title: 'Reservas de estoque', roles: ['administrator','operations'], readOnly: true, fields: [] },
  { table: 'deliveries', title: 'Entregas oficiais', roles: ['administrator','operations'], fields: [
    { key: 'order_item_id', label: 'ID do item do pedido', required: true },
    { key: 'status', label: 'Status', kind: 'select', options: ['awaiting_supplier','processing','available_official_app','missing_data','delivery_issue','cancelled'], required: true },
    { key: 'supplier', label: 'Fornecedor' }, { key: 'external_reference', label: 'Referência do fornecedor' },
    { key: 'recipient_email', label: 'E-mail destinatário' }, { key: 'available_at', label: 'Disponibilizado em (ISO 8601)' },
    { key: 'instructions', label: 'Instruções de acesso', kind: 'textarea' },
  ] },
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
  const [view,setView]=useState<Record<string,unknown>|null>(null)
  const [saving,setSaving]=useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [categoryChoices, setCategoryChoices] = useState<{ id: string; name_pt: string; status: string }[]>([])
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([])
  const editing=Boolean(edit)
  useEffect(()=>{if(editing){const form=document.querySelector<HTMLFormElement>('.admin-form');form?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});form?.querySelector<HTMLInputElement>('input,select,textarea')?.focus({preventScroll:true})}},[editing])
  const key = module.key ?? 'id'
  const load = useCallback(async () => {
    if (!api) return
    const query = api.from(module.table).select('*').limit(200)
    const { data, error } = await (module.table === 'store_settings' ? query.eq('key','institutional') : query)
    setRows((data ?? []) as Record<string, unknown>[])
    if(error)setMessage(`Não foi possível carregar: ${error.message}`)
  }, [module.table])
  useEffect(() => { void load(); setEdit(null); setView(null); setSearch(''); setImportRows([]) }, [load])
  useEffect(() => { if (module.table === 'store_products' && api) void api.from('store_categories').select('id,name_pt,status').order('sort_order').then(({ data }) => setCategoryChoices((data ?? []) as Parameters<typeof setCategoryChoices>[0])) }, [module.table])
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!api || !edit || saving) return
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
    setSaving(true)
    const currentId = edit[key]
    const result = currentId
      ? await api.from(module.table).update(payload).eq(key, currentId)
      : await api.from(module.table).insert(payload)
    setSaving(false)
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
    if (!api) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setMessage('Use JPG, PNG ou WebP de até 2 MB.'); return }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `products/${crypto.randomUUID()}.${extension}`
    const { error } = await api.storage.from('ticket-rio-media').upload(path, file, { contentType: file.type, upsert: false })
    if (error) { setMessage(`Upload falhou: ${error.message}`); return }
    const { data } = api.storage.from('ticket-rio-media').getPublicUrl(path)
    setEdit((current) => current ? { ...current, image_url: data.publicUrl } : current)
    setMessage('Imagem enviada. Salve o produto para associá-la.')
  }
  const confirmImport = async () => {
    if (!api || !importRows.length || !window.confirm(`Gravar ${importRows.length} registros como rascunho?`)) return
    const { error } = await api.from(module.table).insert(importRows)
    setMessage(error ? `Importação cancelada: ${error.message}` : 'Importação concluída. Revise os registros antes de publicar.')
    if (!error) { setImportRows([]); void load() }
  }
  const visible = rows.filter((row) => !search || JSON.stringify(row).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  const columns = summaryColumns(rows,module.fields)
  const columnLabel=(column:string)=>column.endsWith('_cents')?fieldLabel(column):module.fields.find(f=>f.key===column)?.label??fieldLabel(column)
  return <section className="admin-panel"><div className="admin-panel-head"><div><span className="section-kicker">PAINEL TICKET RIO</span><h1>{module.title}</h1><p>{module.readOnly?'Consulte os registros e abra a ficha completa.':'Encontre, revise e mantenha os registros da operação.'}</p></div><div className="admin-actions">{!module.readOnly && module.table !== 'store_settings' && <button className="button" type="button" onClick={() => setEdit({})}>Novo registro</button>}<button className="secondary-button" type="button" onClick={download} disabled={!rows.length}>Exportar CSV</button></div></div>
    <label className="field">Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar registros" /></label>
    {['store_products','product_variants'].includes(module.table) && <details className="import-panel"><summary>Importar CSV com prévia</summary><p>Modelo: {module.table === 'store_products' ? 'sku,slug,name_pt,kind,summary_pt' : 'sku,product_id,name_pt,price_cents,currency'}. Sem sobrescrita; registros importados ficam indisponíveis.</p><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewCsv(file) }} />{importRows.length > 0 && <><p>Prévia de {importRows.length} registro(s): {importRows.slice(0, 3).map((row) => String(row.sku)).join(', ')}</p><button className="button" type="button" onClick={() => void confirmImport()}>Confirmar gravação</button></>}</details>}
    {message && <p role="status" className="admin-message">{message}</p>}
    {edit && <form className="admin-form" onSubmit={(event) => void save(event)}><h3>{edit[key] ? 'Editar' : 'Novo'} · {module.title}</h3>{module.fields.map((field) => <label key={field.key}>{field.label}{field.kind === 'boolean' ? <input type="checkbox" checked={Boolean(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.checked })} /> : field.kind === 'category' ? <select value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })}><option value="">Selecione a categoria</option>{categoryChoices.map((category) => <option key={category.id} value={category.id}>{category.name_pt}{category.status !== 'published' ? ' (rascunho)' : ''}</option>)}</select> : field.kind === 'select' ? <select required={field.required} value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })}><option value="">Selecione</option>{field.options?.map((option) => <option key={option} value={option}>{presentValue(field.key,option)}</option>)}</select> : field.kind === 'textarea' || field.kind === 'json' ? <textarea required={field.required} value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })} /> : <input required={field.required} type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'} value={display(edit[field.key])} onChange={(event) => setEdit({ ...edit, [field.key]: event.target.value })} />}</label>)}{module.table === 'store_products' && <label>Enviar imagem JPG, PNG ou WebP<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file) }} /></label>}<div className="admin-actions"><button className="button" type="submit" disabled={saving}>{saving?'Salvando…':'Salvar alterações'}</button><button className="secondary-button" type="button" onClick={() => setEdit(null)}>Cancelar</button></div></form>}
    {visible.length ? <div className="admin-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{columnLabel(column)}</th>)}<th>Ações</th></tr></thead><tbody>{visible.map((row, index) => <tr key={display(row[key]) || index}>{columns.map((column) => <td key={column} title={presentValue(column,row[column])}>{presentValue(column,row[column]).slice(0,90)}</td>)}<td><div className="admin-row-actions"><button className="text-button" type="button" onClick={()=>setView(row)}>Ver ficha</button>{!module.readOnly&&<button className="text-button" type="button" onClick={() => setEdit(row)}>Editar</button>}</div></td></tr>)}</tbody></table></div> : <p>Nenhum registro encontrado.</p>}
    <p className="admin-muted">{visible.length} de {rows.length} registros carregados · Até 200 registros por seção</p>{view&&<RecordDetails row={view} title={module.title} labels={Object.fromEntries(module.fields.map(f=>[f.key,f.key.endsWith('_cents')?fieldLabel(f.key):f.label]))} onClose={()=>setView(null)}/>}
  </section>
}

function Dashboard() {
  const [counts, setCounts] = useState({ orders: 0, products: 0, inquiries: 0, pendingDeliveries: 0, approvedRevenue: 0, approvedOrders: 0 })
  useEffect(() => {
    if (!api) return
    void Promise.all([
      api.from('orders').select('id', { count: 'exact', head: true }),
      api.from('store_products').select('id', { count: 'exact', head: true }),
      api.from('inquiries').select('id', { count: 'exact', head: true }),
      api.from('deliveries').select('id', { count: 'exact', head: true }).neq('status','available_official_app').neq('is_training',true),
      api.from('orders').select('total_cents').eq('payment_status','approved').neq('is_training',true),
    ]).then(([orders, products, inquiries, deliveries, revenue]) => setCounts({
      orders: orders.count ?? 0, products: products.count ?? 0, inquiries: inquiries.count ?? 0,
      pendingDeliveries: deliveries.count ?? 0,
      approvedRevenue: (revenue.data ?? []).reduce((sum, order) => sum + order.total_cents, 0),
      approvedOrders: revenue.data?.length ?? 0,
    }))
  }, [])
  return <section className="admin-panel"><span className="section-kicker">VISÃO GERAL</span><h2>Operação Ticket Rio</h2><div className="metric-grid"><div><small>Receita aprovada</small><strong>{money(counts.approvedRevenue)}</strong></div><div><small>Pedidos</small><strong>{counts.orders}</strong></div><div><small>Produtos cadastrados</small><strong>{counts.products}</strong></div><div><small>Consultas</small><strong>{counts.inquiries}</strong></div><div><small>Entregas pendentes</small><strong>{counts.pendingDeliveries}</strong></div><div><small>Ticket médio aprovado</small><strong>{counts.approvedOrders ? money(Math.round(counts.approvedRevenue / counts.approvedOrders)) : '—'}</strong></div></div><p>Ticket médio = receita de pedidos com pagamento aprovado ÷ quantidade desses pedidos.</p></section>
}

export function AdminPage({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [params, setParams] = useSearchParams()
  const [role, setRole] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [operationsOpen, setOperationsOpen] = useState(Boolean(params.get('modulo')))
  useEffect(() => {
    if (!user || !api) { setChecked(true); setRole(null); return }
    void api.from('staff_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => { setRole(data?.role ?? null); setChecked(true) })
  }, [user])
  if (!checked) return <div className="admin-loading">Verificando acesso…</div>
  if (!role) return <div className="admin-access"><h1>Acesso restrito</h1><p>Esta conta não possui função interna autorizada.</p><button onClick={onSignOut}>Sair</button></div>
  const allowed = modules.filter((module) => module.roles.includes(role))
  const selected = allowed.find((module) => module.table === params.get('modulo'))
  const section = params.get('secao') ?? (role === 'marketing' ? 'media' : null)
  const choose = (name: string) => setParams(name ? { secao: name } : {})
  return <div className="admin-layout"><aside className="admin-sidebar"><div className="admin-brand"><span>TR</span><div><strong>Ticket Rio</strong><small>Controle</small></div></div><p className="admin-sidebar-label">VISÃO</p><button className={!section && !selected ? 'admin-nav-current' : ''} type="button" onClick={() => choose('')}>Visão geral</button>{['administrator','commercial','operations','finance'].includes(role) && <button className={section === 'sales' || selected?.table === 'orders' ? 'admin-nav-current' : ''} type="button" onClick={() => choose('sales')}>Vendas</button>}{['administrator','commercial','operations','finance'].includes(role) && <button className={section === 'support' ? 'admin-nav-current' : ''} type="button" onClick={() => choose('support')}>Atendimento</button>}{['administrator','commercial'].includes(role) && <button className={section === 'crm' ? 'admin-nav-current' : ''} type="button" onClick={() => choose('crm')}>CRM de leads</button>}{['administrator','marketing'].includes(role) && <button className={section === 'media' ? 'admin-nav-current' : ''} type="button" onClick={() => choose('media')}>Mídia e campanhas</button>}{role === 'administrator' && <button className={section === 'team' ? 'admin-nav-current' : ''} type="button" onClick={() => choose('team')}>Equipe e acessos</button>}<button className="admin-sidebar-toggle" type="button" aria-expanded={operationsOpen} onClick={() => setOperationsOpen(!operationsOpen)}>OPERAÇÃO <span aria-hidden="true">{operationsOpen ? '−' : '+'}</span></button>{(operationsOpen) && allowed.filter((module) => !['inquiries','staff_roles'].includes(module.table)).map((module) => <button className={selected?.table === module.table ? 'admin-nav-current admin-module' : 'admin-module'} key={module.table} type="button" onClick={() => setParams({ modulo: module.table })}>{module.title}</button>)}<div className="admin-sidebar-bottom"><small>{user.email}<br />{presentValue('role',role)}</small><button type="button" onClick={onSignOut}>Sair da conta</button></div></aside><main className="admin-content"><header className="admin-topbar"><span>PAINEL ADMINISTRATIVO</span><a href="/" target="_blank" rel="noreferrer">Abrir loja ↗</a></header><Suspense fallback={<p>Carregando seção…</p>}>{(section === 'sales' || selected?.table === 'orders') && ['administrator','commercial','operations','finance'].includes(role) ? <Sales /> : section === 'support' && ['administrator','commercial','operations','finance'].includes(role) ? <Support user={user} /> : section === 'crm' && ['administrator','commercial'].includes(role) ? <CRM user={user} /> : section === 'media' && ['administrator','marketing'].includes(role) ? <Media user={user} /> : section === 'team' && role === 'administrator' ? <Team user={user} /> : selected ? <AdminTable module={selected} /> : <Dashboard />}</Suspense></main></div>
}
