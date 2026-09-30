import { useEffect, useMemo, useRef, useState } from 'react'
import { carnivalProducts, categories, cityProducts, money } from './catalog'
import type { Category, Option, Product } from './catalog'

type CartItem = { product: Product; option: Option; quantity: number }
type ChatMessage = { id: number; from: 'visitor' | 'bot'; text: string }

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, React.ReactNode> = {
    cart: <><path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9.5" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>, arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    ticket: <><path d="M3 9V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 0 0 6H5a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6Z"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></>,
    headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v6H6a3 3 0 0 1-3-3v-1a2 2 0 0 1 2-2ZM19 13h-2v6h1a3 3 0 0 0 3-3v-1a2 2 0 0 0-2-2Z"/></>,
    close: <path d="m18 6-12 12M6 6l12 12"/>, menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.8-4.5a7.5 7.5 0 1 1 14.2-4Z"/><path d="M8.5 11.5h7"/></>,
    send: <><path d="m21 3-8.5 18-2.7-7.8L2 10.5 21 3Z"/><path d="M9.8 13.2 21 3"/></>,
  }
  return <svg {...common}>{paths[name] ?? paths.arrow}</svg>
}

function ProductCard({ product, onChoose }: { product: Product; onChoose: (product: Product) => void }) {
  return <article className="product-card">
    <div className="product-card__image"><img src={product.image} alt={product.imageAlt} loading="lazy" />{product.badge && <span className={`product-badge product-badge--${product.badgeTone ?? 'blue'}`}>{product.badge}</span>}</div>
    <div className="product-card__body">
      <span className="product-card__eyebrow">{product.kind === 'city' ? 'RIO CITY TOUR' : product.dateLabel}</span>
      <h3>{product.title}</h3>
      <p className="product-card__venue"><Icon name="pin" size={15}/>{product.venue}</p>
      <p className="product-card__description">{product.description}</p>
      <div className="product-card__bottom"><div className="product-card__price"><span>A partir de {product.originalPrice && <del>{money(product.originalPrice)}</del>}</span><strong>{money(product.options[0].price)}</strong></div><button className="button button--small" onClick={() => onChoose(product)}>{product.kind === 'city' ? 'Explorar' : 'Ver ingressos'} <Icon name="arrow" size={16}/></button></div>
    </div>
  </article>
}

