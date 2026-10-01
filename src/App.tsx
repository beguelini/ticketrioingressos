import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import type { User } from '@supabase/supabase-js'
import { fetchCatalog, fetchInstitution, fetchUser, referenceInstitution, supabase, type CatalogProduct, type Language } from './store'
import { useCart } from './useCart'
import { StoreContext, tr, useStore } from './storeContext'
import { Home, Catalog, ProductPage, CartPage, CheckoutPage, StaticPage, FaqPage, ContactPage, AccountPage, AuthPage, OrderPage } from './pages'
import { ParadePage } from './ParadeExperience'
import { AdminPage } from './admin'
import { startAnalytics, track } from './analytics'

function Seo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const names: Record<string, string> = {
      '/': 'Carnaval e experiências no Rio', '/buscar': 'Buscar experiências',
      '/ingressos': 'Ingressos', '/transfers': 'Transfers',
      '/city-tours': 'Rio City Tour', '/camarotes': 'Camarotes',
      '/sambodromo': 'Sambódromo', '/ordem-dos-desfiles': 'Ordem dos desfiles',
    }
    document.title = `${names[pathname] ?? 'Loja'} | Ticket Rio`
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = new URL(pathname, window.location.origin).href
    if (!canonical.parentElement) document.head.append(canonical)
    track('page_view', { path: pathname })
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const nav = [
  ['/ingressos', 'Ingressos', 'Tickets'],
  ['/transfers', 'Transfers', 'Transfers'],
  ['/city-tours', 'Rio City Tour', 'Rio City Tour'],
  ['/camarotes', 'Camarotes', 'VIP lounges'],
  ['/sambodromo', 'Sambódromo', 'Sambadrome'],
]
function Shell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, cart, user, institution } = useStore()
  const whatsapp = /^\d{10,15}$/.test(institution.whatsapp) ? institution.whatsapp : referenceInstitution.whatsapp
  const [menu, setMenu] = useState(false)
  const [chat, setChat] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<string[]>(['Olá! Sou um assistente demonstrativo. Para atendimento humano, use a página de contato.'])
  const [consent, setConsent] = useState(localStorage.getItem('ticket-rio-consent'))
  const [consentOpen, setConsentOpen] = useState(!consent)
  useEffect(() => { if (consent === 'accepted') { startAnalytics(); track('page_view', { path: window.location.pathname }) } }, [consent])
  const chooseConsent = (value: 'accepted' | 'declined') => {
    const previous = localStorage.getItem('ticket-rio-consent')
    localStorage.setItem('ticket-rio-consent', value)
    setConsent(value)
    setConsentOpen(false)
    if (previous === 'accepted' && value === 'declined') window.location.reload()
  }
  return <>
    <Seo />
    <div className="announcement"><span className="announcement__dot" />{tr('O Rio espera por você', 'Rio is waiting for you', language)}</div>
    <header className="site-header">
      <Link className="brand" to="/" onClick={() => setMenu(false)} aria-label="Ticket Rio — início"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio" /></Link>
      <nav className={menu ? 'nav nav--open' : 'nav'} aria-label="Navegação principal">
        {nav.map(([path, pt, en]) => <NavLink key={path} to={path} onClick={() => setMenu(false)}>{tr(pt, en, language)}</NavLink>)}
      </nav>
      <div className="header-actions">
        <a className="header-whatsapp" href={`https://wa.me/${whatsapp}?text=Ol%C3%A1%2C%20gostaria%20de%20atendimento%20Ticket%20Rio.`} target="_blank" rel="noreferrer" aria-label="Atendimento por WhatsApp"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.2A8 8 0 1 1 20 11.7Z" /><path d="M9 9c.4 2.5 2.3 4.3 4.7 5l1.3-1.2 2 1.1-1.3 2c-4.5.5-8.5-3.5-8.2-8L9 7l1.2 2Z" /></svg><span>WhatsApp</span></a>
        <button className="lang-switch" type="button" onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')} aria-label={language === 'pt' ? 'Switch to English' : 'Mudar para português'}>{language === 'pt' ? 'EN' : 'PT'}</button>
        <Link className="text-action account-action" to={user ? '/conta' : '/login'} aria-label={user ? 'Minha conta' : 'Entrar'}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><span>{user ? tr('Minha conta', 'My account', language) : tr('Entrar', 'Sign in', language)}</span></Link>
        <Link className="cart-action" to="/carrinho" aria-label={tr(`Carrinho, ${cart.count} itens`, `Cart, ${cart.count} items`, language)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 4h2l2 11h12l2-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg><span className="cart-action__label">{tr('Carrinho', 'Cart', language)}</span>{cart.count > 0 && <span className="cart-count">{cart.count}</span>}</Link>
        <button className="menu-action" type="button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu}>☰</button>
      </div>
    </header>
    <main>{children}</main>
    <footer className="site-footer">
      <div className="footer-main">
        <div><Link className="footer-brand" to="/"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio" /></Link><p>O Rio para sentir, viver e lembrar.</p><small>{institution.name} · CNPJ {institution.cnpj}{!institution.confirmed && ' · Dados sujeitos a confirmação.'}</small></div>
        <nav className="footer-links" aria-label="Loja"><Link to="/ingressos">Ingressos</Link><Link to="/transfers">Transfers</Link><Link to="/city-tours">Rio City Tour</Link><Link to="/metro">Metrô</Link><Link to="/camisetas">Camisetas</Link><Link to="/camarotes">Camarotes</Link></nav>
        <nav className="footer-links" aria-label="Informações"><Link to="/sobre">Sobre</Link><Link to="/contato">Contato</Link><Link to="/como-comprar">Como comprar</Link><Link to="/perguntas-frequentes">Perguntas frequentes</Link><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-compra">Termos</Link><Link to="/cancelamento-e-reembolso">Cancelamento</Link></nav>
        <div className="footer-contact"><strong>Atendimento</strong><a href={`mailto:${encodeURIComponent(institution.email)}`}>{institution.email}</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">{institution.phone}</a><span>{institution.address}</span><small>{institution.hours}</small></div>
      </div>
      <div className="footer-bottom"><small>© {new Date().getFullYear()} Ticket Rio. Vendas online em preparação. <button className="footer-consent" type="button" onClick={() => setConsentOpen(true)}>Preferências de cookies</button></small><span className="arete-credit">Desenvolvido pela <strong>Aretê Marketing &amp; Tecnologia</strong></span></div>
    </footer>
    {consentOpen && <section className="consent-banner" aria-label="Preferências de cookies"><div><strong>Privacidade em primeiro lugar</strong><p>Usamos somente o armazenamento necessário para a loja. Com sua escolha, poderemos carregar ferramentas de análise e publicidade quando configuradas. Os eventos criados pela loja não incluem nome, e-mail ou telefone.</p></div><div><button className="secondary-button" type="button" onClick={() => chooseConsent('declined')}>Recusar opcionais</button><button className="button" type="button" onClick={() => chooseConsent('accepted')}>Aceitar opcionais</button></div></section>}
    <div className="support">
      <button className="support-button" type="button" onClick={() => setChat(!chat)} aria-label={chat ? 'Fechar chat demonstrativo' : 'Abrir chat demonstrativo'} aria-expanded={chat}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 4 8.5 8.5 0 0 1 21 12.5" /><path d="M8 12h8M8 15h5" /></svg></button>
      {chat && <section className="support-panel" aria-label="Chat demonstrativo">
        <div className="support-panel__header"><strong>Ticket Rio</strong><small>Atendimento simulado</small><button type="button" onClick={() => setChat(false)} aria-label="Fechar">×</button></div>
        <div className="support-panel__messages" role="log" aria-live="polite">{messages.map((item, index) => <p className={index % 2 ? 'chat-message chat-message--visitor' : 'chat-message chat-message--bot'} key={index}>{item}</p>)}</div>
        <form className="support-panel__form" onSubmit={(event) => { event.preventDefault(); if (message.trim()) { setMessages((items) => [...items, message.trim(), 'Este chat é demonstrativo e não registra pedidos. Escreva para atendimento@ticketrio.com.br para falar com a equipe.']); setMessage('') } }}><label className="sr-only" htmlFor="chat-message">Mensagem</label><input id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} placeholder="Sua mensagem" /><button type="submit" aria-label="Enviar">➜</button></form>
      </section>}
    </div>
  </>
}

