import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { tr, useStore } from './storeContext'
import { categories, money, supabase, type CatalogProduct, type ProductKind } from './store'
import { track } from './analytics'
import { getAttribution } from './attribution'
import { ParadeHomeSection } from './ParadeExperience'

function isPagarmeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['payment-link.pagar.me', 'payment-link-v3.pagar.me'].includes(url.hostname) &&
      /^\/pl_[A-Za-z0-9]+$/.test(url.pathname) && !url.search && !url.hash
  } catch { return false }
}

function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span aria-hidden="true">✳</span><h2>{title}</h2><p>{detail}</p>{action}</div>
}
function CamaroteLogo({ product }: { product: CatalogProduct }) {
  if (product.kind !== 'package' || !product.image_url?.startsWith('/images/camarotes/')) return null
  if (product.slug.startsWith('camarote-atmosfera-')) return <span className="camarote-logo camarote-logo--atmosfera"><img src="/images/camarotes/logo-atmosfera-original.jpg" alt="Logo original do Camarote Atmosfera" /></span>
  if (product.slug.startsWith('camarote-lounge-carioca-')) return <span className="camarote-logo camarote-logo--lounge"><img src="/images/camarotes/logo-lounge-carioca-original.png" alt="Logo original do Camarote Lounge Carioca" /></span>
  return null
}
function ProductCard({ product }: { product: CatalogProduct }) {
  const { language } = useStore()
  const price = product.product_variants.filter((variant) => variant.price_cents !== null).sort((a, b) => (a.price_cents ?? 0) - (b.price_cents ?? 0))[0]
  const referencePrice = product.sales_mode === 'inquiry' && typeof product.attributes.source_price_cents === 'number'
  return <Link className="store-product-card" to={`/produto/${product.slug}`}>
    <div className="store-product-image">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <span aria-hidden="true">TR</span>}<CamaroteLogo product={product} />{product.promotion_label ? <span className={`store-product-badge store-product-badge--${product.promotion_color ?? 'blue'}`}>{product.promotion_label}</span> : product.sales_mode === 'inquiry' && <span className="store-product-badge">Sob consulta</span>}</div>
    <div className="store-product-body"><small>{product.category?.[language === 'pt' ? 'name_pt' : 'name_en'] ?? categories.find((category) => category.kind === product.kind)?.[language === 'pt' ? 'pt' : 'en'] ?? product.kind}</small><h3>{language === 'en' && product.name_en ? product.name_en : product.name_pt}</h3><p>{language === 'en' && product.summary_en ? product.summary_en : product.summary_pt}</p><strong>{!price || (product.sales_mode === 'inquiry' && !referencePrice) ? tr('Consulte valores', 'Ask for a quote', language) : referencePrice ? tr(`Preço anunciado: ${money(price.price_cents ?? 0)}`, `Listed price: ${money(price.price_cents ?? 0, price.currency, language)}`, language) : <>{price.compare_at_cents && <del>{money(price.compare_at_cents, price.currency, language)}</del>}{tr(`A partir de ${money(price.price_cents ?? 0)}`, `From ${money(price.price_cents ?? 0, price.currency, language)}`, language)}</>}</strong>{referencePrice && <span className="price-note">Confirme valor e disponibilidade com a equipe.</span>}<span className="store-product-cta">{product.sales_mode === 'online' && price ? tr('Escolher e comprar', 'Select and buy', language) : tr('Ver detalhes', 'View details', language)} <span aria-hidden="true">→</span></span></div>
  </Link>
}
function SectionTitle({ eyebrow, title, link }: { eyebrow: string; title: string; link?: string }) {
  return <div className="section-heading"><div><span className="section-kicker">{eyebrow}</span><h2>{title}</h2></div>{link && <Link className="link-action" to={link}>Ver tudo →</Link>}</div>
}
export function Home() {
  const { products, loading, error, language } = useStore()
  const navigate = useNavigate()
  const [homeQuery, setHomeQuery] = useState('')
  const [homeKind, setHomeKind] = useState<'all' | ProductKind>('all')
  const [homeDate, setHomeDate] = useState('')
  const [banners, setBanners] = useState<{ id: string; title_pt: string; title_en: string | null; image_url: string | null; target_url: string | null }[]>([])
  const [bannerIndex, setBannerIndex] = useState(0)
  const [blocks, setBlocks] = useState<{ block_key: string; visible: boolean; sort_order: number }[]>([])
  const [faqs, setFaqs] = useState<{ id: string; question_pt: string; answer_pt: string }[]>([])
  const [eventDates, setEventDates] = useState<{ id: string; event_date: string; parade_group: string }[]>([])
  useEffect(() => {
    if (!supabase) return
    void supabase.from('store_banners').select('id,title_pt,title_en,image_url,target_url').eq('status','published').order('sort_order').then(({ data }) => setBanners(data ?? []))
    void supabase.from('home_blocks').select('block_key,visible,sort_order').then(({ data }) => setBlocks(data ?? []))
    void supabase.from('store_faqs').select('id,question_pt,answer_pt').eq('status','published').order('sort_order').limit(4).then(({ data }) => setFaqs(data ?? []))
    void supabase.from('event_dates').select('id,event_date,parade_group').eq('status','published').order('event_date').then(({ data }) => setEventDates(data ?? []))
  }, [])
  const curated = products.filter((product) => product.featured).slice(0, 6)
  const featured = curated.length ? curated : [
    ...products.filter((product) => product.kind === 'ticket' && /setor 09|cadeira/i.test(product.name_pt)).slice(0, 2),
    ...products.filter((product) => product.kind === 'package' && /atmosfera/i.test(product.name_pt)).slice(0, 2),
    ...products.filter((product) => product.kind === 'package' && /lounge carioca/i.test(product.name_pt)).slice(0, 2),
  ]
  const tours = products.filter((product) => product.kind === 'tour').slice(0, 3)
  const transfers = products.filter((product) => product.kind === 'transfer').slice(0, 3)
  const visible = (key: string) => blocks.find((block) => block.block_key === key)?.visible ?? true
  const sections = [
    { key: 'categories', defaultOrder: 1, element: <section className="section categories-section" key="categories"><SectionTitle eyebrow="EXPLORE" title={tr('O Rio do seu jeito.', 'Rio, your way.', language)} /><div className="category-grid">{categories.map((item) => <Link className="category-card" to={item.path} key={item.path}><img src={item.image} alt="" loading="lazy" /><span className="category-card__shade" /><span className="category-card__copy"><small>{products.some((product) => product.kind === item.kind && (!item.categorySlug || product.category?.slug === item.categorySlug)) ? 'Ticket Rio' : tr('Em preparação', 'Coming soon', language)}</small><strong>{language === 'pt' ? item.pt : item.en}</strong></span><span className="category-card__arrow">↗</span></Link>)}</div></section> },
    { key: 'featured', defaultOrder: 2, element: <section className="section featured-section" key="featured"><SectionTitle eyebrow="ESCOLHAS EM DESTAQUE" title={tr('Seu próximo momento no Rio.', 'Your next Rio moment.', language)} link="/ingressos" />{loading ? <p role="status">Carregando catálogo…</p> : error ? <p role="alert">{error}</p> : featured.length ? <div className="product-grid">{featured.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <Empty title="Novidades em preparação" detail="A Ticket Rio está organizando os produtos e a disponibilidade. Consulte nossa equipe para planejar sua experiência." action={<Link className="button" to="/contato">Falar com a equipe</Link>} />}</section> },
    { key: 'calendar', defaultOrder: 2.5, element: <ParadeHomeSection dates={eventDates} key="calendar" /> },
    { key: 'tours', defaultOrder: 3, element: <section className="city-section" key="tours"><div className="section city-section__inner"><SectionTitle eyebrow="RIO CITY TOUR" title={tr('Você também pode gostar.', 'You may also like.', language)} link="/city-tours" /><p>Experiências para descobrir a cidade além do Carnaval.</p>{tours.length > 0 && <div className="product-grid">{tours.map((product) => <ProductCard product={product} key={product.id} />)}</div>}<Link className="button" to="/city-tours">Conhecer os passeios →</Link></div></section> },
    { key: 'transfers', defaultOrder: 4, element: transfers.length > 0 && <section className="section featured-section" key="transfers"><SectionTitle eyebrow="TRANSFERS" title="O caminho para a avenida." link="/transfers" /><div className="product-grid">{transfers.map((product) => <ProductCard product={product} key={product.id} />)}</div></section> },
    { key: 'benefits', defaultOrder: 5, element: <section className="trust-strip" key="benefits"><div className="trust-item"><strong>01</strong><div><strong>Explore</strong><span>Encontre a experiência ideal.</span></div></div><div className="trust-item"><strong>02</strong><div><strong>Planeje</strong><span>Confira detalhes e orientações.</span></div></div><div className="trust-item"><strong>03</strong><div><strong>Converse</strong><span>Fale com a Ticket Rio.</span></div></div></section> },
    { key: 'faq', defaultOrder: 6, element: faqs.length > 0 && <section className="section featured-section" key="faq"><SectionTitle eyebrow="DÚVIDAS FREQUENTES" title="Antes de viver o Rio." link="/perguntas-frequentes" />{faqs.map((faq) => <details className="faq-item" key={faq.id}><summary>{faq.question_pt}</summary><p>{faq.answer_pt}</p></details>)}</section> },
  ]
  const banner = banners[bannerIndex]
  const suggestions = homeQuery.trim().length > 1 ? products.filter((product) => `${product.name_pt} ${product.summary_pt ?? ''}`.toLocaleLowerCase('pt-BR').includes(homeQuery.trim().toLocaleLowerCase('pt-BR'))).slice(0, 4) : []
  const searchDates = [...new Set(products.map((product) => product.event_dates?.event_date).filter((date): date is string => Boolean(date)))].sort()
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (homeQuery.trim()) params.set('busca', homeQuery.trim())
    if (homeDate) params.set('data', homeDate)
    const path = { all: '/buscar', ticket: '/ingressos', package: '/camarotes', tour: '/city-tours', transfer: '/transfers', metro: '/metro', apparel: '/camisetas' }[homeKind]
    navigate(`${path}${params.size ? `?${params.toString()}` : ''}`)
  }
  return <>
    <section className="hero"><img className="hero__image" src={banner?.image_url || '/images/sambadrome-hero.jpg'} alt="Desfile de Carnaval na Marquês de Sapucaí" /><div className="hero__shade" /><div className="hero__content"><span className="hero__anniversary"><span aria-hidden="true">25</span>{tr('anos de história com o Rio', 'years of history with Rio', language)}</span><span className="hero__eyebrow">TICKET RIO · CARNAVAL DO RIO</span><h1>{banner ? (language === 'en' && banner.title_en ? banner.title_en : banner.title_pt) : <>{tr('O Rio é o palco.', 'Rio is the stage.', language)}<br /><span>{tr('A avenida é sua.', 'The avenue is yours.', language)}</span></>}</h1><p>{tr('Ingressos, experiências e caminhos para viver o Rio.', 'Tickets, experiences and ways to discover Rio.', language)}</p><Link className="button button--primary" to={banner?.target_url?.startsWith('/') ? banner.target_url : '/ingressos'}>{tr('Explorar', 'Explore', language)} →</Link>{banners.length > 1 && <div className="banner-controls"><button type="button" onClick={() => setBannerIndex((bannerIndex + banners.length - 1) % banners.length)} aria-label="Banner anterior">←</button><button type="button" onClick={() => setBannerIndex((bannerIndex + 1) % banners.length)} aria-label="Próximo banner">→</button></div>}</div></section>
    <section className="home-search" aria-label="Encontrar ingressos e experiências"><div className="home-search__heading"><span>ENCONTRE SEU RIO</span><strong>Qual experiência combina com você?</strong></div><form onSubmit={submitSearch}><label className="home-search__query"><span className="sr-only">Buscar produto ou experiência</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input type="search" value={homeQuery} onChange={(event) => setHomeQuery(event.target.value)} placeholder="Busque um setor, camarote ou passeio" autoComplete="off" /></label><label className="home-search__select"><span className="sr-only">Tipo de experiência</span><select value={homeKind} onChange={(event) => setHomeKind(event.target.value as typeof homeKind)}><option value="all">Tudo no Rio</option><option value="ticket">Ingressos</option><option value="package">Camarotes</option><option value="tour">City Tours</option><option value="transfer">Transfers</option></select></label><label className="home-search__select"><span className="sr-only">Data do evento</span><select value={homeDate} onChange={(event) => setHomeDate(event.target.value)}><option value="">Qualquer data</option>{searchDates.map((date) => <option key={date} value={date}>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</option>)}</select></label><button className="home-search__submit" type="submit">Encontrar <span aria-hidden="true">↗</span></button></form>{suggestions.length > 0 && <div className="home-search__suggestions"><small>SUGESTÕES</small>{suggestions.map((product) => <Link key={product.id} to={`/produto/${product.slug}`}><span>{product.name_pt}</span><span aria-hidden="true">↗</span></Link>)}</div>}<div className="home-search__quick"><span>Explore agora</span><Link to="/ingressos">Ingressos</Link><Link to="/ensaio-tecnico">Ensaio Técnico</Link><Link to="/camarotes">Camarotes</Link><Link to="/city-tours">Rio City Tour</Link></div></section>
    <section className="anniversary-feature section" aria-labelledby="anniversary-title"><div className="anniversary-feature__mark" aria-hidden="true"><strong>25</strong><span>{tr('ANOS', 'YEARS', language)}</span></div><div className="anniversary-feature__copy"><span className="anniversary-feature__eyebrow">{tr('TICKET RIO · 25 ANOS', 'TICKET RIO · 25 YEARS', language)}</span><h2 id="anniversary-title">{tr('O Rio faz parte da nossa história.', 'Rio is part of our story.', language)}</h2><p>{tr('Uma trajetória ligada ao Carnaval e às experiências que fazem a cidade ser única. Há 25 anos, seguimos vivendo o Rio com você.', 'A journey connected to Carnival and the experiences that make this city unique. For 25 years, we have shared Rio with you.', language)}</p><Link to="/sobre">{tr('Conheça nossa história', 'Discover our story', language)} <span aria-hidden="true">↗</span></Link></div></section>
    {sections.filter((section) => visible(section.key)).sort((a, b) => (blocks.find((block) => block.block_key === a.key)?.sort_order ?? a.defaultOrder) - (blocks.find((block) => block.block_key === b.key)?.sort_order ?? b.defaultOrder)).map((section) => section.element)}
  </>
}

