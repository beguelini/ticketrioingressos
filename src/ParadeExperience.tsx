import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from './store'
import { useStore } from './storeContext'
import './parade.css'

type ParadeDate = {
  id: string
  event_date: string
  parade_group: string
  starts_at?: string | null
}

type ParadeEntry = {
  id: string
  event_date_id: string
  parade_order: number
  expected_at: string | null
  parade_schools: { name: string } | null
}

const formatDate = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', options)

const dayCopy = (group: string) => group === 'Série Ouro'
  ? 'A abertura da festa na Sapucaí.'
  : group === 'Campeãs'
    ? 'A noite para celebrar as vencedoras.'
    : 'O grande espetáculo da avenida.'

export function ParadeHomeSection({ dates }: { dates: ParadeDate[] }) {
  if (!dates.length) return null
  return <section className="parade-home" aria-labelledby="parade-home-title">
    <div className="section parade-home__inner">
      <div className="parade-home__intro">
        <div><span className="parade-eyebrow"><i aria-hidden="true" /> DATAS DOS DESFILES · 2027</span><h2 id="parade-home-title">Cada noite tem<br /><em>seu momento.</em></h2><p>Da Série Ouro ao desfile das Campeãs, encontre a data que faz seu coração bater no ritmo da Sapucaí.</p></div>
        <Link className="parade-home__all" to="/ordem-dos-desfiles">Explorar a ordem dos desfiles <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="parade-home__dates" aria-label="Datas dos desfiles de 2027">{dates.map((date) => <Link className="parade-home__date" to={`/ordem-dos-desfiles?data=${date.event_date}`} key={date.id}>
        <span className="parade-home__weekday">{formatDate(date.event_date, { weekday: 'long' })}</span>
        <span className="parade-home__number">{date.event_date.slice(-2)}<small>FEV</small></span>
        <span className="parade-home__group">{date.parade_group}</span>
        <span className="parade-home__arrow" aria-hidden="true">↗</span>
      </Link>)}</div>
      <div className="parade-home__foot"><span>MARQUÊS DE SAPUCAÍ · RIO DE JANEIRO</span><span>Ordem das escolas conforme as ligas oficiais</span></div>
    </div>
  </section>
}