const legacyRoutes = [
  ['/ingressos/carnaval/rio/2027/comprar', '/ingressos'],
  ['/products/category/transfer', '/transfers'],
  ['/products/category/metro', '/metro'],
  ['/products/category/citytour', '/city-tours'],
  ['/products/category/camisetas', '/camisetas'],
  ['/vipLounges', '/camarotes'], ['/about', '/sobre'],
  ['/contacts', '/contato'], ['/profile', '/conta'],
  ['/viewcart', '/carrinho'], ['/comprar-receber', '/como-comprar'],
  ['/retirada-ingressos', '/como-comprar'],
]
function StoreRoutes() {
  return <Shell><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/buscar" element={<Catalog />} />
    <Route path="/ingressos" element={<Catalog kind="ticket" />} />
    <Route path="/transfers" element={<Catalog kind="transfer" />} />
    <Route path="/city-tours" element={<Catalog kind="tour" />} />
    <Route path="/metro" element={<Catalog kind="metro" />} />
    <Route path="/camisetas" element={<Catalog kind="apparel" />} />
    <Route path="/camarotes" element={<Catalog kind="package" title="Camarotes" />} />
    <Route path="/produto/:slug" element={<ProductPage />} />
    <Route path="/product/:slug" element={<ProductPage />} />
    <Route path="/sambodromo" element={<StaticPage slug="sambodromo" title="Sambódromo" />} />
    <Route path="/ordem-dos-desfiles" element={<ParadePage />} />
    <Route path="/sobre" element={<StaticPage slug="sobre" title="Sobre a Ticket Rio" />} />
    <Route path="/contato" element={<ContactPage />} />
    <Route path="/como-comprar" element={<StaticPage slug="como-comprar" title="Como comprar e receber" />} />
    <Route path="/perguntas-frequentes" element={<FaqPage />} />
    <Route path="/politica-de-privacidade" element={<StaticPage slug="politica-de-privacidade" title="Política de privacidade" />} />
    <Route path="/termos-de-compra" element={<StaticPage slug="termos-de-compra" title="Termos de compra" />} />
    <Route path="/cancelamento-e-reembolso" element={<StaticPage slug="cancelamento-e-reembolso" title="Cancelamento e reembolso" />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/cadastro" element={<AuthPage mode="register" />} />
    <Route path="/recuperar-senha" element={<AuthPage mode="recover" />} />
    <Route path="/redefinir-senha" element={<AuthPage mode="reset" />} />
    <Route path="/conta" element={<AccountPage />} />
    <Route path="/pedidos/:id" element={<OrderPage />} />
    <Route path="/carrinho" element={<CartPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/admin/*" element={<AdminPage />} />
    {legacyRoutes.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
    <Route path="*" element={<div className="page-container"><h1>Página não encontrada</h1><Link to="/">Voltar ao início</Link></div>} />
  </Routes></Shell>
}

function App() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [institution, setInstitution] = useState(referenceInstitution)
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('ticket-rio-language') === 'en' ? 'en' : 'pt')
  useEffect(() => { localStorage.setItem('ticket-rio-language', language); document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en' }, [language])
  useEffect(() => {
    let active = true
    void fetchCatalog().then((items) => { if (active) setProducts(items) }).catch(() => { if (active) setError('Não foi possível carregar o catálogo agora.') }).finally(() => { if (active) setLoading(false) })
    void fetchUser().then((current) => { if (active) setUser(current) })
    void fetchInstitution().then((current) => { if (active) setInstitution(current) })
    const listener = supabase?.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => { active = false; listener?.data.subscription.unsubscribe() }
  }, [])
  const cart = useCart(user?.id ?? null)
  return <StoreContext.Provider value={{ products, loading, error, user, institution, language, setLanguage, cart }}><BrowserRouter><StoreRoutes /></BrowserRouter></StoreContext.Provider>
}
export default App
