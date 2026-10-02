import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { getAttribution } from './attribution'
import { supabase } from './store'
import { useStore } from './storeContext'
import './support.css'

type Topic = { id: string; category_key: string; category_pt: string; category_en: string; title_pt: string; title_en: string; example_pt: string; example_en: string; sort_order: number }
type SavedChat = { id: string; token: string; title: string; category: string; created_at: string }
type Message = { id: string; sender_type: 'visitor' | 'staff'; body: string; created_at: string }
type Step = 'home' | 'categories' | 'topics' | 'compose' | 'thread'
const storageKey = 'ticket-rio-support-sessions-v1'
const readSaved = (): SavedChat[] => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown
    return Array.isArray(value) ? value.filter((item): item is SavedChat => typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.token === 'string' && typeof item.title === 'string').slice(0, 8) : []
  } catch { return [] }
}

export default function SupportChat({ onClose }: { onClose: () => void }) {
  const { language, user, products } = useStore()
  const en = language === 'en'
  const t = useCallback((pt: string, english: string) => en ? english : pt, [en])
  const [topics, setTopics] = useState<Topic[]>([])
  const [saved, setSaved] = useState<SavedChat[]>(readSaved)
  const [active, setActive] = useState<SavedChat | null>(null)
  const [step, setStep] = useState<Step>(() => readSaved().length ? 'home' : 'categories')
  const [category, setCategory] = useState<string | null>(null)
  const [topic, setTopic] = useState<Topic | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [productId, setProductId] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState('waiting_staff')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingTopics, setLoadingTopics] = useState(true)
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(saved)) }, [saved])
  useEffect(() => {
    if (!supabase) { setLoadingTopics(false); setError(t('Atendimento indisponível agora.', 'Support is unavailable right now.')); return }
    void supabase.from('support_topics').select('id,category_key,category_pt,category_en,title_pt,title_en,example_pt,example_en,sort_order').eq('active', true).order('sort_order').then(({ data, error: loadError }) => {
      setTopics((data ?? []) as Topic[])
      setLoadingTopics(false)
      if (loadError) setError(t('Não foi possível carregar os assuntos.', 'Could not load support topics.'))
    })
  }, [t])
  const categories = useMemo(() => topics.filter((item, index, all) => all.findIndex((candidate) => candidate.category_key === item.category_key) === index), [topics])
  const productsForTopic = useMemo(() => {
    const kinds: Record<string,string[]> = { tickets: ['ticket'], lounges: ['package'], mobility: ['transfer','metro'], tours: ['tour'], shop: ['apparel'] }
    const allowed = kinds[topic?.category_key ?? '']
    return products.filter((product) => product.status === 'published' && (!allowed || allowed.includes(product.kind))).slice(0, 80)
  }, [products, topic])
  const refresh = useCallback(async (session: SavedChat) => {
    if (!supabase || document.visibilityState === 'hidden') return
    const { data, error: loadError } = await supabase.functions.invoke('support-visitor', { body: { action: 'thread', id: session.id, token: session.token } })
    if (loadError || !data?.messages) { setError('Não foi possível carregar a conversa. Tente novamente.'); return }
    setMessages(data.messages as Message[])
    setStatus(String(data.status ?? 'waiting_staff'))
  }, [])
  useEffect(() => {
    if (step !== 'thread' || !active) return
    void refresh(active)
    const interval = window.setInterval(() => void refresh(active), 10000)
    return () => window.clearInterval(interval)
  }, [step, active, refresh])
  const begin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !topic || busy) return
    setBusy(true); setError('')
    const message = draft.trim()
    const { data, error: createError } = await supabase.functions.invoke('support-visitor', { body: {
      action: 'start', topic_id: topic.id, product_id: productId || null, name: name.trim(), email: email.trim(),
      message, attribution: getAttribution(), website: String(new FormData(event.currentTarget).get('website') ?? ''),
    } })
    setBusy(false)
    if (createError || !data?.id || !data?.token) { setError(t('Não foi possível iniciar a conversa. Tente novamente ou escreva para atendimento@ticketrio.com.br.', 'Could not start the conversation. Try again or email atendimento@ticketrio.com.br.')); return }
    const session: SavedChat = { id: data.id, token: data.token, title: en ? topic.title_en : topic.title_pt, category: en ? topic.category_en : topic.category_pt, created_at: data.created_at }
    setSaved((old) => [session, ...old].slice(0, 8))
    setActive(session); setStep('thread'); setDraft('')
  }
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !active || busy || !draft.trim()) return
    setBusy(true); setError('')
    const { data, error: sendError } = await supabase.functions.invoke('support-visitor', { body: { action: 'send', id: active.id, token: active.token, message: draft.trim() } })
    setBusy(false)
    if (sendError || !data?.ok) { setError(t('Mensagem não enviada. Aguarde um momento e tente novamente.', 'Message not sent. Please try again shortly.')); return }
    setDraft(''); void refresh(active)
  }
  const remove = (session: SavedChat) => {
    if (!window.confirm(t('Remover o acesso a esta conversa deste navegador? O histórico continuará com a equipe.', 'Remove access to this conversation from this browser? The team will retain the history.'))) return
    setSaved((old) => old.filter((item) => item.id !== session.id))
    if (active?.id === session.id) { setActive(null); setStep('home') }
  }
  const back = () => {
    setError('')
    if (step === 'compose') setStep('topics')
    else if (step === 'topics') setStep('categories')
    else if (step === 'categories') setStep('home')
    else if (step === 'thread') { setActive(null); setStep('home') }
  }
  return <section className="support-panel support-panel--real" aria-label={t('Atendimento Ticket Rio', 'Ticket Rio support')}>
    <div className="support-panel__header"><span className="support-chat-mark" aria-hidden="true">TR</span><div><strong>{t('Atendimento Ticket Rio', 'Ticket Rio support')}</strong><small>{t('Uma pessoa da equipe responderá aqui', 'A team member will reply here')}</small></div><button type="button" onClick={onClose} aria-label={t('Fechar atendimento', 'Close support')}>×</button></div>
    <div className="support-chat-body">
      {step !== 'home' && <button className="support-back" type="button" onClick={back}>← {t('Voltar', 'Back')}</button>}
      {step === 'home' && <><div className="support-intro"><span>{t('COMO PODEMOS AJUDAR?', 'HOW CAN WE HELP?')}</span><h2>{t('Conte com a nossa equipe.', 'Our team is here for you.')}</h2><p>{t('Escolha um assunto para falar com a pessoa certa.', 'Choose a topic to reach the right team.')}</p></div><button className="support-primary" type="button" onClick={() => { setCategory(null); setTopic(null); setStep('categories') }}>{t('Nova dúvida', 'New question')} →</button>{saved.length > 0 && <div className="support-saved"><h3>{t('Suas conversas neste navegador', 'Your conversations on this browser')}</h3>{saved.map((session) => <div key={session.id}><button type="button" onClick={() => { setActive(session); setStep('thread'); setError('') }}><strong>{session.title}</strong><small>{session.category} · {new Date(session.created_at).toLocaleDateString(en ? 'en-US' : 'pt-BR')}</small></button><button className="support-remove" type="button" onClick={() => remove(session)} aria-label={t('Remover acesso salvo', 'Remove saved access')}>×</button></div>)}</div>}</>}
      {step === 'categories' && <><div className="support-intro"><span>{t('PRIMEIRO PASSO', 'FIRST STEP')}</span><h2>{t('Sobre o que é sua dúvida?', 'What is your question about?')}</h2></div>{loadingTopics ? <p>{t('Carregando assuntos…', 'Loading topics…')}</p> : <div className="support-choice-list">{categories.map((item) => <button key={item.category_key} type="button" onClick={() => { setCategory(item.category_key); setStep('topics') }}><strong>{en ? item.category_en : item.category_pt}</strong><span>→</span></button>)}</div>}</>}
      {step === 'topics' && <><div className="support-intro"><span>{t('ESCOLHA O ASSUNTO', 'CHOOSE A TOPIC')}</span><h2>{en ? categories.find((item) => item.category_key === category)?.category_en : categories.find((item) => item.category_key === category)?.category_pt}</h2></div><div className="support-choice-list">{topics.filter((item) => item.category_key === category).map((item) => <button key={item.id} type="button" onClick={() => { setTopic(item); setProductId(''); setDraft(''); setStep('compose') }}><strong>{en ? item.title_en : item.title_pt}</strong><small>{en ? item.example_en : item.example_pt}</small><span>→</span></button>)}</div></>}
      {step === 'compose' && topic && <><div className="support-intro"><span>{t('FALE COM A EQUIPE', 'TALK TO OUR TEAM')}</span><h2>{en ? topic.title_en : topic.title_pt}</h2><p>{t('Sua mensagem será encaminhada à especialidade correta. O atendimento é humano.', 'Your message will reach the right specialist. Support is handled by people.')}</p></div><form className="support-start-form" onSubmit={(event) => void begin(event)}><label>{t('Seu nome', 'Your name')}<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required autoComplete="name" /></label><label>{t('E-mail para identificação', 'Email for identification')}<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={254} required autoComplete="email" /></label>{productsForTopic.length > 0 && <label>{t('Produto relacionado (opcional)', 'Related product (optional)')}<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">{t('Não se aplica / não sei', 'Not applicable / not sure')}</option>{productsForTopic.map((product) => <option key={product.id} value={product.id}>{en && product.name_en ? product.name_en : product.name_pt}</option>)}</select></label>}<label>{t('Sua pergunta', 'Your question')}<textarea value={draft} onChange={(event) => setDraft(event.target.value)} minLength={5} maxLength={2000} required placeholder={en ? topic.example_en : topic.example_pt} /></label><input className="support-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><p className="support-privacy">{t('Não envie senha, código de acesso ou dados de cartão. Sua conversa ficará disponível neste navegador.', 'Do not send passwords, access codes or card details. Your conversation will remain available in this browser.')} <Link to="/politica-de-privacidade" target="_blank">{t('Privacidade', 'Privacy')}</Link>.</p><button className="support-primary" disabled={busy}>{busy ? t('Enviando…', 'Sending…') : t('Enviar à equipe', 'Send to the team')}</button></form></>}
      {step === 'thread' && active && <><div className="support-thread-heading"><span>{active.category}</span><h2>{active.title}</h2><p>{status === 'closed' ? t('Conversa encerrada. Você pode enviar outra mensagem para reabrir.', 'Conversation closed. Send another message to reopen it.') : status === 'waiting_customer' ? t('A equipe respondeu. Você pode continuar por aqui.', 'The team has replied. You can continue here.') : t('Mensagem enviada. A equipe responderá por aqui.', 'Message sent. Our team will reply here.')}</p></div><div className="support-thread-messages" role="log" aria-live="polite">{messages.map((item) => <div key={item.id} className={item.sender_type === 'visitor' ? 'support-bubble support-bubble--visitor' : 'support-bubble support-bubble--staff'}><strong>{item.sender_type === 'visitor' ? t('Você', 'You') : 'Ticket Rio'}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString(en ? 'en-US' : 'pt-BR')}</small></div>)}</div></>}
      {error && <p className="support-error" role="alert">{error}</p>}
    </div>
    {step === 'thread' && active && <form className="support-panel__form support-reply-form" onSubmit={(event) => void send(event)}><label className="sr-only" htmlFor="support-message">{t('Mensagem', 'Message')}</label><input id="support-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={t('Escreva sua mensagem', 'Write your message')} /><button type="submit" disabled={busy || !draft.trim()} aria-label={t('Enviar mensagem', 'Send message')}>➜</button></form>}
  </section>
}
