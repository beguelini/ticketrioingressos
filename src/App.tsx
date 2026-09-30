import { useMemo, useState } from 'react'

type Category = 'Todos' | 'Grupo Especial' | 'Série Ouro' | 'Experiências'
type Event = { id: number; title: string; category: Exclude<Category, 'Todos'>; date: string; dateLabel: string; image: string; imageAlt: string; price: number }
type CartItem = { event: Event; section: string; price: number; quantity: number }

const events: Event[] = [
  { id: 1, title: 'Desfiles do Grupo Especial', category: 'Grupo Especial', date: '2027-02-07', dateLabel: 'DOM, 7 FEV 2027', image: '/images/sambadrome-hero.jpg', imageAlt: 'Desfile de escola de samba na Marquês de Sapucaí', price: 270 },
  { id: 2, title: 'Desfiles da Série Ouro', category: 'Série Ouro', date: '2027-02-05', dateLabel: 'SEX, 5 FEV 2027', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=900&q=85', imageAlt: 'Público celebrando em uma festa de rua', price: 120 },
  { id: 3, title: 'Camarotes e experiências', category: 'Experiências', date: '2027-02-06', dateLabel: 'SÁB, 6 FEV 2027', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85', imageAlt: 'Show com luzes e público', price: 490 },
  { id: 4, title: 'Desfiles do Grupo Especial', category: 'Grupo Especial', date: '2027-02-08', dateLabel: 'SEG, 8 FEV 2027', image: '/images/sambadrome-hero.jpg', imageAlt: 'A avenida iluminada durante o desfile', price: 270 },
]
const categories: { name: Exclude<Category, 'Todos'>; image: string; position: string }[] = [
  { name: 'Grupo Especial', image: '/images/sambadrome-hero.jpg', position: '72% 70%' },
  { name: 'Série Ouro', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1000&q=85', position: 'center' },
  { name: 'Experiências', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=85', position: 'center' },
]
const sectors = [
  { name: 'Arquibancada', price: 270, note: 'A energia da avenida' },
  { name: 'Frisa', price: 790, note: 'Mais perto do desfile' },
  { name: 'Camarote', price: 1490, note: 'Conforto e vista privilegiada' },
]
const money = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount)

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    cart: <><path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9.5" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    ticket: <><path d="M3 9V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6Z"/><path d="M13 5v2m0 4v2m0 4v2"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></>,
    headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v6H6a3 3 0 0 1-3-3v-1a2 2 0 0 1 2-2ZM19 13h-2v6h1a3 3 0 0 0 3-3v-1a2 2 0 0 0-2-2ZM17 19c-.5 1.5-2 2-5 2"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  }
  return <svg {...common}>{paths[name] ?? paths.arrow}</svg>
}

function App() {
  const [category, setCategory] = useState<Category>('Todos')
  const [date, setDate] = useState('Todas as datas')
  const [sectorFilter, setSectorFilter] = useState('Todos os setores')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedSector, setSelectedSector] = useState('Arquibancada')
  const [quantity, setQuantity] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [demoDone, setDemoDone] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesCategory = category === 'Todos' || event.category === category
    const matchesDate = date === 'Todas as datas' || event.date === date
    const matchesSector = sectorFilter === 'Todos os setores' || sectorFilter === 'Arquibancada' || (sectorFilter === 'Frisa' && event.category !== 'Experiências') || (sectorFilter === 'Camarote' && (event.category === 'Experiências' || event.category === 'Grupo Especial'))
    return matchesCategory && matchesDate && matchesSector
  }), [category, date, sectorFilter])
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const scrollToEvents = () => document.getElementById('destaques')?.scrollIntoView({ behavior: 'smooth' })
  const chooseCategory = (name: Category) => { setCategory(name); setDate('Todas as datas'); scrollToEvents() }
  const startTicket = (event: Event) => { setSelectedEvent(event); setSelectedSector(event.category === 'Experiências' ? 'Camarote' : 'Arquibancada'); setQuantity(1); setNotice('') }
  const addTicket = () => {
    if (!selectedEvent) return
    const sector = sectors.find((item) => item.name === selectedSector) ?? sectors[0]
    setCart((items) => [...items, { event: selectedEvent, section: sector.name, price: sector.price, quantity }])
    setSelectedEvent(null)
    setCartOpen(true)
  }
  const finishDemo = () => { setDemoDone(true); setCart([]) }

  return (
    <>
      <div className="announcement"><span className="announcement__dot"/> O maior espetáculo da Terra espera por você <span className="announcement__divider">·</span> Carnaval do Rio 2027</div>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Ticket Rio Carnaval — início"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio Carnaval" /></a>
        <nav className={menuOpen ? 'nav nav--open' : 'nav'} aria-label="Navegação principal">
          <a href="#destaques" onClick={() => setMenuOpen(false)}>Desfiles</a>
          <a href="#categorias" onClick={() => setMenuOpen(false)}>Experiências</a>
          <a href="#guia" onClick={() => setMenuOpen(false)}>Guia do Carnaval</a>
        </nav>
        <div className="header-actions">
          <button className="text-action account-action" onClick={() => setNotice('A área do cliente estará disponível quando a venda oficial for ativada.')}><Icon name="user" size={18}/> <span>Entrar</span></button>
          <button className="cart-action" onClick={() => { setCartOpen(true); setDemoDone(false) }} aria-label={`Abrir carrinho, ${cartCount} ingressos`}><Icon name="cart" size={20}/><span className="cart-action__label">Carrinho</span>{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</button>
          <button className="menu-action" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}><Icon name={menuOpen ? 'close' : 'menu'} size={22}/></button>
        </div>
      </header>

      <main id="inicio">
        <section className="hero" aria-label="Carnaval do Rio de Janeiro">
          <img className="hero__image" src="/images/sambadrome-hero.jpg" alt="A avenida iluminada durante um desfile de Carnaval na Marquês de Sapucaí" fetchPriority="high" />
          <div className="hero__shade" />
          <div className="hero__content">
            <h1>O Rio é o palco.<br/><span>A avenida é sua.</span></h1>
            <p>Ingressos para viver o Carnaval do Rio.</p>
            <button className="button button--primary" onClick={scrollToEvents}>Encontrar ingressos <Icon name="arrow" size={18}/></button>
          </div>
        </section>

        <section className="search-panel" aria-label="Buscar ingressos">
          <label className="search-field"><span className="sr-only">Desfile</span><Icon name="calendar" size={19}/><select value={category} onChange={(event) => setCategory(event.target.value as Category)}><option value="Todos">Escolha o desfile</option><option>Grupo Especial</option><option>Série Ouro</option><option>Experiências</option></select><Icon name="chevron" size={16}/></label>
          <label className="search-field"><span className="sr-only">Data</span><Icon name="calendar" size={19}/><select value={date} onChange={(event) => setDate(event.target.value)}><option>Todas as datas</option><option value="2027-02-05">Sex, 5 fev</option><option value="2027-02-06">Sáb, 6 fev</option><option value="2027-02-07">Dom, 7 fev</option><option value="2027-02-08">Seg, 8 fev</option></select><Icon name="chevron" size={16}/></label>
          <label className="search-field"><span className="sr-only">Setor</span><Icon name="ticket" size={19}/><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}><option>Todos os setores</option><option>Arquibancada</option><option>Frisa</option><option>Camarote</option></select><Icon name="chevron" size={16}/></label>
          <button className="button button--primary search-button" onClick={scrollToEvents}>Buscar ingressos <Icon name="arrow" size={18}/></button>
          <span className="demo-disclaimer">Demonstração · eventos e valores ilustrativos. Nenhuma cobrança será feita.</span>
        </section>

        <section className="section categories-section" id="categorias">
          <div className="section-heading"><div><h2>Escolha como viver o Carnaval</h2></div><button className="link-action" onClick={() => chooseCategory('Todos')}>Ver todas as opções <Icon name="arrow" size={16}/></button></div>
          <div className="category-grid">
            {categories.map((item) => <button className="category-card" key={item.name} onClick={() => chooseCategory(item.name)}>
              <img src={item.image} alt="" loading="lazy" style={{ objectPosition: item.position }} />
              <span className="category-card__shade" />
              <span className="category-card__copy"><strong>{item.name}</strong></span>
              <span className="category-card__arrow"><Icon name="arrow" size={20}/></span>
            </button>)}
          </div>
        </section>

        <section className="section featured-section" id="destaques">
          <div className="section-heading"><div><h2>Destaques da avenida</h2></div><span className="date-note"><Icon name="calendar" size={16}/> 5 a 8 de fevereiro de 2027</span></div>
          <div className="event-grid">
            {filteredEvents.length ? filteredEvents.map((event) => <article className="event-card" key={event.id}>
              <div className="event-card__image"><img src={event.image} alt={event.imageAlt} loading="lazy" /></div>
              <div className="event-card__body">
                <span className="event-card__date">{event.dateLabel}</span><h3>{event.title}</h3>
                <p className="event-card__venue"><Icon name="pin" size={16}/> Sambódromo da Marquês<br/> de Sapucaí · Rio de Janeiro</p>
                <div className="event-card__bottom"><div><span>A partir de</span><strong>{money(event.price)}</strong></div><button className="button button--small" onClick={() => startTicket(event)}>Ver ingressos <Icon name="arrow" size={16}/></button></div>
              </div>
            </article>) : <div className="empty-results"><strong>Nenhum desfile encontrado</strong><span>Ajuste seus filtros para ver outras opções.</span><button className="link-action" onClick={() => { setCategory('Todos'); setDate('Todas as datas'); setSectorFilter('Todos os setores') }}>Limpar filtros</button></div>}
          </div>
          {filteredEvents.length > 0 && <p className="mock-note">Disponibilidade, datas e valores são ilustrativos nesta demonstração.</p>}
        </section>

        <section className="trust-strip" id="guia" aria-label="Informações da compra">
          <div className="trust-item"><Icon name="shield" size={30}/><div><strong>Compra segura</strong><span>Seus dados protegidos em cada etapa.</span></div></div>
          <div className="trust-item"><Icon name="phone" size={28}/><div><strong>Ingresso no celular</strong><span>Praticidade para aproveitar a avenida.</span></div></div>
          <div className="trust-item"><Icon name="headset" size={30}/><div><strong>Suporte em português</strong><span>Ajuda quando você precisar.</span></div></div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#inicio"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio Carnaval"/></a>
        <nav className="footer-links" aria-label="Links do rodapé"><a href="#guia">Sobre nós</a><a href="#guia">Ajuda</a><a href="#guia">Termos e condições</a><a href="#guia">Política de privacidade</a><a href="#guia">Contato</a></nav>
        <span className="footer-language">🇧🇷 Português <Icon name="chevron" size={15}/></span>
        <small className="copyright">© 2026 Ticket Rio Carnaval. Uma demonstração de loja.</small>
      </footer>


      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><Icon name="close" size={16}/></button></div>}

      {selectedEvent && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEvent(null) }}>
        <section className="dialog ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
          <button className="dialog-close" onClick={() => setSelectedEvent(null)} aria-label="Fechar"><Icon name="close" size={21}/></button>
          <span className="dialog-kicker">CARNAVAL DO RIO · 2027</span><h2 id="ticket-title">Escolha seus ingressos</h2>
          <p className="dialog-event">{selectedEvent.title}<span>{selectedEvent.dateLabel} · Sambódromo</span></p>
          <div className="sector-options">{sectors.map((sector) => <button className={selectedSector === sector.name ? 'sector-option sector-option--selected' : 'sector-option'} key={sector.name} onClick={() => setSelectedSector(sector.name)}><span className="sector-radio"/><span className="sector-option__info"><strong>{sector.name}</strong><small>{sector.note}</small></span><b>{money(sector.price)}</b></button>)}</div>
          <div className="quantity-row"><span>Quantidade</span><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Diminuir quantidade">−</button><strong>{quantity}</strong><button onClick={() => setQuantity(Math.min(6, quantity + 1))} aria-label="Aumentar quantidade">+</button></div></div>
          <div className="demo-callout"><Icon name="ticket" size={17}/><span>Prévia demonstrativa. Nenhuma cobrança ou emissão será feita.</span></div>
          <button className="button button--primary dialog-submit" onClick={addTicket}>Adicionar ao carrinho <span>{money((sectors.find((item) => item.name === selectedSector)?.price ?? 270) * quantity)}</span></button>
        </section>
      </div>}

      {cartOpen && <div className="overlay overlay--drawer" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCartOpen(false); setDemoDone(false) } }}>
        <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div className="drawer-header"><div><span className="dialog-kicker">TICKET RIO CARNAVAL</span><h2 id="cart-title">{demoDone ? 'Prévia concluída' : 'Seu carrinho'}</h2></div><button className="dialog-close" onClick={() => { setCartOpen(false); setDemoDone(false) }} aria-label="Fechar carrinho"><Icon name="close" size={21}/></button></div>
          {demoDone ? <div className="demo-success"><span className="success-mark">✓</span><h3>Simulação finalizada</h3><p>Você viu como funciona o pedido. Esta demonstração não emitiu ingresso nem registrou cobrança.</p><button className="button button--primary" onClick={() => { setCartOpen(false); setDemoDone(false) }}>Voltar à programação</button></div> : cart.length === 0 ? <div className="cart-empty"><span className="empty-ticket"><Icon name="ticket" size={28}/></span><h3>Seu próximo Carnaval começa aqui</h3><p>Escolha um desfile e encontre seu lugar na avenida.</p><button className="button button--primary" onClick={() => { setCartOpen(false); scrollToEvents() }}>Explorar ingressos <Icon name="arrow" size={17}/></button></div> : <>
            <div className="cart-items">{cart.map((item, index) => <article className="cart-item" key={`${item.event.id}-${index}`}><img src={item.event.image} alt=""/><div className="cart-item__details"><span>{item.event.dateLabel}</span><strong>{item.event.title}</strong><small>{item.section} · {item.quantity} {item.quantity === 1 ? 'ingresso' : 'ingressos'}</small><b>{money(item.price * item.quantity)}</b></div><button className="remove-item" onClick={() => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover item"><Icon name="close" size={16}/></button></article>)}</div>
            <div className="cart-summary"><div><span>Subtotal ilustrativo</span><strong>{money(cartTotal)}</strong></div><small>Este pedido é apenas uma simulação. Nenhuma cobrança será realizada.</small><button className="button button--primary" onClick={finishDemo}>Continuar demonstração <Icon name="arrow" size={17}/></button></div>
          </>}
        </aside>
      </div>}
    </>
  )
}

export default App
