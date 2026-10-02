import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './store'

type Conversation = { id: string; topic_id: string; agent_key: string; queue_role: string; product_id: string | null; inquiry_id: string | null; customer_name: string; customer_email: string; status: string; assigned_to: string | null; created_at: string; last_message_at: string; last_customer_message_at: string; last_staff_read_at: string | null }
type Topic = { id: string; category_pt: string; title_pt: string; agent_key: string; active: boolean }
type Agent = { agent_key: string; name: string; queue_role: string; scope: string; guardrails: string; automation_status: string }
type Member = { user_id: string; email: string; role: string }
type Message = { id: string; sender_type: 'visitor' | 'staff'; sender_id: string | null; body: string; created_at: string }
type Thread = { conversation: Conversation; messages: Message[]; product: { name_pt: string; slug: string } | null }
type ListData = { role: string; conversations: Conversation[]; topics: Topic[]; agents: Agent[]; members: Member[] }
const roleNames: Record<string, string> = { administrator: 'Privacidade / administração', commercial: 'Comercial', operations: 'Operação', finance: 'Financeiro' }
const statusNames: Record<string, string> = { waiting_staff: 'Aguardando equipe', waiting_customer: 'Aguardando cliente', closed: 'Encerrada' }
const when = (date: string) => new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function AdminSupport({ user }: { user: User }) {
  const [list, setList] = useState<ListData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [queue, setQueue] = useState('all')
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAgents, setShowAgents] = useState(false)
  const loadList = useCallback(async (quiet = false) => {
    if (!supabase) return
    const { data, error: loadError } = await supabase.functions.invoke('support-staff', { body: { action: 'list' } })
    if (loadError || !data?.conversations) { if (!quiet) setError('Não foi possível carregar a fila. Tente atualizar.'); return }
    setList(data as ListData)
    if (!quiet) setError('')
  }, [])
  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!supabase) return
    const { data, error: loadError } = await supabase.functions.invoke('support-staff', { body: { action: 'thread', id } })
    if (loadError || !data?.messages) { if (!quiet) setError('Não foi possível carregar a conversa.'); return }
    setThread(data as Thread)
    if (!quiet) setError('')
  }, [])
  useEffect(() => { void loadList(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadList(true) }, 15000); return () => window.clearInterval(timer) }, [loadList])
  useEffect(() => { if (!selected) return; void loadThread(selected); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadThread(selected, true) }, 10000); return () => window.clearInterval(timer) }, [selected, loadThread])
  const visible = useMemo(() => (list?.conversations ?? []).filter((item) => (queue === 'all' || item.queue_role === queue) && (filter === 'all' || (filter === 'open' ? item.status !== 'closed' : item.status === filter)) && `${item.customer_name} ${item.customer_email} ${item.topic_id}`.toLowerCase().includes(search.toLowerCase().trim())), [list, queue, filter, search])
  const topicName = (id: string) => list?.topics.find((item) => item.id === id)?.title_pt ?? id
  const agentName = (id: string) => list?.agents.find((item) => item.agent_key === id)?.name ?? id
  const memberName = (id: string | null) => id ? list?.members.find((item) => item.user_id === id)?.email ?? 'Atendente' : 'Não atribuído'
  const mutate = async (action: string, extra: Record<string, unknown>) => {
    if (!supabase || !selected || busy) return
    setBusy(true); setError('')
    const { data, error: writeError } = await supabase.functions.invoke('support-staff', { body: { action, id: selected, ...extra } })
    setBusy(false)
    if (writeError || !data?.ok) { setError('A alteração não foi salva. Confira a fila e tente novamente.'); return }
    await Promise.all([loadList(true), loadThread(selected, true)])
  }
  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.trim()) return
    if (!supabase || !selected || busy) return
    setBusy(true); setError('')
    const { data, error: writeError } = await supabase.functions.invoke('support-staff', { body: { action: 'reply', id: selected, message: draft.trim() } })
    setBusy(false)
    if (writeError || !data?.ok) { setError('Resposta não enviada. Tente novamente.'); return }
    setDraft('')
    await Promise.all([loadList(true), loadThread(selected, true)])
  }
  const current = thread?.conversation.id === selected ? thread : null
  const unread = (item: Conversation) => item.status === 'waiting_staff' && (!item.last_staff_read_at || item.last_customer_message_at > item.last_staff_read_at)
  return <section className="admin-support"><div className="admin-panel-head"><div><span className="section-kicker">ATENDIMENTO HUMANO</span><h2>Conversas da loja</h2><p>Dúvidas chegam à fila da especialidade. A equipe responde aqui; agentes de IA estão apenas planejados.</p></div><button className="secondary-button" type="button" onClick={() => void loadList()}>Atualizar</button></div>
    <div className="admin-support-metrics"><div><strong>{(list?.conversations ?? []).filter((item) => item.status === 'waiting_staff').length}</strong><span>Aguardando equipe</span></div><div><strong>{(list?.conversations ?? []).filter((item) => unread(item)).length}</strong><span>Novas mensagens</span></div><div><strong>{(list?.conversations ?? []).filter((item) => item.status === 'waiting_customer').length}</strong><span>Aguardando cliente</span></div><div><strong>{(list?.conversations ?? []).filter((item) => item.status === 'closed').length}</strong><span>Encerradas</span></div></div>
    <div className="admin-support-controls"><label>Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail ou assunto" /></label>{list?.role === 'administrator' && <label>Fila<select value={queue} onChange={(event) => setQueue(event.target.value)}><option value="all">Todas as filas</option>{Object.entries(roleNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">Em andamento</option><option value="waiting_staff">Aguardando equipe</option><option value="waiting_customer">Aguardando cliente</option><option value="closed">Encerradas</option><option value="all">Todos</option></select></label></div>
    <div className="admin-support-workspace"><div className="admin-support-list" aria-label="Fila de conversas">{!list ? <p className="admin-support-empty">Carregando conversas…</p> : visible.length === 0 ? <p className="admin-support-empty">Nenhuma conversa nesta seleção.</p> : visible.map((item) => <button key={item.id} type="button" className={selected === item.id ? 'admin-support-item admin-support-item--active' : 'admin-support-item'} onClick={() => { setSelected(item.id); setThread(null); setDraft('') }}><span className="admin-support-item-top"><strong>{item.customer_name}</strong><small>{when(item.last_message_at)}</small></span><span>{topicName(item.topic_id)}</span><small>{roleNames[item.queue_role]} · {statusNames[item.status]}{unread(item) ? ' · Nova mensagem' : ''}</small></button>)}</div>
      <div className="admin-support-thread">{!selected ? <div className="admin-support-empty">Selecione uma conversa para responder.</div> : !current ? <div className="admin-support-empty">Carregando conversa…</div> : <><header><div><span className="section-kicker">{roleNames[current.conversation.queue_role]}</span><h3>{current.conversation.customer_name}</h3><a href={`mailto:${encodeURIComponent(current.conversation.customer_email)}`}>{current.conversation.customer_email}</a><small>{topicName(current.conversation.topic_id)} · {agentName(current.conversation.agent_key)}</small>{current.product && <a href={`/produto/${current.product.slug}`} target="_blank" rel="noreferrer">Produto: {current.product.name_pt} ↗</a>}{current.conversation.inquiry_id && <small>Lead vinculado ao CRM</small>}</div><span className="admin-support-status">{statusNames[current.conversation.status]}</span></header>
        <div className="admin-support-actions"><label>Responsável<select value={current.conversation.assigned_to ?? ''} disabled={busy} onChange={(event) => void mutate('assign', { assigned_to: event.target.value || null })}><option value="">Não atribuído</option>{(list?.members ?? []).filter((item) => item.role === current.conversation.queue_role || item.role === 'administrator').map((item) => <option value={item.user_id} key={item.user_id}>{item.email}</option>)}</select></label>{list?.role === 'administrator' && <label>Assunto / fila<select value={current.conversation.topic_id} disabled={busy} onChange={(event) => void mutate('reroute', { topic_id: event.target.value })}>{(list?.topics ?? []).filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.category_pt} · {item.title_pt}</option>)}</select></label>}<button type="button" disabled={busy} onClick={() => void mutate('status', { status: current.conversation.status === 'closed' ? 'waiting_staff' : 'closed' })}>{current.conversation.status === 'closed' ? 'Reabrir' : 'Encerrar'}</button></div>
        <div className="admin-support-history" role="log" aria-live="polite">{current.messages.map((item) => <div className={item.sender_type === 'staff' ? 'admin-support-message admin-support-message--staff' : 'admin-support-message'} key={item.id}><strong>{item.sender_type === 'staff' ? item.sender_id === user.id ? 'Você' : memberName(item.sender_id) : current.conversation.customer_name}</strong><p>{item.body}</p><small>{when(item.created_at)}</small></div>)}</div>
        <form className="admin-support-reply" onSubmit={(event) => void reply(event)}><label htmlFor="admin-support-draft">Resposta ao cliente</label><textarea id="admin-support-draft" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Escreva uma resposta clara e confirme os dados antes de prometer algo ao cliente." /><div><small>Não solicite senhas, códigos ou dados completos de cartão.</small><button className="button" type="submit" disabled={busy || !draft.trim()}>{busy ? 'Enviando…' : 'Enviar resposta'}</button></div></form></>}</div></div>
    {error && <p className="admin-support-error" role="alert">{error}</p>}
    <div className="admin-support-agents"><button type="button" onClick={() => setShowAgents(!showAgents)} aria-expanded={showAgents}>{showAgents ? 'Ocultar' : 'Ver'} especialidades planejadas para IA ({list?.agents.length ?? 0})</button>{showAgents && <div>{(list?.agents ?? []).map((agent) => <article key={agent.agent_key}><strong>{agent.name}</strong><small>Fila humana: {roleNames[agent.queue_role]} · IA {agent.automation_status === 'planned' ? 'ainda não ativa' : agent.automation_status}</small><p>{agent.scope}</p><p><b>Limites:</b> {agent.guardrails}</p></article>)}</div>}</div>
  </section>
}
