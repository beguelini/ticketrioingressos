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
let started = false
export function startAnalytics() {
  if (started || localStorage.getItem('ticket-rio-consent') !== 'accepted') return
  started = true
  const gtm = import.meta.env.VITE_GTM_ID
  if (gtm && /^GTM-[A-Z0-9]+$/.test(gtm)) {
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`
    document.head.append(script)
  }
  const pixel = import.meta.env.VITE_META_PIXEL_ID
  if (pixel && /^\d+$/.test(pixel)) {
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
  if (localStorage.getItem('ticket-rio-consent') !== 'accepted') return
  if (event === 'purchase') {
    if (!data.order_id || sessionStorage.getItem(`ticket-rio-purchase-${data.order_id}`)) return
    sessionStorage.setItem(`ticket-rio-purchase-${data.order_id}`, '1')
  }
  window.dataLayer?.push({ event, ...data })
  const meta = { page_view: 'PageView', view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' }[event]
  window.fbq?.('track', meta, { content_ids: data.item_id ? [data.item_id] : undefined, currency: data.currency, value: data.value })
}
