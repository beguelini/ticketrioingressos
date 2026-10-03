import { lazy, Suspense, useEffect, useState } from 'react'
import './styles.css'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import type { User } from '@supabase/supabase-js'
import { fetchCatalog, fetchInstitution, fetchUser, referenceInstitution, supabase, type CatalogProduct, type Language } from './store'
import { useCart } from './useCart'
import { StoreContext, tr, useStore } from './storeContext'
import { Home, Catalog, ProductPage, WhatsAppSalesPage, StaticPage, FaqPage, ContactPage, AccountPage, AuthPage, OrderPage } from './pages'
import { ParadePage } from './ParadeExperience'
import { startAnalytics, track } from './analytics'
import { readConsent, saveConsent } from './consent'
import { captureAttribution } from './attribution'
const SupportChat = lazy(() => import('./SupportChat'))

function Seo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const names: Record<string, string> = {
      '/': 'Carnaval e experiências no Rio', '/buscar': 'Buscar experiências',
      '/ingressos': 'Ingressos', '/ensaio-tecnico': 'Ensaio Técnico', '/transfers': 'Transfers',
      '/city-tours': 'Rio City Tour', '/camarotes': 'Camarotes',
      '/sambodromo': 'Sambódromo', '/ordem-dos-desfiles': 'Ordem dos desfiles',
      '/sobre': '25 anos de história',
      '/politica-de-privacidade': 'Política de privacidade', '/politica-de-cookies': 'Política de cookies',
      '/termos-de-uso': 'Termos de uso', '/termos-de-compra': 'Termos de compra',
      '/cancelamento-e-reembolso': 'Cancelamento e reembolso',
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
  const [consent, setConsent] = useState(readConsent)
  const [consentOpen, setConsentOpen] = useState(!consent)
  const [consentDetails, setConsentDetails] = useState(false)
  const [analyticsChoice, setAnalyticsChoice] = useState(consent?.analytics ?? false)
  const [marketingChoice, setMarketingChoice] = useState(consent?.marketing ?? false)
  useEffect(() => { if (consent) { startAnalytics(); track('page_view', { path: window.location.pathname }) } }, [consent])
  useEffect(() => { captureAttribution() }, [])
  const chooseConsent = (analytics: boolean, marketing: boolean) => {
    const previous = readConsent()
    const next = saveConsent(analytics, marketing)
    captureAttribution()
    setConsent(next)
    setAnalyticsChoice(analytics)
    setMarketingChoice(marketing)
    setConsentOpen(false)
    if ((previous?.analytics && !analytics) || (previous?.marketing && !marketing)) window.location.reload()
  }
  const openConsent = () => {
    const current = readConsent()
    setAnalyticsChoice(current?.analytics ?? false)
    setMarketingChoice(current?.marketing ?? false)
    setConsentDetails(true)
    setConsentOpen(true)
  }
  return <>
    <Seo />
    <Link className="anniversary-ribbon" to="/sobre" onClick={() => setMenu(false)}>
      <span className="anniversary-ribbon__number" aria-hidden="true">25</span>
      <span className="anniversary-ribbon__copy"><strong>{tr('25 anos de Ticket Rio', '25 years of Ticket Rio', language)}</strong><span>{tr('Uma história vivida com o Rio.', 'A story lived with Rio.', language)}</span></span>
      <span className="anniversary-ribbon__arrow" aria-hidden="true">↗</span>
    </Link>
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
      <div className="footer-anniversary"><span className="footer-anniversary__number" aria-hidden="true">25</span><div><strong>{tr('Há 25 anos, o Rio faz parte da nossa história.', 'For 25 years, Rio has been part of our story.', language)}</strong><span>{tr('Carnaval, experiências e encontros que ficam na memória.', 'Carnival, experiences and moments to remember.', language)}</span></div><Link to="/sobre">{tr('Conheça a Ticket Rio', 'Get to know Ticket Rio', language)} <span aria-hidden="true">↗</span></Link></div>
      <div className="footer-main">
        <div><Link className="footer-brand" to="/"><img src="/ticket-rio-carnaval.png" alt="Ticket Rio" /></Link><p>O Rio para sentir, viver e lembrar.</p><small>{institution.name} · CNPJ {institution.cnpj}{!institution.confirmed && ' · Dados sujeitos a confirmação.'}</small></div>
        <nav className="footer-links" aria-label="Loja"><Link to="/ingressos">Ingressos</Link><Link to="/ensaio-tecnico">Ensaio Técnico</Link><Link to="/transfers">Transfers</Link><Link to="/city-tours">Rio City Tour</Link><Link to="/metro">Metrô</Link><Link to="/camisetas">Camisetas</Link><Link to="/camarotes">Camarotes</Link></nav>
        <nav className="footer-links" aria-label={tr('Informações', 'Information', language)}><Link to="/sobre">{tr('Sobre', 'About', language)}</Link><Link to="/contato">{tr('Contato', 'Contact', language)}</Link><Link to="/como-comprar">{tr('Como comprar', 'How to buy', language)}</Link><Link to="/perguntas-frequentes">{tr('Perguntas frequentes', 'FAQ', language)}</Link><Link to="/politica-de-privacidade">{tr('Privacidade', 'Privacy', language)}</Link><Link to="/politica-de-cookies">Cookies</Link><Link to="/termos-de-uso">{tr('Termos de uso', 'Terms of use', language)}</Link><Link to="/termos-de-compra">{tr('Termos de compra', 'Purchase terms', language)}</Link><Link to="/cancelamento-e-reembolso">{tr('Cancelamento', 'Cancellation', language)}</Link></nav>
        <div className="footer-contact"><strong>Atendimento</strong><a href={`mailto:${encodeURIComponent(institution.email)}`}>{institution.email}</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">{institution.phone}</a><span>{institution.address}</span><small>{institution.hours}</small></div>
      </div>
      <div className="footer-bottom"><small>© {new Date().getFullYear()} Ticket Rio. {tr('Ingressos e experiências sujeitos à disponibilidade.', 'Tickets and experiences subject to availability.', language)} <button className="footer-consent" type="button" onClick={openConsent}>{tr('Preferências de cookies', 'Cookie preferences', language)}</button></small><span className="arete-credit">Desenvolvido pela <strong>Aretê Marketing &amp; Tecnologia</strong></span></div>
    </footer>
    {consentOpen && <section className={consentDetails ? 'consent-banner consent-banner--detailed' : 'consent-banner'} aria-label={tr('Preferências de cookies', 'Cookie preferences', language)}><div className="consent-banner__intro"><strong>{tr('Sua privacidade, suas escolhas', 'Your privacy, your choice', language)}</strong><p>{tr('Usamos armazenamento necessário para a loja. Medição e publicidade só são ativadas com sua escolha, quando configuradas.', 'We use necessary storage for the store. Measurement and advertising run only with your choice, when configured.', language)} <Link to="/politica-de-cookies">{tr('Entenda os cookies', 'About cookies', language)}</Link> · <Link to="/politica-de-privacidade">{tr('Privacidade', 'Privacy', language)}</Link></p></div>{consentDetails && <div className="consent-categories"><div><strong>{tr('Necessários', 'Necessary', language)}</strong><span>{tr('Conta, carrinho, idioma e sua escolha de privacidade.', 'Account, cart, language and your privacy choice.', language)}</span><em>{tr('Sempre ativos', 'Always on', language)}</em></div><label><span><strong>{tr('Medição', 'Analytics', language)}</strong><small>{tr('Entender como o site é usado, quando houver ferramenta configurada.', 'Understand site use when a measurement tool is configured.', language)}</small></span><input type="checkbox" checked={analyticsChoice} onChange={(event) => setAnalyticsChoice(event.target.checked)} /></label><label><span><strong>{tr('Publicidade', 'Advertising', language)}</strong><small>{tr('Medir campanhas e anúncios, quando houver ferramenta configurada.', 'Measure campaigns and ads when a tool is configured.', language)}</small></span><input type="checkbox" checked={marketingChoice} onChange={(event) => setMarketingChoice(event.target.checked)} /></label></div>}<div className="consent-banner__actions"><button className="secondary-button" type="button" onClick={() => chooseConsent(false, false)}>{tr('Rejeitar opcionais', 'Reject optional', language)}</button>{consentDetails ? <button className="secondary-button" type="button" onClick={() => chooseConsent(analyticsChoice, marketingChoice)}>{tr('Salvar escolhas', 'Save choices', language)}</button> : <button className="secondary-button" type="button" onClick={() => setConsentDetails(true)}>{tr('Personalizar', 'Customize', language)}</button>}<button className="button" type="button" onClick={() => chooseConsent(true, true)}>{tr('Aceitar opcionais', 'Accept optional', language)}</button></div></section>}
    <div className="support">
      <button className="support-button" type="button" onClick={() => setChat(!chat)} aria-label={chat ? 'Fechar atendimento' : 'Abrir atendimento'} aria-expanded={chat}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 4 8.5 8.5 0 0 1 21 12.5" /><path d="M8 12h8M8 15h5" /></svg></button>
      {chat && <Suspense fallback={<section className="support-panel" aria-label="Carregando atendimento">Carregando atendimento…</section>}><SupportChat onClose={() => setChat(false)} /></Suspense>}
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
    <Route path="/ensaio-tecnico" element={<Catalog kind="ticket" categorySlug="ensaio-tecnico" />} />
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
    <Route path="/politica-de-cookies" element={<StaticPage slug="politica-de-cookies" title="Política de cookies" />} />
    <Route path="/termos-de-uso" element={<StaticPage slug="termos-de-uso" title="Termos de uso" />} />
    <Route path="/termos-de-compra" element={<StaticPage slug="termos-de-compra" title="Termos de compra" />} />
    <Route path="/cancelamento-e-reembolso" element={<StaticPage slug="cancelamento-e-reembolso" title="Cancelamento e reembolso" />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/cadastro" element={<AuthPage mode="register" />} />
    <Route path="/recuperar-senha" element={<AuthPage mode="recover" />} />
    <Route path="/redefinir-senha" element={<AuthPage mode="reset" />} />
    <Route path="/conta" element={<AccountPage />} />
    <Route path="/pedidos/:id" element={<OrderPage />} />
    <Route path="/carrinho" element={<Navigate to="/atendimento-compra" replace />} />
    <Route path="/atendimento-compra" element={<WhatsAppSalesPage />} />
    <Route path="/checkout" element={<Navigate to="/atendimento-compra" replace />} />
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
