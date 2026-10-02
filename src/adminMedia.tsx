import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { money, supabase } from './store'

type Row = { utm_source: string; utm_campaign: string; spend_cents: number; leads: number; approved_orders: number; revenue_cents: number }
type Spend = { id: string; spend_date: string; utm_source: string; utm_campaign: string; amount_cents: number; notes: string | null }
const localDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const today = () => localDate(new Date())
const monthAgo = () => localDate(new Date(Date.now() - 29 * 86400_000))

export default function Media({ user }: { user: User }) {
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<Row[]>([])
  const [spend, setSpend] = useState<Spend[]>([])
  const [message, setMessage] = useState('')
  const [source, setSource] = useState('google')
  const [campaign, setCampaign] = useState('')
  const [landing, setLanding] = useState('/ingressos')
  const load = useCallback(async () => {
    if (!supabase || !from || !to) return
    const [report, entries] = await Promise.all([
      supabase.rpc('media_performance', { from_date: from, to_date: to }),
      supabase.from('media_spend_daily').select('id,spend_date,utm_source,utm_campaign,amount_cents,notes').gte('spend_date', from).lte('spend_date', to).order('spend_date', { ascending: false }).limit(200),
    ])
    setRows((report.data ?? []) as Row[]); setSpend((entries.data ?? []) as Spend[])
    if (report.error || entries.error) setMessage(`Não foi possível carregar mídia: ${report.error?.message ?? entries.error?.message}`)
  }, [from, to])
  useEffect(() => { void load() }, [load])
  const total = useMemo(() => rows.reduce((sum, row) => ({ spend: sum.spend + Number(row.spend_cents), leads: sum.leads + Number(row.leads), orders: sum.orders + Number(row.approved_orders), revenue: sum.revenue + Number(row.revenue_cents) }), { spend: 0, leads: 0, orders: 0, revenue: 0 }), [rows])
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return
    const form = new FormData(event.currentTarget)
    const amount = Math.round(Number(form.get('amount')) * 100)
    if (!Number.isSafeInteger(amount) || amount < 0) { setMessage('Informe um valor válido.'); return }
    const { error } = await supabase.from('media_spend_daily').insert({
      spend_date: String(form.get('date')), utm_source: String(form.get('source')).trim().toLowerCase(),
      utm_campaign: String(form.get('campaign')).trim().toLowerCase(), amount_cents: amount,
      notes: String(form.get('notes') ?? '').trim() || null, created_by: user.id,
    })
    setMessage(error ? `Não foi possível salvar: ${error.message}` : 'Investimento registrado.')
    if (!error) { event.currentTarget.reset(); void load() }
  }
  const remove = async (id: string) => {
    if (!supabase || !window.confirm('Excluir este lançamento de investimento?')) return
    const { error } = await supabase.from('media_spend_daily').delete().eq('id', id)
    setMessage(error ? `Não foi possível excluir: ${error.message}` : 'Lançamento excluído.')
    if (!error) void load()
  }
  const link = useMemo(() => {
    const url = new URL(landing.startsWith('/') ? landing : '/ingressos', window.location.origin)
    if (source.trim()) url.searchParams.set('utm_source', source.trim().toLowerCase())
    url.searchParams.set('utm_medium', 'paid')
    if (campaign.trim()) url.searchParams.set('utm_campaign', campaign.trim().toLowerCase())
    return url.href
  }, [source, campaign, landing])
  return <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">AQUISIÇÃO</span><h1>Mídia e campanhas</h1><p>Investimento manual e resultados observados por UTM.</p></div><div className="admin-period"><label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div></div>{message && <p className="admin-message" role="status">{message}</p>}<div className="admin-stat-row admin-stat-row--four"><div><small>Investido</small><strong>{money(total.spend)}</strong></div><div><small>Leads com UTM</small><strong>{total.leads}</strong></div><div><small>Vendas aprovadas com UTM</small><strong>{total.orders}</strong></div><div><small>Receita atribuída</small><strong>{money(total.revenue)}</strong></div></div><div className="admin-media-grid"><div className="admin-card"><h2>Desempenho por campanha</h2><p className="admin-muted">CPL = investimento ÷ leads. ROAS = receita aprovada ÷ investimento. Pedidos sem UTM não são atribuídos.</p><div className="admin-table-wrap"><table><thead><tr><th>Origem / campanha</th><th>Investido</th><th>Leads</th><th>CPL</th><th>Vendas</th><th>Receita</th><th>ROAS</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.utm_source}/${row.utm_campaign}`}><td><strong>{row.utm_source}</strong><br />{row.utm_campaign}</td><td>{money(Number(row.spend_cents))}</td><td>{row.leads}</td><td>{Number(row.leads) ? money(Math.round(Number(row.spend_cents) / Number(row.leads))) : '—'}</td><td>{row.approved_orders}</td><td>{money(Number(row.revenue_cents))}</td><td>{Number(row.spend_cents) ? `${(Number(row.revenue_cents) / Number(row.spend_cents)).toFixed(2)}×` : '—'}</td></tr>)}</tbody></table>{!rows.length && <div className="admin-empty">Nenhuma campanha registrada no período.</div>}</div></div><div className="admin-card"><h2>Lançar investimento</h2><form className="admin-grid-form" onSubmit={(event) => void add(event)}><label>Data<input type="date" name="date" defaultValue={today()} required /></label><label>Origem UTM<input name="source" required maxLength={80} placeholder="google, meta..." /></label><label>Campanha UTM<input name="campaign" required maxLength={120} placeholder="carnaval-2027" /></label><label>Valor (R$)<input name="amount" type="number" min="0" step="0.01" required /></label><label>Observação<input name="notes" maxLength={500} /></label><button className="admin-primary">Salvar investimento</button></form></div></div><div className="admin-media-grid"><div className="admin-card"><h2>Links com UTM</h2><div className="admin-grid-form"><label>Origem<input value={source} onChange={(event) => setSource(event.target.value)} /></label><label>Campanha<input value={campaign} onChange={(event) => setCampaign(event.target.value)} /></label><label>Destino<select value={landing} onChange={(event) => setLanding(event.target.value)}><option value="/ingressos">Ingressos</option><option value="/camarotes">Camarotes</option><option value="/transfers">Transfers</option><option value="/city-tours">Rio City Tour</option></select></label></div><div className="admin-link-output"><code>{link}</code><button type="button" onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage('Link copiado.'))}>Copiar</button></div><p className="admin-muted">A atribuição é registrada quando o visitante permite cookies de publicidade.</p></div><div className="admin-card"><h2>Lançamentos recentes</h2>{spend.length ? <div className="admin-spend-list">{spend.map((entry) => <div key={entry.id}><span><strong>{entry.utm_source} / {entry.utm_campaign}</strong><small>{new Date(`${entry.spend_date}T12:00:00`).toLocaleDateString('pt-BR')} · {entry.notes || 'Sem observação'}</small></span><strong>{money(entry.amount_cents)}</strong><button type="button" onClick={() => void remove(entry.id)} aria-label="Excluir lançamento">Excluir</button></div>)}</div> : <p className="admin-muted">Sem investimentos lançados no período.</p>}</div></div></section>
}
