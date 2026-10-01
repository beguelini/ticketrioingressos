export type ConsentPreferences = {
  version: 2
  analytics: boolean
  marketing: boolean
  updatedAt: string
}

export const consentKey = 'ticket-rio-consent-v2'
const consentLifetime = 365 * 24 * 60 * 60 * 1000

export function readConsent(): ConsentPreferences | null {
  try {
    const value = localStorage.getItem(consentKey)
    if (!value) return null
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const consent = parsed as Partial<ConsentPreferences>
    const age = Date.now() - Date.parse(consent.updatedAt ?? '')
    if (consent.version !== 2 || typeof consent.analytics !== 'boolean' || typeof consent.marketing !== 'boolean' || !Number.isFinite(age) || age < 0 || age > consentLifetime) return null
    return consent as ConsentPreferences
  } catch { return null }
}

export function saveConsent(analytics: boolean, marketing: boolean): ConsentPreferences {
  const consent: ConsentPreferences = { version: 2, analytics, marketing, updatedAt: new Date().toISOString() }
  localStorage.setItem(consentKey, JSON.stringify(consent))
  localStorage.removeItem('ticket-rio-consent')
  return consent
}
