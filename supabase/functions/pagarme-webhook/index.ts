import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const pagarmeKey = Deno.env.get('PAGARME_SECRET_KEY') ?? ''
const accountId = Deno.env.get('PAGARME_ACCOUNT_ID') ?? ''
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const orderIdPattern = /^or_[A-Za-z0-9]+$/

type Webhook = { id?: string; type?: string; account?: { id?: string }; data?: {
  id?: string; order?: { id?: string }; charge?: { order?: { id?: string } }
} }
type ProviderOrder = { id?: string; code?: string; status?: string; currency?: string; items?: {
  amount?: number; quantity?: number
}[]; charges?: { id?: string; amount?: number; status?: string; payment_method?: string }[] }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
  if (!supabaseUrl || !serviceKey || !pagarmeKey || !accountId) return Response.json({ error: 'unavailable' }, { status: 503 })
  try {
    const raw = await req.text()
    if (raw.length > 65536) return Response.json({ error: 'payload_too_large' }, { status: 413 })
    const event = JSON.parse(raw) as Webhook
    if (event.account?.id !== accountId || !/^hook_[A-Za-z0-9]+$/.test(event.id ?? '') ||
      !/^(order\.|charge\.|checkout\.)/.test(event.type ?? '')) {
      return Response.json({ error: 'invalid_event' }, { status: 400 })
    }
    const providerOrderId = event.data?.order?.id ?? event.data?.charge?.order?.id ??
      (orderIdPattern.test(event.data?.id ?? '') ? event.data?.id : undefined)
    if (!providerOrderId || !orderIdPattern.test(providerOrderId)) {
      // A link-only event has no order to reconcile. No fulfillment is changed.
      return Response.json({ ignored: true })
    }

    // Pagar.me v5 does not document a signature for these webhooks. Never trust
    // the event's payment status: fetch the order with our server-only key.
    const response = await fetch(`https://api.pagar.me/core/v5/orders/${providerOrderId}`, {
      headers: { authorization: `Basic ${btoa(`${pagarmeKey}:`)}` },
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return Response.json({ error: 'provider_lookup_failed' }, { status: 503 })
    const providerOrder = await response.json() as ProviderOrder
    if (providerOrder.id !== providerOrderId || !uuid.test(providerOrder.code ?? '') ||
      providerOrder.currency !== 'BRL' || !Array.isArray(providerOrder.items) ||
      !Array.isArray(providerOrder.charges)) return Response.json({ error: 'invalid_provider_order' }, { status: 400 })
    const providerTotal = providerOrder.items.reduce((sum, item) => sum +
      (Number.isInteger(item.amount) && Number.isInteger(item.quantity) ? item.amount! * item.quantity! : NaN), 0)
    if (!Number.isSafeInteger(providerTotal) || providerTotal <= 0) {
      return Response.json({ error: 'invalid_provider_amount' }, { status: 400 })
    }
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: localOrder, error: localError } = await admin.from('orders')
      .select('id,total_cents,pagarme_link_id,pagarme_order_id').eq('id', providerOrder.code).maybeSingle()
    if (localError || !localOrder || !localOrder.pagarme_link_id ||
      (localOrder.pagarme_order_id && localOrder.pagarme_order_id !== providerOrderId) ||
      localOrder.total_cents !== providerTotal) return Response.json({ error: 'order_mismatch' }, { status: 409 })

    const charge = providerOrder.charges.find((item) => item.status?.toLowerCase() === 'paid') ??
      providerOrder.charges.find((item) => item.status?.toLowerCase() === 'refunded') ??
      providerOrder.charges[0]
    if (charge?.amount !== undefined && charge.amount !== providerTotal) {
      return Response.json({ error: 'charge_mismatch' }, { status: 409 })
    }
    const orderStatus = providerOrder.status?.toLowerCase()
    const chargeStatus = charge?.status?.toLowerCase()
    const verifiedStatus = chargeStatus === 'refunded' ? 'refunded'
      : orderStatus === 'paid' && chargeStatus === 'paid' ? 'paid'
        : orderStatus === 'canceled' ? 'canceled'
          : orderStatus === 'failed' ? 'failed' : 'pending'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const { data, error } = await admin.rpc('apply_verified_pagarme_event', {
      local_order_id: localOrder.id, provider_order_id: providerOrderId,
      provider_charge_id: charge?.id ?? '', provider_method: charge?.payment_method ?? '',
      verified_status: verifiedStatus, verified_amount: providerTotal,
      external_event_id: event.id, event_type: event.type, payload_hash: hash,
    })
    if (error) {
      console.error('Pagar.me event persistence failed', localOrder.id, error.message)
      return Response.json({ error: 'persistence_failed' }, { status: 503 })
    }
    return Response.json({ ok: true, result: data })
  } catch (error) {
    console.error('Pagar.me webhook exception', error instanceof Error ? error.message : 'unknown')
    return Response.json({ error: 'processing_failed' }, { status: 503 })
  }
})
