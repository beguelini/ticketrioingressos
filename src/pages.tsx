import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { tr, useStore } from './storeContext'
import { categories, money, supabase, type CatalogProduct, type ProductKind } from './store'
import { track } from './analytics'

function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span aria-hidden="true">✳</span><h2>{title}</h2><p>{detail}</p>{action}</div>
}
function ProductCard({ product }: { product: CatalogProduct }) {
  const { language } = useStore()
  const price = product.product_variants.filter((variant) => variant.price_cents !== null).sort((a, b) => (a.price_cents ?? 0) - (b.price_cents ?? 0))[0]
  const referencePrice = product.sales_mode === 'inquiry' && typeof product.attributes.source_price_cents === 'number'
  return <Link className="store-product-card" to={`/produto/${product.slug}`}>
    <div className="store-product-image">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <span aria-hidden="true">TR</span>}{product.promotion_label ? <span className={`store-product-badge store-product-badge--${product.promotion_color ?? 'blue'}`}>{product.promotion_label}</span> : product.sales_mode === 'inquiry' && <span className="store-product-badge">Sob consulta</span>}</div>
    <div className="store-product-body"><small>{categories.find((category) => category.kind === product.kind)?.[language === 'pt' ? 'pt' : 'en'] ?? product.kind}</small><h3>{language === 'en' && product.name_en ? product.name_en : product.name_pt}</h3><p>{language === 'en' && product.summary_en ? product.summary_en : product.summary_pt}</p><strong>{!price || (product.sales_mode === 'inquiry' && !referencePrice) ? tr('Consulte valores', 'Ask for a quote', language) : referencePrice ? tr(`Preço anunciado: ${money(price.price_cents ?? 0)}`, `Listed price: ${money(price.price_cents ?? 0, price.currency, language)}`, language) : <>{price.compare_at_cents && <del>{money(price.compare_at_cents, price.currency, language)}</del>}{tr(`A partir de ${money(price.price_cents ?? 0)}`, `From ${money(price.price_cents ?? 0, price.currency, language)}`, language)}</>}</strong>{referencePrice && <span className="price-note">Confirme valor e disponibilidade com a equipe.</span>}</div>
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
    { key: 'categories', defaultOrder: 1, element: <section className="section categories-section" key="categories"><SectionTitle eyebrow="EXPLORE" title={tr('O Rio do seu jeito.', 'Rio, your way.', language)} /><div className="category-grid">{categories.map((item) => <Link className="category-card" to={{ ticket: '/ingressos', package: '/camarotes', tour: '/city-tours', apparel: '/camisetas', metro: '/metro', transfer: '/transfers' }[item.kind]} key={item.kind}><img src={item.image} alt="" loading="lazy" /><span className="category-card__shade" /><span className="category-card__copy"><small>{products.some((product) => product.kind === item.kind) ? 'Ticket Rio' : tr('Em preparação', 'Coming soon', language)}</small><strong>{language === 'pt' ? item.pt : item.en}</strong></span><span className="category-card__arrow">↗</span></Link>)}</div></section> },
    { key: 'featured', defaultOrder: 2, element: <section className="section featured-section" key="featured"><SectionTitle eyebrow="ESCOLHAS EM DESTAQUE" title={tr('Seu próximo momento no Rio.', 'Your next Rio moment.', language)} link="/ingressos" />{loading ? <p role="status">Carregando catálogo…</p> : error ? <p role="alert">{error}</p> : featured.length ? <div className="product-grid">{featured.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <Empty title="Novidades em preparação" detail="A Ticket Rio está organizando os produtos e a disponibilidade. Consulte nossa equipe para planejar sua experiência." action={<Link className="button" to="/contato">Falar com a equipe</Link>} />}</section> },
    { key: 'calendar', defaultOrder: 2.5, element: eventDates.length > 0 && <section className="section calendar-section" key="calendar"><SectionTitle eyebrow="CALENDÁRIO" title="Datas dos desfiles" link="/ordem-dos-desfiles" /><div className="calendar-grid">{eventDates.map((date) => <div key={date.id}><strong>{new Date(`${date.event_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</strong><span>{date.parade_group}</span></div>)}</div></section> },
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
    <section className="hero"><img className="hero__image" src={banner?.image_url || '/images/sambadrome-hero.jpg'} alt="Desfile de Carnaval na Marquês de Sapucaí" /><div className="hero__shade" /><div className="hero__content"><span className="hero__eyebrow">TICKET RIO · CARNAVAL DO RIO</span><h1>{banner ? (language === 'en' && banner.title_en ? banner.title_en : banner.title_pt) : <>{tr('O Rio é o palco.', 'Rio is the stage.', language)}<br /><span>{tr('A avenida é sua.', 'The avenue is yours.', language)}</span></>}</h1><p>{tr('Ingressos, experiências e caminhos para viver o Rio.', 'Tickets, experiences and ways to discover Rio.', language)}</p><Link className="button button--primary" to={banner?.target_url?.startsWith('/') ? banner.target_url : '/ingressos'}>{tr('Explorar', 'Explore', language)} →</Link>{banners.length > 1 && <div className="banner-controls"><button type="button" onClick={() => setBannerIndex((bannerIndex + banners.length - 1) % banners.length)} aria-label="Banner anterior">←</button><button type="button" onClick={() => setBannerIndex((bannerIndex + 1) % banners.length)} aria-label="Próximo banner">→</button></div>}</div></section>
    <section className="home-search" aria-label="Encontrar ingressos e experiências"><div className="home-search__heading"><span>ENCONTRE SEU RIO</span><strong>Qual experiência combina com você?</strong></div><form onSubmit={submitSearch}><label className="home-search__query"><span className="sr-only">Buscar produto ou experiência</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input type="search" value={homeQuery} onChange={(event) => setHomeQuery(event.target.value)} placeholder="Busque um setor, camarote ou passeio" autoComplete="off" /></label><label className="home-search__select"><span className="sr-only">Tipo de experiência</span><select value={homeKind} onChange={(event) => setHomeKind(event.target.value as typeof homeKind)}><option value="all">Tudo no Rio</option><option value="ticket">Ingressos</option><option value="package">Camarotes</option><option value="tour">City Tours</option><option value="transfer">Transfers</option></select></label><label className="home-search__select"><span className="sr-only">Data do evento</span><select value={homeDate} onChange={(event) => setHomeDate(event.target.value)}><option value="">Qualquer data</option>{searchDates.map((date) => <option key={date} value={date}>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</option>)}</select></label><button className="home-search__submit" type="submit">Encontrar <span aria-hidden="true">↗</span></button></form>{suggestions.length > 0 && <div className="home-search__suggestions"><small>SUGESTÕES</small>{suggestions.map((product) => <Link key={product.id} to={`/produto/${product.slug}`}><span>{product.name_pt}</span><span aria-hidden="true">↗</span></Link>)}</div>}<div className="home-search__quick"><span>Explore agora</span><Link to="/ingressos">Ingressos</Link><Link to="/camarotes">Camarotes</Link><Link to="/city-tours">Rio City Tour</Link></div></section>
    {sections.filter((section) => visible(section.key)).sort((a, b) => (blocks.find((block) => block.block_key === a.key)?.sort_order ?? a.defaultOrder) - (blocks.find((block) => block.block_key === b.key)?.sort_order ?? b.defaultOrder)).map((section) => section.element)}
  </>
}

export function Catalog({ kind, title }: { kind?: ProductKind; title?: string }) {
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
  const filtered = products.filter((product) =>
    (!kind || product.kind === kind) &&
    (!search || `${product.name_pt} ${product.summary_pt ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) &&
    (!dates.length || (product.event_dates && dates.includes(product.event_dates.event_date))) &&
    (!selectedCategories.length || (product.category_id && selectedCategories.includes(product.category_id))) &&
    (!selectedSectors.length || selectedSectors.includes(String(product.attributes.sector ?? '')) || product.product_variants.some((variant) => selectedSectors.includes(String(variant.attributes?.sector ?? '')))) &&
    (!available || product.product_variants.some((variant) => variant.available && variant.stock_total > variant.stock_reserved))
  ).sort((a, b) => sort === 'nome' ? a.name_pt.localeCompare(b.name_pt) : sort === 'menor-preco'
    ? Math.min(...a.product_variants.map((v) => v.price_cents ?? Infinity)) - Math.min(...b.product_variants.map((v) => v.price_cents ?? Infinity))
    : Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order)
  const allDates = [...new Set(products.filter((product) => !kind || product.kind === kind).map((product) => product.event_dates?.event_date).filter((date): date is string => Boolean(date)))]
  const allSectors = [...new Set(products.filter((product) => !kind || product.kind === kind).flatMap((product) => [product.attributes.sector, ...product.product_variants.map((variant) => variant.attributes?.sector)]).filter((sector): sector is string => typeof sector === 'string' && sector.length > 0))]
  const categoryIds = new Set(products.filter((product) => !kind || product.kind === kind).map((product) => product.category_id))
  const relevantCategories = categoryOptions.filter((category) => categoryIds.has(category.id))
  const pageCount = Math.ceil(filtered.length / 12)
  const page = Math.min(requestedPage, Math.max(1, pageCount))
  const visibleProducts = filtered.slice((page - 1) * 12, page * 12)
  const titleText = title ?? categories.find((category) => category.kind === kind)?.[language === 'pt' ? 'pt' : 'en'] ?? 'Buscar experiências'
  const setParam = (key: string, value: string) => { const next = new URLSearchParams(params); next.delete('pagina'); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  const toggleMulti = (key: string, value: string, selected: string[]) => {
    const next = new URLSearchParams(params)
    next.delete(key); next.delete('pagina')
    const values = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
    values.forEach((item) => next.append(key, item))
    setParams(next)
  }
  return <div className="page-container"><div className="page-intro"><span className="section-kicker">TICKET RIO</span><h1>{titleText}</h1><p>Explore opções publicadas e confirme os detalhes antes de planejar sua compra.</p></div>
    <div className="catalog-toolbar"><label>Buscar<input type="search" value={search} onChange={(event) => setParam('busca', event.target.value)} placeholder="Nome ou experiência" /></label><label>Ordenar<select value={sort} onChange={(event) => setParam('ordem', event.target.value)}><option value="destaque">Destaques</option><option value="nome">Nome</option><option value="menor-preco">Menor preço</option></select></label><label className="inline-check"><input type="checkbox" checked={available} onChange={(event) => setParam('disponivel', event.target.checked ? '1' : '')} />Com disponibilidade</label></div>
    {allDates.length > 0 && <fieldset className="filter-dates"><legend>Datas</legend>{allDates.map((date) => <label key={date}><input type="checkbox" checked={dates.includes(date)} onChange={() => toggleMulti('data', date, dates)} />{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}</label>)}</fieldset>}
    {relevantCategories.length > 1 && <fieldset className="filter-dates"><legend>Categorias</legend>{relevantCategories.map((category) => <label key={category.id}><input type="checkbox" checked={selectedCategories.includes(category.id)} onChange={() => toggleMulti('categoria', category.id, selectedCategories)} />{language === 'en' && category.name_en ? category.name_en : category.name_pt}</label>)}</fieldset>}
    {allSectors.length > 0 && <fieldset className="filter-dates"><legend>Setores</legend>{allSectors.map((sector) => <label key={sector}><input type="checkbox" checked={selectedSectors.includes(sector)} onChange={() => toggleMulti('setor', sector, selectedSectors)} />{sector}</label>)}</fieldset>}
    {loading ? <p role="status">Carregando produtos…</p> : error ? <p role="alert">{error}</p> : filtered.length ? <><div className="product-grid catalog-grid">{visibleProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div>{pageCount > 1 && <nav className="pagination" aria-label="Paginação"><button type="button" disabled={page <= 1} onClick={() => setParam('pagina', String(page - 1))}>Anterior</button><span>Página {page} de {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setParam('pagina', String(page + 1))}>Próxima</button></nav>}</> : <Empty title="Nenhum produto publicado nesta seleção" detail="Os produtos e a disponibilidade desta categoria ainda estão sendo validados." action={search || dates.length || selectedCategories.length || selectedSectors.length || available ? <button className="button" type="button" onClick={() => setParams({})}>Limpar filtros</button> : <Link className="button" to="/contato">Falar com a equipe</Link>} />}
  </div>
}

export function ProductPage() {
  const { slug } = useParams()
  const { products, loading, cart, language } = useStore()
  const product = products.find((item) => item.slug === slug)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [sourceChoice, setSourceChoice] = useState('')
  const variant = product?.product_variants.find((item) => item.id === variantId) ?? product?.product_variants[0]
  useEffect(() => { setVariantId(product?.product_variants[0]?.id ?? ''); setQuantity(1); setAdded(false); setSourceChoice('') }, [product])
  useEffect(() => { if (product) track('view_item', { item_id: product.sku }) }, [product])
  if (loading) return <div className="page-container"><p role="status">Carregando produto…</p></div>
  if (!product) return <div className="page-container"><Empty title="Produto indisponível" detail="Este produto não está publicado ou foi removido." action={<Link to="/ingressos">Ver catálogo</Link>} /></div>
  const canCart = product.sales_mode === 'online' && variant && variant.available && variant.price_cents !== null && variant.stock_total - variant.stock_reserved >= variant.min_quantity
  const images = [product.image_url, ...product.gallery].filter((image): image is string => typeof image === 'string' && image.length > 0)
  const attributeLabels: Record<string, string> = { sector: 'Setor', side: 'Lado', row: 'Fila', seat: 'Assento', delivery: 'Entrega', supplier: 'Fornecedor', duration: 'Duração', frequency: 'Frequência', transport: 'Transporte', meeting_point: 'Embarque', capacity: 'Capacidade', size: 'Tamanho', color: 'Cor' }
  const details = Object.entries(product.attributes).filter(([key, value]) => attributeLabels[key] && (typeof value === 'string' || typeof value === 'number'))
  const sourceOptions = Array.isArray(product.attributes.source_options) ? product.attributes.source_options as { name?: string; options?: string[] }[] : []
  const sourceOption = sourceOptions.find((item) => Array.isArray(item.options) && item.options.length > 1)
  return <div className="page-container"><Link className="back-link" to={product.kind === 'tour' ? '/city-tours' : product.kind === 'transfer' ? '/transfers' : product.kind === 'package' ? '/camarotes' : '/ingressos'}>← Voltar ao catálogo</Link><div className="product-detail"><div className="product-gallery">{images.length ? images.map((image, index) => <img src={image} alt={Array.isArray(product.attributes.image_alts) && typeof product.attributes.image_alts[index] === 'string' ? product.attributes.image_alts[index] as string : `${product.name_pt} — imagem ${index + 1}`} key={image} />) : <div className="product-placeholder">Ticket Rio</div>}</div><div className="product-info"><span className="section-kicker">TICKET RIO</span><h1>{language === 'en' && product.name_en ? product.name_en : product.name_pt}</h1><p>{language === 'en' && product.summary_en ? product.summary_en : product.summary_pt}</p><div className="rich-copy">{language === 'en' && product.description_en ? product.description_en : product.description_pt}</div>
    {details.length > 0 && <dl className="product-attributes">{details.map(([key, value]) => <div key={key}><dt>{attributeLabels[key]}</dt><dd>{String(value)}</dd></div>)}</dl>}
    {sourceOption && <label className="field">{sourceOption.name === 'embarque' ? 'Hotel ou ponto de embarque' : sourceOption.name ?? 'Opção'}<select value={sourceChoice} onChange={(event) => setSourceChoice(event.target.value)}><option value="">Selecione para sua consulta</option>{sourceOption.options?.filter((option) => !/^(escolha|selecione)/i.test(option)).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
    {product.product_variants.length > 0 && <label className="field">Opção<select value={variant?.id ?? ''} onChange={(event) => { setVariantId(event.target.value); setQuantity(1) }}>{product.product_variants.map((item) => <option value={item.id} key={item.id}>{language === 'en' && item.name_en ? item.name_en : item.name_pt}{item.price_cents !== null ? ` · ${money(item.price_cents, item.currency, language)}` : ''}</option>)}</select></label>}
    <strong className="product-price">{typeof product.attributes.source_price_cents === 'number' && variant?.price_cents ? `Preço anunciado na origem: ${money(variant.price_cents, variant.currency, language)}` : product.sales_mode === 'inquiry' || !variant?.price_cents ? 'Consulte valores' : money(variant.price_cents, variant.currency, language)}</strong>
    {canCart ? <><label className="field">Quantidade<input type="number" min={variant.min_quantity} max={Math.min(variant.max_quantity, variant.stock_total - variant.stock_reserved)} value={quantity} onChange={(event) => setQuantity(Math.max(variant.min_quantity, Math.min(variant.max_quantity, Number(event.target.value) || 1)))} /></label><button className="button" type="button" onClick={() => { cart.add(variant.id, quantity); track('add_to_cart', { item_id: variant.sku, currency: variant.currency, value: (variant.price_cents ?? 0) * quantity / 100 }); setAdded(true) }}>Adicionar ao carrinho</button>{added && <p role="status">Adicionado. <Link to="/carrinho">Ver carrinho</Link></p>}</> : <Link className="button" to={`/contato?produto=${encodeURIComponent(product.slug)}${sourceChoice ? `&opcao=${encodeURIComponent(sourceChoice)}` : ''}`}>Consultar a equipe</Link>}
    <p className="product-fineprint">A compra online será ativada após confirmação de preços, disponibilidade, termos e pagamento. Um comprovante de compra não equivale a ingresso oficial.</p>
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
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">SUA SELEÇÃO</span><h1>Carrinho</h1></div>{cart.lines.length === 0 ? <Empty title="Seu carrinho está vazio" detail="Explore as experiências disponíveis." action={<Link className="button" to="/ingressos">Explorar ingressos</Link>} /> : <><div className="cart-list">{cart.lines.map((line) => { const product = products.find((item) => item.product_variants.some((variant) => variant.id === line.variant_id)); const variant = product?.product_variants.find((item) => item.id === line.variant_id); return <div className="cart-line" key={line.variant_id}><div><strong>{product?.name_pt ?? 'Produto indisponível'}</strong><span>{variant?.name_pt ?? 'Opção indisponível'} · {line.quantity} un.</span></div><button type="button" onClick={() => cart.remove(line.variant_id)}>Remover</button></div> })}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="order-total"><span>Total calculado pelo banco</span><strong>{quote ? money(quote.total_cents) : 'Verificando…'}</strong></div><p>Vendas online em preparação. Nenhuma reserva ou cobrança é feita ao montar o carrinho.</p><Link className="button" to="/checkout">Continuar</Link></>}</div>
}
export function CheckoutPage() {
  const { cart, user } = useStore()
  const { quote, error } = useCartQuote()
  useEffect(() => { if (cart.lines.length) track('begin_checkout') }, [cart.lines.length])
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">TICKET RIO</span><h1>Checkout</h1></div>{!cart.lines.length ? <Empty title="Carrinho vazio" detail="Selecione um produto para começar." action={<Link to="/ingressos">Ver catálogo</Link>} /> : <div className="checkout-card"><h2>Resumo da seleção</h2>{error && <p role="alert">{error}</p>}{quote?.items.map((item) => <p key={item.variant_id}>{item.quantity} × {item.name}<strong>{money(item.line_total_cents)}</strong></p>)}<div className="order-total"><span>Total</span><strong>{quote ? money(quote.total_cents) : 'Verificando…'}</strong></div><p>{user ? `Conta: ${user.email}` : <Link to="/login">Entre na sua conta para continuar</Link>}</p><div className="pending-notice"><strong>Vendas online em preparação</strong><p>A etapa de pagamento será disponibilizada depois da configuração do gateway e da aprovação dos dados comerciais e jurídicos. Nenhuma cobrança ou reserva será criada aqui.</p></div></div>}</div>
}

export function StaticPage({ slug, title }: { slug: string; title: string }) {
  const [content, setContent] = useState<{ title_pt: string; title_en: string | null; body_pt: string | null; body_en: string | null; approval_status: string } | null>(null)
  const { language } = useStore()
  useEffect(() => { if (supabase) void supabase.from('store_pages').select('title_pt,title_en,body_pt,body_en,approval_status').eq('slug', slug).eq('status', 'published').maybeSingle().then(({ data }) => setContent(data)) }, [slug])
  const policy = ['politica-de-privacidade','termos-de-compra','cancelamento-e-reembolso'].includes(slug)
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">TICKET RIO</span><h1>{language === 'en' && content?.title_en ? content.title_en : content?.title_pt ?? title}</h1></div>{content?.approval_status === 'approved' ? <div className="rich-copy">{language === 'en' && content.body_en ? content.body_en : content.body_pt}</div> : <div className="pending-notice"><strong>Conteúdo pendente de aprovação</strong><p>{policy ? 'O texto desta política será publicado após revisão e aprovação pela Ticket Rio.' : 'As informações desta página estão em preparação. Fale com nossa equipe para orientações atualizadas.'}</p></div>}
    {slug === 'sambodromo' && <div className="editorial-grid"><article><h2>A Marquês de Sapucaí</h2><p>O Sambódromo recebe os desfiles do Carnaval do Rio. A escolha do ingresso envolve data, setor, lado e modalidade de ocupação.</p></article><article><h2>Setores e experiências</h2><p>Arquibancadas, frisas, cadeiras de pista e camarotes oferecem perspectivas diferentes da avenida. Consulte a descrição de cada produto publicado para saber o que está incluso.</p></article><article><h2>Programação</h2><p>Datas e ordem dos desfiles só aparecem aqui quando validadas pela operação. Regras de acesso e horários da edição serão divulgados após confirmação.</p><Link to="/ordem-dos-desfiles">Ver ordem dos desfiles →</Link></article></div>}
    {slug === 'como-comprar' && <div className="editorial-grid"><article><h2>1. Escolha</h2><p>Explore o catálogo e compare as opções publicadas. Produtos sob consulta levam ao atendimento.</p></article><article><h2>2. Confirme</h2><p>Confira variante, quantidade, disponibilidade e orientações. A venda online será ativada quando o pagamento estiver configurado.</p></article><article><h2>3. Acompanhe</h2><p>Após uma compra real, o status do pedido e da entrega ficará na área do cliente. Comprovante e ingresso oficial são documentos diferentes.</p></article></div>}
    {slug === 'sobre' && <p className="rich-copy">A Ticket Rio apresenta experiências ligadas ao Carnaval e ao turismo no Rio de Janeiro. Informações institucionais detalhadas serão publicadas após confirmação pela empresa.</p>}
  </div>
}
export function FaqPage() {
  const [faqs, setFaqs] = useState<{ id: string; question_pt: string; answer_pt: string; question_en: string | null; answer_en: string | null }[]>([])
  const { language } = useStore()
  useEffect(() => { if (supabase) void supabase.from('store_faqs').select('id,question_pt,answer_pt,question_en,answer_en').eq('status','published').order('sort_order').then(({ data }) => setFaqs(data ?? [])) }, [])
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">AJUDA</span><h1>{tr('Perguntas frequentes', 'Frequently asked questions', language)}</h1></div>{faqs.length ? faqs.map((faq) => <details className="faq-item" key={faq.id}><summary>{language === 'en' && faq.question_en ? faq.question_en : faq.question_pt}</summary><p>{language === 'en' && faq.answer_en ? faq.answer_en : faq.answer_pt}</p></details>) : <Empty title="Perguntas em preparação" detail="Fale com a equipe para tirar suas dúvidas enquanto este conteúdo é validado." action={<Link to="/contato">Entre em contato</Link>} />}</div>
}
export function ParadePage() {
  const [entries, setEntries] = useState<{ id: string; parade_order: number; expected_at: string | null; parade_schools: { name: string } | null; event_dates: { event_date: string; parade_group: string } | null }[]>([])
  useEffect(() => { if (supabase) void supabase.from('parade_lineup').select('id,parade_order,expected_at,parade_schools(name),event_dates(event_date,parade_group)').eq('status','published').order('parade_order').then(({ data }) => setEntries((data ?? []) as unknown as typeof entries)) }, [])
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">SAMBÓDROMO</span><h1>Ordem dos desfiles</h1><p>A programação aparece aqui depois de validada e publicada pela equipe.</p></div>{entries.length ? <ol className="lineup-list">{entries.map((entry) => <li key={entry.id}><strong>{entry.parade_schools?.name}</strong><span>{entry.event_dates?.parade_group} · {entry.event_dates?.event_date ? new Date(`${entry.event_dates.event_date}T12:00:00`).toLocaleDateString('pt-BR') : ''}{entry.expected_at ? ` · ${entry.expected_at.slice(0,5)}` : ''}</span></li>)}</ol> : <Empty title="Programação em validação" detail="Datas e ordem dos desfiles serão exibidas quando houver confirmação oficial." />}</div>
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
    const { error } = await supabase.from('inquiries').insert({ customer_id: user.id, name: String(form.get('name') ?? ''), email: user.email, phone: String(form.get('phone') ?? ''), message: message.trim(), product_id: selectedProduct?.id ?? null })
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
  const [order, setOrder] = useState<{ order_number: number; status: string; payment_status: string; delivery_status: string; total_cents: number; order_items: { id: string; product_name: string; variant_name: string; quantity: number; unit_price_cents: number }[] } | null>(null)
  const [deliveries, setDeliveries] = useState<{ order_item_id: string; status: string; supplier: string | null; recipient_email: string | null; available_at: string | null; instructions: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!user || !supabase) { setLoading(false); return }
    let active = true
    const load = async () => {
      const client = supabase
      if (!client) return
      const { data } = await client.from('orders').select('order_number,status,payment_status,delivery_status,total_cents,order_items(id,product_name,variant_name,quantity,unit_price_cents)').eq('id', id).eq('customer_id', user.id).maybeSingle()
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
  return <div className="page-container narrow-page"><div className="page-intro"><span className="section-kicker">MINHA TICKET RIO</span><h1>Pedido #{order.order_number}</h1></div><div className="checkout-card"><p>Pedido: {order.status}</p><p>Pagamento: {order.payment_status}</p><p>Entrega: {order.delivery_status}</p>{order.order_items.map((item) => { const delivery = deliveries.find((entry) => entry.order_item_id === item.id); return <div key={item.id}><p>{item.quantity} × {item.product_name} · {item.variant_name}<strong>{money(item.quantity * item.unit_price_cents)}</strong></p>{delivery && <div className="delivery-detail"><strong>Entrega oficial: {deliveryLabels[delivery.status] ?? delivery.status}</strong>{delivery.supplier && <span>Fornecedor: {delivery.supplier}</span>}{delivery.recipient_email && <span>Destinatário: {delivery.recipient_email}</span>}{delivery.available_at && <span>Disponibilizado em: {new Date(delivery.available_at).toLocaleDateString('pt-BR')}</span>}{delivery.instructions && <p>{delivery.instructions}</p>}</div>}</div> })}<div className="order-total"><span>Total</span><strong>{money(order.total_cents)}</strong></div></div><div className="pending-notice"><strong>Comprovante ≠ ingresso oficial</strong><p>Para ingressos oficiais, acompanhe o status de entrega. O acesso ao evento depende do ingresso disponibilizado pelo fornecedor no aplicativo oficial.</p></div></div>
}