function App() {
  const [category, setCategory] = useState<Category>('Todos')
  const [date, setDate] = useState('Todas as datas')
  const [sectorFilter, setSectorFilter] = useState('Todos os setores')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedOption, setSelectedOption] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [demoDone, setDemoDone] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ id: 1, from: 'bot', text: 'Olá! Sou o atendimento simulado da Ticket Rio. Posso ajudar você a explorar os ingressos e experiências desta demonstração.' }])
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatMessagesRef.current) chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
  }, [chatMessages, chatOpen])

  const filteredProducts = useMemo(() => carnivalProducts.filter((product) => (
    (category === 'Todos' || product.category === category) &&
    (date === 'Todas as datas' || product.date === date) &&
    (sectorFilter === 'Todos os setores' || product.options.some((option) => option.name.includes(sectorFilter)))
  )), [category, date, sectorFilter])
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.option.price * item.quantity, 0)
  const activeOption = selectedProduct?.options.find((option) => option.name === selectedOption) ?? selectedProduct?.options[0]

  const scrollToProducts = () => document.getElementById('destaques')?.scrollIntoView({ behavior: 'smooth' })
  const chooseCategory = (name: Category) => { setCategory(name); setDate('Todas as datas'); setSectorFilter('Todos os setores'); scrollToProducts() }
  const chooseProduct = (product: Product) => { setSelectedProduct(product); setSelectedOption(product.options[0].name); setQuantity(1); setChatOpen(false) }
  const addToCart = () => {
    if (!selectedProduct || !activeOption) return
    setCart((items) => [...items, { product: selectedProduct, option: activeOption, quantity }])
    setSelectedProduct(null)
    setCartOpen(true)
  }
  const sendChat = (message: string) => {
    const value = message.trim()
    if (!value) return
    const lower = value.toLocaleLowerCase('pt-BR')
    const reply = /preço|valor|promo/.test(lower) ? 'Os preços e promoções desta página são exemplos. Abra um produto para ver as opções e seus valores ilustrativos.' : /city|passeio|tour|experi/.test(lower) ? 'A Rio City Tour aparece na seção “Você também pode gostar”. As experiências e datas desta página são demonstrativas.' : /compr|pag|reserva|ingresso/.test(lower) ? 'Você pode montar um carrinho de demonstração, mas não há pagamento, reserva ou emissão de ingressos neste site.' : 'Esta é uma conversa simulada. Explore os produtos na página ou me pergunte sobre preços, ingressos e Rio City Tour.'
    setChatMessages((items) => {
      const nextId = items[items.length - 1].id + 1
      return [...items, { id: nextId, from: 'visitor', text: value }, { id: nextId + 1, from: 'bot', text: reply }]
    })
    setChatInput('')
  }

  return <>
    <div className="announcement"><span className="announcement__dot"/> O Rio espera por você <span className="announcement__divider">·</span> Carnaval 2027</div>
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Ticket Rio Carnaval — início"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio Carnaval" /></a>
      <nav className={menuOpen ? 'nav nav--open' : 'nav'} aria-label="Navegação principal">
        <a href="#destaques" onClick={() => setMenuOpen(false)}>Ingressos</a>
        <a href="#categorias" onClick={() => setMenuOpen(false)}>Experiências</a>
        <a href="#rio-city-tour" onClick={() => setMenuOpen(false)}>Rio City Tour</a>
        <a href="#guia" onClick={() => setMenuOpen(false)}>Como funciona</a>
      </nav>
      <div className="header-actions">
        <button className="text-action account-action" onClick={() => setNotice('A área do cliente estará disponível quando as vendas forem ativadas.')}><Icon name="user" size={18}/> <span>Entrar</span></button>
        <button className="cart-action" onClick={() => { setCartOpen(true); setDemoDone(false); setChatOpen(false) }} aria-label={`Abrir carrinho, ${cartCount} itens`}><Icon name="cart" size={21}/><span className="cart-action__label">Carrinho</span>{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</button>
        <button className="menu-action" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}><Icon name={menuOpen ? 'close' : 'menu'} size={23}/></button>
      </div>
    </header>

    <main id="inicio">
      <section className="hero" aria-label="Carnaval do Rio de Janeiro"><img className="hero__image" src="/images/sambadrome-hero.jpg" alt="Desfile de Carnaval na Marquês de Sapucaí" /><div className="hero__shade" /><div className="hero__content"><span className="hero__eyebrow">TICKET RIO CARNAVAL · 2027</span><h1>O Rio é o palco.<br/><span>A avenida é sua.</span></h1><p>Escolha seu lugar na festa mais extraordinária do mundo.</p><button className="button button--primary" onClick={scrollToProducts}>Explorar ingressos <Icon name="arrow" size={19}/></button></div></section>

      <section className="search-panel" aria-label="Buscar ingressos">
        <label className="search-field"><span>Tipo de evento</span><div><Icon name="ticket" size={19}/><select value={category} onChange={(event) => setCategory(event.target.value as Category)}><option value="Todos">Todos os desfiles</option><option>Grupo Especial</option><option>Série Ouro</option><option>Experiências</option></select><Icon name="chevron" size={16}/></div></label>
        <label className="search-field"><span>Data</span><div><Icon name="calendar" size={19}/><select value={date} onChange={(event) => setDate(event.target.value)}><option>Todas as datas</option><option value="2027-02-05">Sex, 5 fev</option><option value="2027-02-06">Sáb, 6 fev</option><option value="2027-02-07">Dom, 7 fev</option><option value="2027-02-08">Seg, 8 fev</option></select><Icon name="chevron" size={16}/></div></label>
        <label className="search-field"><span>Setor</span><div><Icon name="pin" size={19}/><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}><option>Todos os setores</option><option>Arquibancada</option><option>Frisa</option><option>Camarote</option></select><Icon name="chevron" size={16}/></div></label>
        <button className="button button--primary search-button" onClick={scrollToProducts}>Buscar <Icon name="arrow" size={18}/></button>
        <p className="demo-disclaimer">Demonstração: produtos, preços, promoções e datas são ilustrativos. Nenhuma cobrança ou reserva será feita.</p>
      </section>

      <section className="section categories-section" id="categorias"><div className="section-heading"><div><span className="section-kicker">ESCOLHA SUA EXPERIÊNCIA</span><h2>O Carnaval do seu jeito.</h2></div><button className="link-action" onClick={() => chooseCategory('Todos')}>Ver tudo <Icon name="arrow" size={17}/></button></div><div className="category-grid">{categories.map((item) => <button className="category-card" key={item.name} onClick={() => chooseCategory(item.name)}><img src={item.image} alt="" loading="lazy"/><span className="category-card__shade"/><span className="category-card__copy"><small>{item.description}</small><strong>{item.name}</strong></span><span className="category-card__arrow"><Icon name="arrow" size={19}/></span></button>)}</div></section>

      <section className="section featured-section" id="destaques"><div className="section-heading"><div><span className="section-kicker">INGRESSOS EM DESTAQUE</span><h2>Encontre seu lugar na avenida.</h2></div><span className="date-note"><Icon name="calendar" size={17}/> 5 a 8 de fevereiro de 2027</span></div><div className="product-grid">{filteredProducts.length ? filteredProducts.map((product) => <ProductCard product={product} onChoose={chooseProduct} key={product.id}/>) : <div className="empty-results"><strong>Nenhum ingresso encontrado</strong><span>Ajuste os filtros para ver outras opções.</span><button className="link-action" onClick={() => { setCategory('Todos'); setDate('Todas as datas'); setSectorFilter('Todos os setores') }}>Limpar filtros</button></div>}</div><p className="mock-note">* Catálogo demonstrativo. Imagens ilustrativas e produtos não disponíveis para compra.</p></section>

      <section className="city-section" id="rio-city-tour"><div className="section city-section__inner"><div className="city-section__intro"><span className="section-kicker">RIO CITY TOUR · EXPERIÊNCIAS NO RIO</span><h2>Você também pode gostar.</h2><p>Da mesma empresa da Ticket Rio, a Rio City Tour reúne experiências para descobrir a cidade além do Carnaval.</p></div><div className="product-grid city-grid">{cityProducts.map((product) => <ProductCard product={product} onChoose={chooseProduct} key={product.id}/>)}</div><p className="mock-note">* Experiências, datas e preços ilustrativos nesta demonstração.</p></div></section>

      <section className="trust-strip" id="guia" aria-label="Sobre esta demonstração"><div className="trust-item"><Icon name="shield" size={26}/><div><strong>Escolha com clareza</strong><span>Opções e valores exibidos antes do carrinho.</span></div></div><div className="trust-item"><Icon name="phone" size={26}/><div><strong>Feito para o celular</strong><span>Explore o Rio onde você estiver.</span></div></div><div className="trust-item"><Icon name="headset" size={26}/><div><strong>Ajuda para explorar</strong><span>Converse com nosso chat simulado.</span></div></div></section>
    </main>

    <footer className="site-footer"><div className="footer-main"><a className="footer-brand" href="#inicio"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio Carnaval"/></a><p>O Rio para sentir, viver e lembrar.</p><nav className="footer-links" aria-label="Links do rodapé"><a href="#destaques">Ingressos</a><a href="#rio-city-tour">Rio City Tour</a><a href="#guia">Como funciona</a></nav></div><div className="footer-bottom"><small>© 2026 Ticket Rio Carnaval. Site demonstrativo, sem vendas ativas.</small><span className="arete-credit">Desenvolvido pela <strong>Aretê Marketing &amp; Tecnologia</strong></span></div></footer>

    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><Icon name="close" size={16}/></button></div>}

    <div className="support"><button className="support-button" onClick={() => setChatOpen(!chatOpen)} aria-label={chatOpen ? 'Fechar chat de atendimento simulado' : 'Abrir chat de atendimento simulado'} aria-expanded={chatOpen} aria-controls="support-panel"><Icon name={chatOpen ? 'close' : 'chat'} size={22}/></button>{chatOpen && <section className="support-panel" id="support-panel" aria-label="Chat de atendimento simulado"><div className="support-panel__header"><span className="support-panel__icon"><Icon name="headset" size={21}/></span><div><strong>Ticket Rio</strong><small>Atendimento simulado</small></div><button onClick={() => setChatOpen(false)} aria-label="Fechar chat"><Icon name="close" size={19}/></button></div><div className="support-panel__messages" ref={chatMessagesRef} role="log" aria-live="polite">{chatMessages.map((message) => <p className={`chat-message chat-message--${message.from}`} key={message.id}>{message.text}</p>)}</div><div className="support-panel__suggestions"><button onClick={() => sendChat('Como funcionam os preços?')}>Preços</button><button onClick={() => sendChat('Quero conhecer a Rio City Tour')}>Rio City Tour</button></div><form className="support-panel__form" onSubmit={(event) => { event.preventDefault(); sendChat(chatInput) }}><label className="sr-only" htmlFor="chat-input">Mensagem</label><input id="chat-input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={240} placeholder="Escreva sua mensagem"/><button type="submit" aria-label="Enviar mensagem"><Icon name="send" size={18}/></button></form></section>}</div>

    {selectedProduct && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null) }}><section className="dialog ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-title"><button className="dialog-close" onClick={() => setSelectedProduct(null)} aria-label="Fechar"><Icon name="close" size={21}/></button><span className="dialog-kicker">{selectedProduct.kind === 'city' ? 'RIO CITY TOUR' : 'CARNAVAL DO RIO · 2027'}</span><h2 id="ticket-title">{selectedProduct.kind === 'city' ? 'Escolha sua experiência' : 'Escolha seus ingressos'}</h2><p className="dialog-event">{selectedProduct.title}<span>{selectedProduct.kind === 'city' ? 'Datas a definir' : selectedProduct.dateLabel} · {selectedProduct.venue}</span></p><div className="sector-options">{selectedProduct.options.map((option) => <button className={selectedOption === option.name ? 'sector-option sector-option--selected' : 'sector-option'} key={option.name} onClick={() => setSelectedOption(option.name)}><span className="sector-radio"/><span className="sector-option__info"><strong>{option.name}</strong><small>{option.note}</small></span><b>{money(option.price)}</b></button>)}</div><div className="quantity-row"><span>Quantidade</span><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Diminuir quantidade">−</button><strong>{quantity}</strong><button onClick={() => setQuantity(Math.min(6, quantity + 1))} aria-label="Aumentar quantidade">+</button></div></div><div className="demo-callout"><Icon name="ticket" size={18}/><span>Prévia demonstrativa. Nenhuma cobrança, reserva ou emissão será feita.</span></div><button className="button button--primary dialog-submit" onClick={addToCart}>Adicionar ao carrinho <span>{money((activeOption?.price ?? 0) * quantity)}</span></button></section></div>}

    {cartOpen && <div className="overlay overlay--drawer" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCartOpen(false); setDemoDone(false) } }}><aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div className="drawer-header"><div><span className="dialog-kicker">TICKET RIO CARNAVAL</span><h2 id="cart-title">{demoDone ? 'Prévia concluída' : 'Seu carrinho'}</h2></div><button className="dialog-close" onClick={() => { setCartOpen(false); setDemoDone(false) }} aria-label="Fechar carrinho"><Icon name="close" size={21}/></button></div>{demoDone ? <div className="demo-success"><span className="success-mark">✓</span><h3>Simulação finalizada</h3><p>Esta demonstração não emitiu ingresso, não fez reserva e não registrou cobrança.</p><button className="button button--primary" onClick={() => { setCartOpen(false); setDemoDone(false) }}>Voltar à programação</button></div> : cart.length === 0 ? <div className="cart-empty"><span className="empty-ticket"><Icon name="ticket" size={28}/></span><h3>Seu próximo Carnaval começa aqui</h3><p>Escolha um produto e explore as opções.</p><button className="button button--primary" onClick={() => { setCartOpen(false); scrollToProducts() }}>Explorar ingressos <Icon name="arrow" size={17}/></button></div> : <><div className="cart-items">{cart.map((item, index) => <article className="cart-item" key={`${item.product.id}-${index}`}><img src={item.product.image} alt=""/><div className="cart-item__details"><span>{item.product.dateLabel}</span><strong>{item.product.title}</strong><small>{item.option.name} · {item.quantity} {item.quantity === 1 ? 'pessoa' : 'pessoas'}</small><b>{money(item.option.price * item.quantity)}</b></div><button className="remove-item" onClick={() => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover item"><Icon name="close" size={16}/></button></article>)}</div><div className="cart-summary"><div><span>Subtotal ilustrativo</span><strong>{money(cartTotal)}</strong></div><small>Este pedido é apenas uma simulação. Nenhuma cobrança será realizada.</small><button className="button button--primary" onClick={() => { setDemoDone(true); setCart([]) }}>Continuar demonstração <Icon name="arrow" size={17}/></button></div></>}</aside></div>}
  </>
}

export default App
