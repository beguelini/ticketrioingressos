import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { money, supabase } from './store'

type Lead = { id: string; name: string; email: string; phone: string | null; message: string; stage: string; assigned_to: string | null; next_followup_at: string | null; estimated_value_cents: number | null; utm_source: string | null; utm_campaign: string | null; created_at: string }
type Activity = { id: string; actor_id: string; note: string; created_at: string }
type Staff = { user_id: string; email: string | null; role: string }
const stages = ['new','contacted','qualified','proposal','won','lost']
const labels: Record<string,string> = { new: 'Novo', contacted: 'Contato feito', qualified: 'Qualificado', proposal: 'Proposta', won: 'Ganho', lost: 'Perdido' }

export default function CRM({ user }: { user: User }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    if (!supabase) return
    const [{ data, error }, staffResult] = await Promise.all([
      supabase.from('inquiries').select('id,name,email,phone,message,stage,assigned_to,next_followup_at,estimated_value_cents,utm_source,utm_campaign,created_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('staff_roles').select('user_id,email,role').in('role', ['administrator','commercial']),
    ])
    setLeads((data ?? []) as Lead[]); setStaff((staffResult.data ?? []) as Staff[])
    if (error) setMessage(`Não foi possível carregar os leads: ${error.message}`)
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!selected || !supabase) return
    void supabase.from('crm_activities').select('id,actor_id,note,created_at').eq('inquiry_id', selected).order('created_at', { ascending: false }).limit(100).then(({ data }) => setActivities((data ?? []) as Activity[]))
  }, [selected])
  const update = async (id: string, change: Partial<Lead>) => {
    if (!supabase) return
    const { error } = await supabase.from('inquiries').update({ ...change, updated_at: new Date().toISOString() }).eq('id', id)
    setMessage(error ? `Não foi possível salvar: ${error.message}` : 'Lead atualizado.')
    if (!error) {
      void load()
      const history = await supabase.from('crm_activities').select('id,actor_id,note,created_at').eq('inquiry_id', id).order('created_at', { ascending: false }).limit(100)
      setActivities((history.data ?? []) as Activity[])
    }
  }
  const addLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return
    const form = new FormData(event.currentTarget)
    const { error } = await supabase.from('inquiries').insert({
      name: String(form.get('name') ?? '').trim(), email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(), message: String(form.get('message') ?? '').trim(),
      stage: 'new', assigned_to: user.id,
    })
    setMessage(error ? `Não foi possível cadastrar: ${error.message}` : 'Lead cadastrado.')
    if (!error) { setCreating(false); void load() }
  }
  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !selected || !note.trim()) return
    const { error } = await supabase.from('crm_activities').insert({ inquiry_id: selected, actor_id: user.id, note: note.trim() })
    setMessage(error ? `Não foi possível salvar a anotação: ${error.message}` : 'Anotação registrada.')
    if (!error) { setNote(''); const { data } = await supabase.from('crm_activities').select('id,actor_id,note,created_at').eq('inquiry_id', selected).order('created_at', { ascending: false }).limit(100); setActivities((data ?? []) as Activity[]) }
  }
  const visible = leads.filter((lead) => (filter === 'all' || lead.stage === filter) && (!query || `${lead.name} ${lead.email} ${lead.phone ?? ''} ${lead.utm_campaign ?? ''}`.toLowerCase().includes(query.toLowerCase())))
  const current = leads.find((lead) => lead.id === selected)
  const due = leads.filter((lead) => lead.next_followup_at && !['won','lost'].includes(lead.stage) && new Date(lead.next_followup_at).getTime() <= Date.now()).length
  return <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">RELACIONAMENTO</span><h1>CRM de leads</h1><p>Acompanhe conversas, oportunidades e próximos contatos.</p></div><button className="admin-primary" onClick={() => setCreating(!creating)}>{creating ? 'Fechar' : '+ Novo lead'}</button></div><div className="admin-stat-row"><div><small>Leads</small><strong>{leads.length}</strong></div><div><small>Em negociação</small><strong>{leads.filter((lead) => ['qualified','proposal'].includes(lead.stage)).length}</strong></div><div><small>Contatos vencidos</small><strong>{due}</strong></div></div>{message && <p className="admin-message" role="status">{message}</p>}{creating && <form className="admin-card admin-grid-form" onSubmit={(event) => void addLead(event)}><h2>Novo lead</h2><label>Nome<input name="name" required maxLength={120} /></label><label>E-mail<input name="email" type="email" required maxLength={254} /></label><label>Telefone<input name="phone" type="tel" maxLength={30} /></label><label>Contexto<textarea name="message" required maxLength={4000} /></label><button className="admin-primary" type="submit">Cadastrar lead</button></form>}<div className="admin-filterbar"><input type="search" aria-label="Buscar leads" placeholder="Buscar nome, e-mail, telefone ou campanha" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filtrar etapa" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas as etapas</option>{stages.map((stage) => <option key={stage} value={stage}>{labels[stage]}</option>)}</select></div><div className="admin-crm-layout"><div className="admin-lead-list">{visible.length ? visible.map((lead) => <button key={lead.id} className={`admin-lead ${lead.id === selected ? 'is-selected' : ''}`} onClick={() => setSelected(lead.id)}><span><strong>{lead.name}</strong><em className={`admin-stage stage-${lead.stage}`}>{labels[lead.stage]}</em></span><small>{lead.email} · {new Date(lead.created_at).toLocaleDateString('pt-BR')}</small><small>{lead.utm_campaign ? `${lead.utm_source ?? 'Origem'} / ${lead.utm_campaign}` : 'Origem não informada'}</small></button>) : <div className="admin-empty">Nenhum lead encontrado.</div>}</div><div className="admin-card admin-lead-detail">{current ? <><div className="admin-panel-head"><div><h2>{current.name}</h2><a href={`mailto:${current.email}`}>{current.email}</a>{current.phone && <p>{current.phone}</p>}</div><span className={`admin-stage stage-${current.stage}`}>{labels[current.stage]}</span></div><p className="admin-lead-message">{current.message}</p><div className="admin-grid-form"><label>Etapa<select value={current.stage} onChange={(event) => void update(current.id, { stage: event.target.value })}>{stages.map((stage) => <option key={stage} value={stage}>{labels[stage]}</option>)}</select></label><label>Responsável<select value={current.assigned_to ?? ''} onChange={(event) => void update(current.id, { assigned_to: event.target.value || null })}><option value="">Sem responsável</option>{staff.map((person) => <option key={person.user_id} value={person.user_id}>{person.email ?? person.user_id}</option>)}</select></label><label>Próximo contato<input type="datetime-local" key={`${current.id}-followup`} defaultValue={current.next_followup_at ? new Date(current.next_followup_at).toISOString().slice(0,16) : ''} onBlur={(event) => { const value = event.target.value ? new Date(event.target.value).toISOString() : null; if (value !== current.next_followup_at) void update(current.id, { next_followup_at: value }) }} /></label><label>Valor estimado (R$)<input type="number" min="0" step="0.01" key={`${current.id}-value`} defaultValue={current.estimated_value_cents == null ? '' : current.estimated_value_cents / 100} onBlur={(event) => { const value = event.target.value ? Math.round(Number(event.target.value) * 100) : null; if (value !== current.estimated_value_cents) void update(current.id, { estimated_value_cents: value }) }} /></label></div>{current.estimated_value_cents != null && <p>Potencial: <strong>{money(current.estimated_value_cents)}</strong></p>}<h3>Histórico</h3><form onSubmit={(event) => void addNote(event)} className="admin-note-form"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} required placeholder="Registre a conversa ou a próxima ação" /><button className="admin-primary">Adicionar nota</button></form><div className="admin-timeline">{activities.map((activity) => <div key={activity.id}><small>{new Date(activity.created_at).toLocaleString('pt-BR')} · {staff.find((person) => person.user_id === activity.actor_id)?.email ?? 'Equipe'}</small><p>{activity.note}</p></div>)}{!activities.length && <p>Sem anotações ainda.</p>}</div></> : <div className="admin-empty">Selecione um lead para ver os detalhes.</div>}</div></div></section>
}