export function Catalog({ kind, title, categorySlug }: { kind?: ProductKind; title?: string; categorySlug?: string }) {
  const { products, loading, error, language } = useStore()
  const [params, setParams] = useSearchParams()
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name_pt: string; name_en: string | null }[]>([])
  useEffect(() => { if (supabase) void supabase.from('store_categories').select('id,name_pt,name_en').eq('status','published').order('sort_order').then(({ data }) => setCategoryOptions(data ?? [])) }, [])
  const search = params.get('busca') ?? ''
  const dates = params.getAll('data')
  const selectedCategories = params.getAll('categoria')
  const selectedSectors = params.getAll('setor')
  const sort = params.get('ordem') ?? 'destaque'
  const available = params.get('disponivel') === '1'
  const requestedPage = Math.max(1, Number(params.get('pagina')) || 1)
  const scopedProducts = products.filter((product) => (!kind || product.kind === kind) && (!categorySlug || product.category?.slug === categorySlug))
  const filtered = scopedProducts.filter((product) =>
    (!search || `${product.name_pt} ${product.summary_pt ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) &&
    (!dates.length || (product.event_dates && dates.includes(product.event_dates.event_date))) &&
    (!selectedCategories.length || (product.category_id && selectedCategories.includes(product.category_id))) &&
    (!selectedSectors.length || selectedSectors.includes(String(product.attributes.sector ?? '')) || product.product_variants.some((variant) => selectedSectors.includes(String(variant.attributes?.sector ?? '')))) &&
    (!available || product.product_variants.some((variant) => variant.available && variant.stock_total > variant.stock_reserved))
  ).sort((a, b) => sort === 'nome' ? a.name_pt.localeCompare(b.name_pt) : sort === 'menor-preco'
    ? Math.min(...a.product_variants.map((v) => v.price_cents ?? Infinity)) - Math.min(...b.product_variants.map((v) => v.price_cents ?? Infinity))
    : Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order)
  const allDates = [...new Set(scopedProducts.map((product) => product.event_dates?.event_date).filter((date): date is string => Boolean(date)))]
  const allSectors = [...new Set(scopedProducts.flatMap((product) => [product.attributes.sector, ...product.product_variants.map((variant) => variant.attributes?.sector)]).filter((sector): sector is string => typeof sector === 'string' && sector.length > 0))]
  const categoryIds = new Set(scopedProducts.map((product) => product.category_id))
  const relevantCategories = categoryOptions.filter((category) => categoryIds.has(category.id))
  const pageCount = Math.ceil(filtered.length / 12)
  const page = Math.min(requestedPage, Math.max(1, pageCount))
  const visibleProducts = filtered.slice((page - 1) * 12, page * 12)
  const titleText = title ?? categories.find((category) => categorySlug ? category.categorySlug === categorySlug : category.kind === kind)?.[language === 'pt' ? 'pt' : 'en'] ?? 'Buscar experiências'
  const setParam = (key: string, value: string) => { const next = new URLSearchParams(params); next.delete('pagina'); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  const toggleMulti = (key: string, value: string, selected: string[]) => {
    const next = new URLSearchParams(params)
    next.delete(key); next.delete('pagina')
    const values = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
    values.forEach((item) => next.append(key, item))
    setParams(next)
  }
  return <div className="page-container"><div className="page-intro"><span className="section-kicker">TICKET RIO</span><h1>{titleText}</h1><p>{categorySlug === 'ensaio-tecnico' ? tr('Acompanhe os ensaios das escolas de samba na Sapucaí. Ingressos e datas serão exibidos aqui após confirmação.', 'Follow samba school rehearsals at the Sambadrome. Tickets and dates will appear here once confirmed.', language) : 'Explore opções publicadas e confirme os detalhes antes de planejar sua compra.'}</p></div>
    <div className="catalog-toolbar"><label>Buscar<input type="search" value={search} onChange={(event) => setParam('busca', event.target.value)} placeholder="Nome ou experiência" /></label><label>Ordenar<select value={sort} onChange={(event) => setParam('ordem', event.target.value)}><option value="destaque">Destaques</option><option value="nome">Nome</option><option value="menor-preco">Menor preço</option></select></label><label className="inline-check"><input type="checkbox" checked={available} onChange={(event) => setParam('disponivel', event.target.checked ? '1' : '')} />Com disponibilidade</label></div>
    {allDates.length > 0 && <fieldset className="filter-dates"><legend>Datas</legend>{allDates.map((date) => <label key={date}><input type="checkbox" checked={dates.includes(date)} onChange={() => toggleMulti('data', date, dates)} />{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}</label>)}</fieldset>}
    {relevantCategories.length > 1 && <fieldset className="filter-dates"><legend>Categorias</legend>{relevantCategories.map((category) => <label key={category.id}><input type="checkbox" checked={selectedCategories.includes(category.id)} onChange={() => toggleMulti('categoria', category.id, selectedCategories)} />{language === 'en' && category.name_en ? category.name_en : category.name_pt}</label>)}</fieldset>}
    {allSectors.length > 0 && <fieldset className="filter-dates"><legend>Setores</legend>{allSectors.map((sector) => <label key={sector}><input type="checkbox" checked={selectedSectors.includes(sector)} onChange={() => toggleMulti('setor', sector, selectedSectors)} />{sector}</label>)}</fieldset>}
    {loading ? <p role="status">Carregando produtos…</p> : error ? <p role="alert">{error}</p> : filtered.length ? <><div className="product-grid catalog-grid">{visibleProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div>{pageCount > 1 && <nav className="pagination" aria-label="Paginação"><button type="button" disabled={page <= 1} onClick={() => setParam('pagina', String(page - 1))}>Anterior</button><span>Página {page} de {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setParam('pagina', String(page + 1))}>Próxima</button></nav>}</> : <Empty title={categorySlug === 'ensaio-tecnico' ? tr('Ensaios técnicos em preparação', 'Technical rehearsals coming soon', language) : 'Nenhum produto publicado nesta seleção'} detail={categorySlug === 'ensaio-tecnico' ? tr('Datas e ingressos aparecerão aqui quando forem confirmados pela Ticket Rio.', 'Dates and tickets will appear here when confirmed by Ticket Rio.', language) : 'Os produtos e a disponibilidade desta categoria ainda estão sendo validados.'} action={search || dates.length || selectedCategories.length || selectedSectors.length || available ? <button className="button" type="button" onClick={() => setParams({})}>Limpar filtros</button> : <Link className="button" to="/contato">Falar com a equipe</Link>} />}
  </div>
}

export function ProductPage() {
  const { slug } = useParams()
  const { products, loading, cart, language } = useStore()
  const navigate = useNavigate()
  const product = products.find((item) => item.slug === slug)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [sourceChoice, setSourceChoice] = useState('')
  const [transferDate, setTransferDate] = useState('')
  const [transferDates, setTransferDates] = useState<{ event_date: string; parade_group: string }[]>([])
  const variant = product?.product_variants.find((item) => item.id === variantId) ?? product?.product_variants[0]
  useEffect(() => { setVariantId(product?.product_variants[0]?.id ?? ''); setQuantity(1); setAdded(false); setSourceChoice(''); setTransferDate('') }, [product])
  useEffect(() => {
    if (product?.kind !== 'transfer' || !supabase) return
    let active = true
    void supabase.from('event_dates').select('event_date,parade_group').eq('status', 'published').order('event_date').then(({ data }) => {
      if (active) setTransferDates(data ?? [])
    })
    return () => { active = false }
  }, [product?.kind])
  useEffect(() => { if (product) track('view_item', { item_id: product.sku }) }, [product])
  if (loading) return <div className="page-container"><p role="status">Carregando produto…</p></div>
  if (!product) return <div className="page-container"><Empty title="Produto indisponível" detail="Este produto não está publicado ou foi removido." action={<Link to="/ingressos">Ver catálogo</Link>} /></div>
  const canCart = product.sales_mode === 'online' && variant && variant.available && variant.price_cents !== null && variant.stock_total - variant.stock_reserved >= variant.min_quantity
  const images = [product.image_url, ...product.gallery].filter((image): image is string => typeof image === 'string' && image.length > 0)
  const isEditorialTicket = product.kind === 'ticket' && product.image_url?.startsWith('/images/ingressos/')
  const isEditorialPackage = product.kind === 'package' && product.image_url?.startsWith('/images/camarotes/')
  const isEditorialTransfer = product.kind === 'transfer' && product.image_url?.startsWith('/images/transfers/')
  const isEditorialTour = product.kind === 'tour' && product.image_url?.startsWith('/images/city-tours/')
  const attributeLabels: Record<string, string> = { sector: 'Setor', side: 'Lado', row: 'Fila', seat: 'Assento', delivery: 'Entrega', supplier: 'Fornecedor', duration: 'Duração', frequency: 'Frequência', transport: 'Transporte', meeting_point: 'Embarque', capacity: 'Capacidade', size: 'Tamanho', color: 'Cor' }
  const details = Object.entries(product.attributes).filter(([key, value]) => attributeLabels[key] && (typeof value === 'string' || typeof value === 'number'))
  const sourceOptions = Array.isArray(product.attributes.source_options) ? product.attributes.source_options as { name?: string; options?: string[] }[] : []
  const sourceOption = sourceOptions.find((item) => Array.isArray(item.options) && item.options.length > 1)
  const selectionReady = product.kind !== 'transfer' || (!!transferDate && !!sourceChoice)
  const addToCart = (buyNow: boolean) => {
    if (!variant || !canCart || !selectionReady) return
    cart.add(variant.id, quantity, product.kind === 'transfer' ? { service_date: transferDate, pickup_point: sourceChoice } : undefined)
    track('add_to_cart', { item_id: variant.sku, currency: variant.currency, value: (variant.price_cents ?? 0) * quantity / 100 })
    if (buyNow) navigate('/checkout')
    else setAdded(true)
  }
  return <div className="page-container"><Link className="back-link" to={product.category?.slug === 'ensaio-tecnico' ? '/ensaio-tecnico' : product.kind === 'tour' ? '/city-tours' : product.kind === 'transfer' ? '/transfers' : product.kind === 'package' ? '/camarotes' : '/ingressos'}>← Voltar ao catálogo</Link><div className="product-detail"><div className="product-gallery">{images.length ? images.map((image, index) => index === 0 && isEditorialPackage ? <div className="product-gallery__hero" key={image}><img src={image} alt={tr('Arte ilustrativa do camarote no Carnaval do Rio', 'Illustrative artwork of a Rio Carnival lounge', language)} /><CamaroteLogo product={product} /></div> : <img src={image} alt={index === 0 && isEditorialTour ? tr(`Cena ilustrativa de ${product.name_pt}`, `Illustrative scene of ${product.name_en || product.name_pt}`, language) : isEditorialTicket || (index === 0 && isEditorialTransfer) ? tr('Cena ilustrativa do Carnaval do Rio', 'Illustrative scene of Rio Carnival', language) : Array.isArray(product.attributes.image_alts) && typeof product.attributes.image_alts[index] === 'string' ? product.attributes.image_alts[index] as string : `${product.name_pt} — imagem ${index + 1}`} key={image} />) : <div className="product-placeholder">Ticket Rio</div>}{isEditorialTicket && <p className="product-gallery__notice">{tr('Imagens ilustrativas. A visão e a posição variam conforme o setor.', 'Illustrative images. View and position vary by sector.', language)}</p>}{isEditorialPackage && <p className="product-gallery__notice">{tr('Arte ilustrativa. Estrutura, visão e serviços variam conforme o camarote. Logos originais preservadas.', 'Illustrative artwork. Facilities, views and services vary by lounge. Original logos preserved.', language)}</p>}{isEditorialTransfer && <p className="product-gallery__notice">{tr('Imagens ilustrativas. Veículo e ponto de embarque são confirmados pela equipe.', 'Illustrative images. Vehicle and pickup point are confirmed by our team.', language)}</p>}{isEditorialTour && <p className="product-gallery__notice">{tr('Primeira imagem ilustrativa, inspirada na arte original do passeio exibida em seguida. Confirme os detalhes do roteiro com a equipe.', 'First image is illustrative and inspired by the original tour artwork shown next. Confirm itinerary details with our team.', language)}</p>}</div><div className="product-info"><span className="section-kicker">TICKET RIO</span><h1>{language === 'en' && product.name_en ? product.name_en : product.name_pt}</h1><p>{language === 'en' && product.summary_en ? product.summary_en : product.summary_pt}</p><div className="rich-copy">{language === 'en' && product.description_en ? product.description_en : product.description_pt}</div>
    {details.length > 0 && <dl className="product-attributes">{details.map(([key, value]) => <div key={key}><dt>{attributeLabels[key]}</dt><dd>{String(value)}</dd></div>)}</dl>}
    {product.kind === 'transfer' && <label className="field">Data do desfile e do transfer<select value={transferDate} onChange={(event) => { setTransferDate(event.target.value); setAdded(false) }} required><option value="">Selecione a data</option>{transferDates.map((item) => <option value={item.event_date} key={item.event_date}>{new Date(`${item.event_date}T12:00:00`).toLocaleDateString('pt-BR')} · {item.parade_group}</option>)}</select></label>}
    {sourceOption && <label className="field">{sourceOption.name === 'embarque' ? 'Hotel ou ponto de embarque' : sourceOption.name ?? 'Opção'}<select value={sourceChoice} onChange={(event) => { setSourceChoice(event.target.value); setAdded(false) }} required={product.kind === 'transfer'}><option value="">{product.kind === 'transfer' ? 'Selecione o embarque' : 'Selecione para sua consulta'}</option>{sourceOption.options?.filter((option) => !/^(escolha|selecione)/i.test(option)).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
    {product.product_variants.length > 0 && <label className="field">Opção<select value={variant?.id ?? ''} onChange={(event) => { setVariantId(event.target.value); setQuantity(1) }}>{product.product_variants.map((item) => <option value={item.id} key={item.id}>{language === 'en' && item.name_en ? item.name_en : item.name_pt}{item.price_cents !== null ? ` · ${money(item.price_cents, item.currency, language)}` : ''}</option>)}</select></label>}
    <strong className="product-price">{product.sales_mode === 'inquiry' && typeof product.attributes.source_price_cents === 'number' && variant?.price_cents ? `Preço anunciado na origem: ${money(variant.price_cents, variant.currency, language)}` : product.sales_mode === 'inquiry' || !variant?.price_cents ? 'Consulte valores' : money(variant.price_cents, variant.currency, language)}</strong>
    {canCart ? <><label className="field">Quantidade<input type="number" min={variant.min_quantity} max={Math.min(variant.max_quantity, variant.stock_total - variant.stock_reserved)} value={quantity} onChange={(event) => setQuantity(Math.max(variant.min_quantity, Math.min(variant.max_quantity, Number(event.target.value) || 1)))} /></label>{product.kind === 'transfer' && !selectionReady && <p className="form-hint">Escolha a data e o local de embarque para continuar.</p>}<div className="product-buy-actions"><button className="button" type="button" disabled={!selectionReady} onClick={() => addToCart(true)}>Comprar agora →</button><button className="secondary-button" type="button" disabled={!selectionReady} onClick={() => addToCart(false)}>Adicionar ao carrinho</button></div>{added && <p role="status">Adicionado. <Link to="/carrinho">Ver carrinho</Link></p>}</> : <Link className="button" to={`/contato?produto=${encodeURIComponent(product.slug)}${sourceChoice ? `&opcao=${encodeURIComponent(sourceChoice)}` : ''}`}>Consultar a equipe</Link>}
    <p className="product-fineprint">Confira data, setor e itens inclusos antes de pagar. O comprovante de pagamento não equivale ao ingresso oficial, que será entregue conforme as instruções do fornecedor.</p>
    {product.included_pt && <details><summary>O que está incluso</summary><p>{product.included_pt}</p></details>}{product.excluded_pt && <details><summary>O que não está incluso</summary><p>{product.excluded_pt}</p></details>}{product.instructions_pt && <details><summary>Orientações</summary><p>{product.instructions_pt}</p></details>}
  </div></div><section className="related"><SectionTitle eyebrow="CONTINUE EXPLORANDO" title="Você também pode gostar" /><div className="product-grid">{products.filter((item) => item.id !== product.id && item.kind === product.kind).slice(0, 3).map((item) => <ProductCard product={item} key={item.id} />)}</div></section></div>
}

function useCartQuote() {
  const { cart } = useStore()
  const [quote, setQuote] = useState<{ total_cents: number; items: { variant_id: string; name: string; quantity: number; unit_price_cents: number; line_total_cents: number }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!cart.lines.length || !supabase) { setQuote(null); return }
    let active = true
    void supabase.rpc('quote_cart', { lines: cart.lines }).then(({ data, error: quoteError }) => {
      if (!active) return
      if (quoteError) { setError('O preço ou a disponibilidade mudou. Revise o carrinho.'); setQuote(null) }
      else { setError(null); setQuote(data as typeof quote) }
    })
    return () => { active = false }
  }, [cart.lines])
  return { quote, error }
}
export function CartPage() {
  const { cart, products } = useStore()
  const { quote, error } = useCartQuote()
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">SUA SELEÇÃO</span><h1>Carrinho</h1><p>Revise datas, opções e quantidades antes de pagar.</p></div>{cart.lines.length === 0 ? <Empty title="Seu carrinho está vazio" detail="Explore as experiências disponíveis." action={<Link className="button" to="/ingressos">Explorar ingressos</Link>} /> : <><div className="cart-list">{cart.lines.map((line) => { const product = products.find((item) => item.product_variants.some((variant) => variant.id === line.variant_id)); const variant = product?.product_variants.find((item) => item.id === line.variant_id); const max = Math.min(20, variant?.max_quantity ?? 20, (variant?.stock_total ?? 0) - (variant?.stock_reserved ?? 0)); return <div className="cart-line" key={line.variant_id}><div className="cart-line__description"><strong>{product?.name_pt ?? 'Produto indisponível'}</strong><span>{variant?.name_pt ?? 'Opção indisponível'}</span>{line.service_date && <span>Data: {new Date(`${line.service_date}T12:00:00`).toLocaleDateString('pt-BR')}</span>}{line.pickup_point && <span>Embarque: {line.pickup_point}</span>}{product?.kind === 'transfer' && (!line.service_date || !line.pickup_point) && <Link to={`/produto/${product.slug}`}>Selecione data e embarque</Link>}{variant?.price_cents !== null && variant?.price_cents !== undefined && <span>{money(variant.price_cents)} por pessoa</span>}</div><div className="cart-line__actions"><div className="cart-quantity" aria-label={`Quantidade de ${product?.name_pt ?? 'produto'}`}><button type="button" aria-label="Diminuir quantidade" disabled={line.quantity <= (variant?.min_quantity ?? 1)} onClick={() => cart.setQuantity(line.variant_id, line.quantity - 1)}>−</button><output>{line.quantity}</output><button type="button" aria-label="Aumentar quantidade" disabled={line.quantity >= max} onClick={() => cart.setQuantity(line.variant_id, line.quantity + 1)}>+</button></div>{variant?.price_cents !== null && variant?.price_cents !== undefined && <strong>{money(variant.price_cents * line.quantity)}</strong>}<button className="text-button" type="button" onClick={() => cart.remove(line.variant_id)}>Remover</button></div></div> })}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="order-total"><span>Total calculado pelo banco</span><strong>{quote ? money(quote.total_cents) : 'Verificando…'}</strong></div><p>Você poderá revisar os termos e o total antes de seguir ao pagamento seguro.</p>{quote && !error ? <Link className="button" to="/checkout">Ir para checkout →</Link> : <button className="button" type="button" disabled>Revise o carrinho para continuar</button>}</>}</div>
}
export function CheckoutPage() {
  const { cart, user, language, products } = useStore()
  const { quote, error } = useCartQuote()
  const selectionMissing = cart.lines.some((line) => products.some((product) => product.kind === 'transfer' && product.product_variants.some((variant) => variant.id === line.variant_id)) && (!line.service_date || !line.pickup_point))
  const [termsVersion, setTermsVersion] = useState<number | null>(null)
  const [commerceReady, setCommerceReady] = useState<boolean | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  useEffect(() => { if (cart.lines.length) track('begin_checkout') }, [cart.lines.length])
  useEffect(() => {
    if (!supabase) return
    let active = true
    void Promise.all([
      supabase.from('store_settings').select('value').eq('key', 'commerce_enabled').maybeSingle(),
      supabase.from('store_pages').select('version').eq('slug', 'termos-de-compra').eq('status', 'published').eq('approval_status', 'approved').maybeSingle(),
    ]).then(([setting, terms]) => {
      if (!active) return
      setCommerceReady(setting.data?.value === true)
      setTermsVersion(typeof terms.data?.version === 'number' ? terms.data.version : null)
    })
    return () => { active = false }
  }, [])
  const startPayment = async () => {
    if (!supabase || !user || !quote || !termsVersion || !acceptedTerms || !commerceReady || selectionMissing || processing) return
    setProcessing(true)
    setCheckoutError(null)
    try {
      const cartFingerprint = JSON.stringify({ lines: [...cart.lines].sort((a, b) => a.variant_id.localeCompare(b.variant_id)), termsVersion })
      const stored = JSON.parse(sessionStorage.getItem('ticket-rio-checkout-request') || 'null') as { fingerprint?: string; key?: string; createdAt?: number } | null
      const createdAt = stored?.fingerprint === cartFingerprint && stored.key && typeof stored.createdAt === 'number' && Date.now() - stored.createdAt < 31 * 60_000 ? stored.createdAt : Date.now()
      const key = createdAt === stored?.createdAt && stored?.key ? stored.key : crypto.randomUUID()
      sessionStorage.setItem('ticket-rio-checkout-request', JSON.stringify({ fingerprint: cartFingerprint, key, createdAt }))
      const { data, error: paymentError } = await supabase.functions.invoke('pagarme-checkout', {
        body: { lines: cart.lines, request_key: key, terms_version: termsVersion, attribution: getAttribution() },
      })
      if (paymentError || !isPagarmeCheckoutUrl(data?.checkout_url)) {
        throw new Error('payment_unavailable')
      }
      window.location.assign(data.checkout_url)
    } catch {
      setCheckoutError(tr('Não foi possível abrir o pagamento. Revise o carrinho e tente novamente; nenhuma cobrança foi feita aqui.', 'We could not open payment. Review your cart and try again; no charge was made here.', language))
      setProcessing(false)
    }
  }
  return <div className="page-container narrow-page checkout-page"><div className="page-intro"><span className="section-kicker">TICKET RIO · CHECKOUT SEGURO</span><h1>Revise sua experiência.</h1><p>Seu pedido começa aqui. O pagamento é concluído no ambiente seguro da Pagar.me.</p></div>{!cart.lines.length ? <Empty title="Carrinho vazio" detail="Selecione um produto para começar." action={<Link to="/ingressos">Ver catálogo</Link>} /> : <div className="checkout-layout"><div className="checkout-card"><div className="checkout-steps"><span>01 · Revisão</span><span>02 · Pagamento</span><span>03 · Acompanhamento</span></div><h2>Seu pedido</h2>{error && <p className="form-error" role="alert">{error}</p>}{quote?.items.map((item) => { const selection = cart.lines.find((line) => line.variant_id === item.variant_id); return <p key={item.variant_id}><span>{item.quantity} × {item.name}{selection?.service_date && <small className="checkout-line-detail">{new Date(`${selection.service_date}T12:00:00`).toLocaleDateString('pt-BR')}{selection.pickup_point ? ` · ${selection.pickup_point}` : ''}</small>}</span><strong>{money(item.line_total_cents)}</strong></p> })}<div className="order-total"><span>Total hoje</span><strong>{quote ? money(quote.total_cents) : 'Verificando…'}</strong></div><div className="checkout-trust"><strong>Pagamento protegido</strong><p>Cartão, Pix e boleto aparecem conforme a disponibilidade da sua conta na Pagar.me. O parcelamento máximo aceito será mostrado antes de pagar.</p></div></div><aside className="checkout-card checkout-action"><h2>Finalizar com confiança</h2><p>{user ? <>Conta: <strong>{user.email}</strong></> : <Link to="/login">Entre na sua conta para continuar →</Link>}</p><label className="checkout-terms"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>Li e aceito os <Link to="/termos-de-compra" target="_blank">Termos de compra</Link> e a <Link to="/politica-de-privacidade" target="_blank">Política de privacidade</Link>.</span></label>{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}{selectionMissing && <p className="form-error">Volte ao produto de transfer e escolha data e embarque antes de pagar.</p>}{commerceReady === false && <p className="form-hint">A venda online está sendo habilitada. Seus itens permanecem no carrinho.</p>}<button className="button checkout-pay" type="button" disabled={!user || !quote || !termsVersion || !acceptedTerms || !commerceReady || selectionMissing || processing} onClick={() => void startPayment()}>{processing ? 'Abrindo pagamento seguro…' : 'Ir para pagamento seguro →'}</button><small>Você será direcionado à Pagar.me. O ingresso oficial será disponibilizado após confirmação e processamento do pedido.</small></aside></div>}</div>
}

const legalPages = [
  ['politica-de-privacidade', 'Privacidade', 'Privacy'], ['politica-de-cookies', 'Cookies', 'Cookies'],
  ['termos-de-uso', 'Termos de uso', 'Terms of use'], ['termos-de-compra', 'Termos de compra', 'Purchase terms'],
  ['cancelamento-e-reembolso', 'Cancelamento e reembolso', 'Cancellation and refunds'],
] as const

function LegalBody({ text }: { text: string }) {
  return <div className="legal-copy">{text.trim().split(/\n\s*\n/).map((block, index) =>
    block.startsWith('## ') ? <h2 key={index}>{block.slice(3)}</h2>
      : block.startsWith('- ') ? <ul key={index}>{block.split('\n').map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^- /, '')}</li>)}</ul>
        : <p key={index}>{block}</p>
  )}</div>
}

export function StaticPage({ slug, title }: { slug: string; title: string }) {
  type PageContent = { title_pt: string; title_en: string | null; body_pt: string | null; body_en: string | null; approval_status: string; updated_at: string }
  const [loaded, setLoaded] = useState<{ slug: string; content: PageContent | null } | null>(null)
  const content = loaded?.slug === slug ? loaded.content : undefined
  const { language } = useStore()
  useEffect(() => { if (supabase) void supabase.from('store_pages').select('title_pt,title_en,body_pt,body_en,approval_status,updated_at').eq('slug', slug).eq('status', 'published').maybeSingle().then(({ data }) => setLoaded({ slug, content: data ?? null })); else setLoaded({ slug, content: null }) }, [slug])
  const policy = legalPages.some(([pageSlug]) => pageSlug === slug)
  const body = language === 'en' && content?.body_en ? content.body_en : content?.body_pt ?? ''
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">TICKET RIO</span><h1>{language === 'en' && content?.title_en ? content.title_en : content?.title_pt ?? title}</h1>{policy && content?.approval_status === 'approved' && <p className="legal-updated">{tr('Atualizado em', 'Updated on', language)} {new Date(content.updated_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}</p>}</div>{content === undefined ? <p role="status">{tr('Carregando conteúdo…', 'Loading content…', language)}</p> : content?.approval_status === 'approved' ? policy ? <LegalBody text={body} /> : <div className="rich-copy">{body}</div> : slug !== 'sobre' && <div className="pending-notice"><strong>Conteúdo pendente de aprovação</strong><p>{policy ? 'O texto desta política será publicado após revisão e aprovação pela Ticket Rio.' : 'As informações desta página estão em preparação. Fale com nossa equipe para orientações atualizadas.'}</p></div>}
    {policy && <nav className="legal-nav" aria-label={tr('Outras políticas', 'Other policies', language)}>{legalPages.filter(([pageSlug]) => pageSlug !== slug).map(([pageSlug, pt, en]) => <Link key={pageSlug} to={`/${pageSlug}`}>{tr(pt, en, language)} ↗</Link>)}</nav>}
    {slug === 'sambodromo' && <div className="editorial-grid"><article><h2>A Marquês de Sapucaí</h2><p>O Sambódromo recebe os desfiles do Carnaval do Rio. A escolha do ingresso envolve data, setor, lado e modalidade de ocupação.</p></article><article><h2>Setores e experiências</h2><p>Arquibancadas, frisas, cadeiras de pista e camarotes oferecem perspectivas diferentes da avenida. Consulte a descrição de cada produto publicado para saber o que está incluso.</p></article><article><h2>Programação</h2><p>Datas e ordem dos desfiles só aparecem aqui quando validadas pela operação. Regras de acesso e horários da edição serão divulgados após confirmação.</p><Link to="/ordem-dos-desfiles">Ver ordem dos desfiles →</Link></article></div>}
    {slug === 'como-comprar' && <div className="editorial-grid"><article><h2>1. Escolha</h2><p>Explore o catálogo e compare as opções publicadas. Produtos sob consulta levam ao atendimento.</p></article><article><h2>2. Pague</h2><p>Confira variante, quantidade, disponibilidade e orientações. Após aceitar os termos, conclua o pagamento no checkout seguro da Pagar.me.</p></article><article><h2>3. Acompanhe</h2><p>O status do pedido e da entrega fica na área do cliente. Comprovante de pagamento e ingresso oficial são documentos diferentes.</p></article></div>}
    {slug === 'sobre' && <section className="about-anniversary"><div className="about-anniversary__mark" aria-hidden="true"><strong>25</strong><span>{tr('ANOS', 'YEARS', language)}</span></div><div><span className="section-kicker">{tr('UMA HISTÓRIA COM O RIO', 'A STORY WITH RIO', language)}</span><h2>{tr('25 anos vivendo o Rio.', '25 years living Rio.', language)}</h2><p>{tr('A Ticket Rio conecta sua trajetória ao Carnaval e às experiências da cidade. Celebramos 25 anos de história com o olhar voltado para cada novo encontro com o Rio.', 'Ticket Rio is connected to Carnival and the experiences of the city. We celebrate 25 years of history while looking forward to every new encounter with Rio.', language)}</p><Link to="/contato">{tr('Fale com a Ticket Rio', 'Talk to Ticket Rio', language)} ↗</Link></div></section>}
  </div>
}
export function FaqPage() {
  const [faqs, setFaqs] = useState<{ id: string; question_pt: string; answer_pt: string; question_en: string | null; answer_en: string | null }[]>([])
  const { language } = useStore()
  useEffect(() => { if (supabase) void supabase.from('store_faqs').select('id,question_pt,answer_pt,question_en,answer_en').eq('status','published').order('sort_order').then(({ data }) => setFaqs(data ?? [])) }, [])
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">AJUDA</span><h1>{tr('Perguntas frequentes', 'Frequently asked questions', language)}</h1></div>{faqs.length ? faqs.map((faq) => <details className="faq-item" key={faq.id}><summary>{language === 'en' && faq.question_en ? faq.question_en : faq.question_pt}</summary><p>{language === 'en' && faq.answer_en ? faq.answer_en : faq.answer_pt}</p></details>) : <Empty title="Perguntas em preparação" detail="Fale com a equipe para tirar suas dúvidas enquanto este conteúdo é validado." action={<Link to="/contato">Entre em contato</Link>} />}</div>
}
export function ContactPage() {
  const { user, products, institution } = useStore()
  const [params] = useSearchParams()
  const choice = params.get('opcao')
  const [message, setMessage] = useState(choice ? `Gostaria de consultar a opção de embarque: ${choice}.` : '')
  const [status, setStatus] = useState('')
  const product = params.get('produto')
  const selectedProduct = products.find((item) => item.slug === product)
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !supabase) return
    const form = new FormData(event.currentTarget)
    const { error } = await supabase.from('inquiries').insert({ customer_id: user.id, name: String(form.get('name') ?? ''), email: user.email, phone: String(form.get('phone') ?? ''), message: message.trim(), product_id: selectedProduct?.id ?? null, ...getAttribution() })
    setStatus(error ? 'Não foi possível enviar agora. Tente novamente pelo e-mail.' : 'Consulta recebida. Nossa equipe poderá responder pelo e-mail da sua conta.')
    if (!error) setMessage('')
  }
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">FALE COM A GENTE</span><h1>Contato</h1><p>Conte o que você procura. {!institution.confirmed && 'Os dados institucionais abaixo estão sujeitos a confirmação.'}</p></div><div className="contact-grid"><div className="contact-card"><h2>{institution.name}</h2><p><a href={`mailto:${encodeURIComponent(institution.email)}`}>{institution.email}</a></p><p><a href={`https://wa.me/${/^\d{10,15}$/.test(institution.whatsapp) ? institution.whatsapp : '552120255000'}?text=${encodeURIComponent(selectedProduct ? `Olá, gostaria de consultar ${selectedProduct.name_pt}.${choice ? ` Ponto de embarque: ${choice}.` : ''}` : 'Olá, gostaria de atendimento Ticket Rio.')}`} target="_blank" rel="noreferrer">WhatsApp: {institution.phone} ↗</a></p><p>{institution.address}</p><p>{institution.hours}</p><a href={`https://maps.google.com/?q=${encodeURIComponent(institution.address)}`} target="_blank" rel="noreferrer">Abrir mapa ↗</a></div><div className="contact-card"><h2>Envie uma consulta</h2>{selectedProduct && <p>Sobre: {selectedProduct.name_pt}</p>}{user ? <form onSubmit={send} className="stack-form"><label>Nome<input name="name" required maxLength={120} /></label><label>Telefone<input name="phone" type="tel" maxLength={30} /></label><label>Mensagem<textarea required minLength={5} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} /></label><button className="button" type="submit">Enviar consulta</button>{status && <p role="status">{status}</p>}</form> : <p>Para registrar uma consulta, <Link to="/login">entre na sua conta</Link>. Você também pode usar o e-mail ou WhatsApp.</p>}</div></div></div>
}

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'recover' | 'reset' }) {
  const { user } = useStore()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) { setMessage('Autenticação indisponível.'); return }
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/conta')
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/conta` } })
        if (error) throw error
        setMessage('Confira seu e-mail para confirmar o cadastro, caso a confirmação esteja ativada.')
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })
        if (error) throw error
        setMessage('Se a conta existir, você receberá instruções por e-mail.')
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMessage('Senha atualizada. Você já pode acessar sua conta.')
      }
    } catch { setMessage('Não foi possível concluir. Confira os dados e tente novamente.') }
    finally { setBusy(false) }
  }
  if (user && mode === 'login') return <div className="page-container narrow-page"><p>Você já está conectado. <Link to="/conta">Ir para minha conta</Link></p></div>
  const title = { login: 'Entrar', register: 'Criar conta', recover: 'Recuperar senha', reset: 'Redefinir senha' }[mode]
  return <div className="page-container auth-page"><div className="page-intro"><span className="section-kicker">MINHA TICKET RIO</span><h1>{title}</h1></div><form className="stack-form auth-card" onSubmit={submit}>{mode !== 'reset' && <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>}{mode !== 'recover' && <label>{mode === 'reset' ? 'Nova senha' : 'Senha'}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>}<button className="button" type="submit" disabled={busy}>{busy ? 'Aguarde…' : title}</button>{message && <p role="status">{message}</p>}</form><div className="auth-links">{mode === 'login' ? <><Link to="/cadastro">Criar conta</Link><Link to="/recuperar-senha">Esqueci minha senha</Link></> : <Link to="/login">Voltar para login</Link>}</div></div>
}

export function AccountPage() {
  const { user } = useStore()
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [orders, setOrders] = useState<{ id: string; order_number: number; status: string; payment_status: string; delivery_status: string; total_cents: number; created_at: string }[]>([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!user || !supabase) return
    void supabase.from('customer_profiles').select('first_name,last_name,phone,country_code,document_type,document_number').eq('user_id', user.id).maybeSingle().then(({ data }) => setProfile(data ?? {}))
    void supabase.from('orders').select('id,order_number,status,payment_status,delivery_status,total_cents,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setOrders(data ?? []))
  }, [user])
  if (!user) return <div className="page-container narrow-page"><Empty title="Entre na sua conta" detail="Seus pedidos e dados ficam disponíveis após o login." action={<Link className="button" to="/login">Entrar</Link>} /></div>
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const { error } = await supabase.from('customer_profiles').upsert({ user_id: user.id, ...profile })
    setMessage(error ? 'Não foi possível salvar.' : 'Dados atualizados.')
  }
  return <div className="page-container"><div className="page-intro"><span className="section-kicker">MINHA TICKET RIO</span><h1>Minha conta</h1><p>{user.email}</p></div><div className="account-grid"><section className="account-card"><h2>Dados pessoais</h2><form className="stack-form" onSubmit={save}>{[['first_name','Nome'],['last_name','Sobrenome'],['phone','Telefone'],['country_code','País'],['document_type','Tipo de documento'],['document_number','Documento']].map(([key,label]) => <label key={key}>{label}<input value={profile[key] ?? ''} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} maxLength={120} /></label>)}<p className="form-hint">CPF é opcional para clientes estrangeiros. Informe apenas o documento necessário à sua reserva.</p><button className="button" type="submit">Salvar dados</button>{message && <p role="status">{message}</p>}</form></section><section className="account-card"><h2>Meus pedidos</h2>{orders.length ? <div className="order-list">{orders.map((order) => <Link to={`/pedidos/${order.id}`} key={order.id}><strong>Pedido #{order.order_number}</strong><span>{new Date(order.created_at).toLocaleDateString('pt-BR')} · {money(order.total_cents)}</span><small>{order.status} · {order.payment_status} · {order.delivery_status}</small></Link>)}</div> : <p>Você ainda não tem pedidos.</p>}<button className="text-button" type="button" onClick={() => void supabase?.auth.signOut()}>Sair da conta</button></section></div></div>
}
export function OrderPage() {
  const { id } = useParams()
  const { user } = useStore()
  const [order, setOrder] = useState<{ order_number: number; status: string; payment_status: string; delivery_status: string; total_cents: number; created_at: string; pagarme_checkout_url: string | null; order_items: { id: string; product_name: string; variant_name: string; quantity: number; unit_price_cents: number; attributes: Record<string, unknown> }[] } | null>(null)
  const [deliveries, setDeliveries] = useState<{ order_item_id: string; status: string; supplier: string | null; recipient_email: string | null; available_at: string | null; instructions: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!user || !supabase) { setLoading(false); return }
    let active = true
    const load = async () => {
      const client = supabase
      if (!client) return
      const { data } = await client.from('orders').select('order_number,status,payment_status,delivery_status,total_cents,created_at,pagarme_checkout_url,order_items(id,product_name,variant_name,quantity,unit_price_cents,attributes)').eq('id', id).eq('customer_id', user.id).maybeSingle()
      if (!active) return
      const current = data as typeof order
      setOrder(current)
      if (current?.order_items.length) {
        const result = await client.from('deliveries').select('order_item_id,status,supplier,recipient_email,available_at,instructions').in('order_item_id', current.order_items.map((item) => item.id))
        if (active) setDeliveries(result.data ?? [])
      } else setDeliveries([])
      if (active) setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [id, user])
  if (!user) return <div className="page-container narrow-page"><Empty title="Acesso necessário" detail="Entre para consultar seus pedidos." action={<Link to="/login">Entrar</Link>} /></div>
  if (loading) return <div className="page-container narrow-page"><p role="status">Carregando pedido…</p></div>
  if (!order) return <div className="page-container narrow-page"><Empty title="Pedido não encontrado" detail="Este pedido não existe ou não pertence à sua conta." /></div>
  const deliveryLabels: Record<string, string> = { awaiting_supplier: 'Aguardando fornecedor', processing: 'Em processamento', available_official_app: 'Disponibilizado no aplicativo oficial', missing_data: 'Pendência de dados', delivery_issue: 'Problema na entrega', cancelled: 'Cancelado' }
  const canResume = order.payment_status === 'pending' && isPagarmeCheckoutUrl(order.pagarme_checkout_url) && Date.now() - new Date(order.created_at).getTime() < 30 * 60_000
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">MINHA TICKET RIO</span><h1>Pedido #{order.order_number}</h1></div><div className="checkout-card"><p>Pedido: {order.status}</p><p>Pagamento: {order.payment_status}</p><p>Entrega: {order.delivery_status}</p>{order.order_items.map((item) => { const delivery = deliveries.find((entry) => entry.order_item_id === item.id); return <div key={item.id}><p><span>{item.quantity} × {item.product_name} · {item.variant_name}{typeof item.attributes.service_date === 'string' && <small className="checkout-line-detail">Data: {new Date(`${item.attributes.service_date}T12:00:00`).toLocaleDateString('pt-BR')}{typeof item.attributes.pickup_point === 'string' ? ` · Embarque: ${item.attributes.pickup_point}` : ''}</small>}</span><strong>{money(item.quantity * item.unit_price_cents)}</strong></p>{delivery && <div className="delivery-detail"><strong>Entrega oficial: {deliveryLabels[delivery.status] ?? delivery.status}</strong>{delivery.supplier && <span>Fornecedor: {delivery.supplier}</span>}{delivery.recipient_email && <span>Destinatário: {delivery.recipient_email}</span>}{delivery.available_at && <span>Disponibilizado em: {new Date(delivery.available_at).toLocaleDateString('pt-BR')}</span>}{delivery.instructions && <p>{delivery.instructions}</p>}</div>}</div> })}<div className="order-total"><span>Total</span><strong>{money(order.total_cents)}</strong></div>{canResume && <a className="button" href={order.pagarme_checkout_url!}>Continuar pagamento seguro →</a>}<button className="text-button" type="button" onClick={() => window.location.reload()}>Atualizar status</button></div><div className="pending-notice"><strong>Comprovante ≠ ingresso oficial</strong><p>Para ingressos oficiais, acompanhe o status de entrega. O acesso ao evento depende do ingresso disponibilizado pelo fornecedor no aplicativo oficial.</p></div></div>
}
