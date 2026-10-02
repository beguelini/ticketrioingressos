import { readConsent } from './consent'

export type Attribution = { utm_source: string; utm_medium: string | null; utm_campaign: string }
const key = 'ticket-rio-attribution-v1'
const clean = (value: string | null, limit: number) => value?.trim().toLowerCase().slice(0, limit).replace(/[^a-z0-9 _.-]/g, '') || null

export function captureAttribution() {
  if (!readConsent()?.marketing) { sessionStorage.removeItem(key); return }
  const params = new URLSearchParams(window.location.search)
  const utm_source = clean(params.get('utm_source'), 80)
  const utm_campaign = clean(params.get('utm_campaign'), 120)
  if (utm_source && utm_campaign) sessionStorage.setItem(key, JSON.stringify({ utm_source, utm_campaign, utm_medium: clean(params.get('utm_medium'), 80), at: Date.now() }))
}

export function getAttribution(): Attribution | null {
  if (!readConsent()?.marketing) return null
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Attribution & { at: number }
    if (!value || Date.now() - value.at > 30 * 86400_000) return null
    const utm_source = clean(value.utm_source, 80)
    const utm_campaign = clean(value.utm_campaign, 120)
    return utm_source && utm_campaign ? { utm_source, utm_campaign, utm_medium: clean(value.utm_medium, 80) } : null
  } catch { return null }
}