export function ParadePage() {
  const { products } = useStore()
  const [params, setParams] = useSearchParams()
  const [dates, setDates] = useState<ParadeDate[]>([])
  const [entries, setEntries] = useState<ParadeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!supabase) { setError(true); setLoading(false); return }
    let active = true
    void Promise.all([
      supabase.from('event_dates').select('id,event_date,parade_group,starts_at').eq('status', 'published').order('event_date'),
      supabase.from('parade_lineup').select('id,event_date_id,parade_order,expected_at,parade_schools(name)').eq('status', 'published').order('parade_order'),
    ]).then(([datesResult, lineupResult]) => {
      if (!active) return
      if (datesResult.error || lineupResult.error) setError(true)
      else { setDates((datesResult.data ?? []) as ParadeDate[]); setEntries((lineupResult.data ?? []) as unknown as ParadeEntry[]) }
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const selected = dates.find((date) => date.event_date === params.get('data')) ?? dates[0]
  const lineup = selected ? entries.filter((entry) => entry.event_date_id === selected.id).sort((a, b) => a.parade_order - b.parade_order) : []
  const hasProducts = Boolean(selected && products.some((product) => product.event_dates?.event_date === selected.event_date))
  const officialSource = selected?.parade_group === 'Série Ouro'
    ? { label: 'Liga RJ', url: 'https://www.ligarj.com.br/carnaval/2027' }
    : { label: 'LIESA', url: 'https://liesa.org.br/carnaval/horario-dos-desfiles.html' }
  const selectDate = (date: string) => setParams({ data: date })

  return <div className="parade-page">
    <section className="parade-page__hero"><div className="parade-page__hero-inner">
      <Link className="parade-page__back" to="/">← Voltar ao início</Link>
      <span className="parade-eyebrow"><i aria-hidden="true" /> O GUIA DA AVENIDA · 2027</span>
      <h1>Ordem dos<br /><em>desfiles.</em></h1>
      <p>Escolha uma noite e descubra quem entra na avenida. A sequência publicada segue as ligas responsáveis pelos desfiles.</p>
      <div className="parade-page__hero-meta"><span>05—13 FEV 2027</span><span>MARQUÊS DE SAPUCAÍ</span></div>
    </div></section>
    <div className="parade-page__content">
      {loading ? <p className="parade-page__state" role="status">Carregando programação…</p> : error ? <p className="parade-page__state" role="alert">Não foi possível carregar a programação agora. Tente novamente em instantes.</p> : !selected ? <p className="parade-page__state">A programação está em preparação.</p> : <>
        <div className="parade-page__chooser-head"><div><span className="section-kicker">ESCOLHA SUA NOITE</span><h2>O calendário da Sapucaí.</h2></div><span>Deslize para ver todas as datas →</span></div>
        <nav className="parade-page__dates" aria-label="Selecionar dia do desfile">{dates.map((date) => <button type="button" className={date.id === selected.id ? 'parade-page__date parade-page__date--active' : 'parade-page__date'} aria-pressed={date.id === selected.id} onClick={() => selectDate(date.event_date)} key={date.id}><span>{formatDate(date.event_date, { weekday: 'short' }).replace('.', '')}</span><strong>{date.event_date.slice(-2)}</strong><small>{date.parade_group}</small></button>)}</nav>
        <div className="parade-page__layout">
          <aside className="parade-page__edition"><span className="parade-eyebrow">A NOITE ESCOLHIDA</span><div className="parade-page__edition-date"><strong>{selected.event_date.slice(-2)}</strong><span>FEV<br />2027</span></div><h2>{formatDate(selected.event_date, { weekday: 'long' })}</h2><p className="parade-page__edition-group">{selected.parade_group}</p><p>{dayCopy(selected.parade_group)}</p><div className="parade-page__edition-rule" /><span className="parade-page__edition-place">MARQUÊS DE SAPUCAÍ<br />RIO DE JANEIRO</span></aside>
          <section className="parade-page__lineup" aria-live="polite"><div className="parade-page__lineup-head"><div><span className="section-kicker">NA ORDEM DA AVENIDA</span><h2>{selected.parade_group === 'Campeãs' ? 'Sábado das Campeãs' : 'Quem desfila nesta noite'}</h2></div>{lineup.length > 0 && <span>{lineup.length} {lineup.length === 1 ? 'escola' : 'escolas'}</span>}</div>
            {lineup.length ? <ol className="parade-page__schools">{lineup.map((entry) => <li key={entry.id}><span className="parade-page__school-number">{String(entry.parade_order).padStart(2, '0')}</span><strong>{entry.parade_schools?.name}</strong>{entry.expected_at && <time>{entry.expected_at.slice(0, 5)}</time>}<span className="parade-page__school-spark" aria-hidden="true">✳</span></li>)}</ol> : <div className="parade-page__pending"><span aria-hidden="true">✳</span><h3>{selected.parade_group === 'Campeãs' ? 'As protagonistas serão reveladas após a apuração.' : 'A sequência desta noite está em atualização.'}</h3><p>{selected.parade_group === 'Campeãs' ? 'A ordem do desfile das Campeãs depende do resultado oficial do Carnaval 2027.' : 'Consulte a liga responsável para acompanhar a programação oficial.'}</p></div>}
            <div className="parade-page__lineup-footer"><p>A ordem pode ser atualizada pela liga organizadora. Horários individuais só aparecem quando publicados e validados.</p><a href={officialSource.url} target="_blank" rel="noreferrer">Fonte oficial: {officialSource.label} ↗</a></div>
          </section>
        </div>
        <aside className="parade-page__cta"><div><span>VIVA ESSA NOITE</span><h2>Seu lugar na avenida começa aqui.</h2><p>Explore os ingressos e experiências publicados para {formatDate(selected.event_date, { day: '2-digit', month: 'long' })}. A disponibilidade é confirmada pela equipe.</p></div><Link to={hasProducts ? `/buscar?data=${selected.event_date}` : '/contato'}>{hasProducts ? 'Explorar experiências' : 'Falar com a equipe'} <span aria-hidden="true">↗</span></Link></aside>
      </>}
    </div>
  </div>
}
