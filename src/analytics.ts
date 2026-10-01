import { readConsent } from './consent'

type EventName = 'page_view' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase'
type EventData = { item_id?: string; currency?: string; value?: number; order_id?: string; path?: string }
type PixelFn = ((...args: unknown[]) => void) & { queue?: unknown[][]; loaded?: boolean; version?: string }
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
    fbq?: PixelFn
    _fbq?: PixelFn
  }
}
let gtmStarted = false
let pixelStarted = false
export function startAnalytics() {
  const consent = readConsent()
  if (!consent) return
  const gtm = import.meta.env.VITE_GTM_ID
  // A GTM container may include advertising tags, so require both choices.
  if (!gtmStarted && consent.analytics && consent.marketing && gtm && /^GTM-[A-Z0-9]+$/.test(gtm)) {
    gtmStarted = true
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`
    document.head.append(script)
  }
  const pixel = import.meta.env.VITE_META_PIXEL_ID
  if (!pixelStarted && consent.marketing && pixel && /^\d+$/.test(pixel)) {
    pixelStarted = true
    const stub: PixelFn = (...args: unknown[]) => { (stub.queue ??= []).push(args) }
    stub.loaded = true
    stub.version = '2.0'
    stub.queue = []
    window.fbq = stub
    window._fbq = stub
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.append(script)
    window.fbq('init', pixel)
  }
}
export function track(event: EventName, data: EventData = {}) {
  const consent = readConsent()
  if (!consent || (!consent.analytics && !consent.marketing)) return
  if (event === 'purchase') {
    if (!data.order_id || sessionStorage.getItem(`ticket-rio-purchase-${data.order_id}`)) return
    sessionStorage.setItem(`ticket-rio-purchase-${data.order_id}`, '1')
  }
  if (consent.analytics && consent.marketing) window.dataLayer?.push({ event, ...data })
  const meta = { page_view: 'PageView', view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' }[event]
  if (consent.marketing) window.fbq?.('track', meta, { content_ids: data.item_id ? [data.item_id] : undefined, currency: data.currency, value: data.value })
}
