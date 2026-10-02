import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const pagarmeKey = Deno.env.get('PAGARME_SECRET_KEY') ?? ''
const siteUrl = 'https://ticketrioingressos.com.br'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    'Access-Control-Allow-Origin': siteUrl,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  } })
}

type CheckoutRequest = { lines?: { variant_id: string; quantity: number; service_date?: string; pickup_point?: string }[]; request_key?: string; terms_version?: number; attribution?: { utm_source?: string; utm_medium?: string | null; utm_campaign?: string } | null }
type PaymentLink = { id?: string; url?: string; errors?: unknown; message?: string }
const checkoutUrlPattern = /^https:\/\/payment-link(?:-v3)?\.pagar\.me\/pl_[A-Za-z0-9]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respond({ ok: true })
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405)
  if (!supabaseUrl || !anonKey || !serviceKey || !pagarmeKey) return respond({ error: 'checkout_unavailable' }, 503)

  try {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!bearer) return respond({ error: 'sign_in_required' }, 401)
    const auth = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await auth.auth.getUser(bearer)
    if (authError || !user) return respond({ error: 'sign_in_required' }, 401)
    const input = await req.json() as CheckoutRequest
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 20 ||
      input.lines.some((line) => !uuid.test(line.variant_id) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) ||
      !uuid.test(input.request_key ?? '') || !Number.isInteger(input.terms_version)) {
      return respond({ error: 'invalid_checkout' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: orderId, error: reserveError } = await admin.rpc('reserve_pagarme_order', {
      buyer_id: user.id, lines: input.lines, request_key: input.request_key,
      accepted_terms_version: input.terms_version,
    })
    if (reserveError || typeof orderId !== 'string') {
      const reason = reserveError?.message ?? 'reservation_failed'
      const known = ['commerce_disabled', 'unavailable_variant', 'terms_not_accepted', 'invalid_cart', 'duplicate_variant']
      return respond({ error: known.find((item) => reason.includes(item)) ?? 'reservation_failed' }, 409)
    }
    const [{ data: order, error: orderError }, { data: orderItems, error: itemsError }] = await Promise.all([
      admin.from('orders').select('id,customer_id,order_number,status,total_cents,expires_at,pagarme_link_id,pagarme_checkout_url').eq('id', orderId).single(),
      admin.from('order_items').select('product_name,variant_name,quantity,unit_price_cents,attributes').eq('order_id', orderId),
    ])
    if (orderError || itemsError || !order || !orderItems?.length || order.customer_id !== user.id ||
      order.status !== 'pending_payment' || new Date(order.expires_at).getTime() <= Date.now()) {
      return respond({ error: 'order_unavailable' }, 409)
    }
    const source = input.attribution?.utm_source
    const campaign = input.attribution?.utm_campaign
    if (source && campaign && /^[a-z0-9 _.-]{1,80}$/.test(source) && /^[a-z0-9 _.-]{1,120}$/.test(campaign)) {
      const medium = input.attribution?.utm_medium
      const { error: attributionError } = await admin.from('order_attribution').upsert({
        order_id: order.id, utm_source: source, utm_campaign: campaign,
        utm_medium: medium && /^[a-z0-9 _.-]{1,80}$/.test(medium) ? medium : null,
      }, { onConflict: 'order_id', ignoreDuplicates: true })
      if (attributionError) console.error('Order attribution save failed', order.id, attributionError.message)
    }
    if (order.pagarme_link_id && order.pagarme_checkout_url) {
      return respond({ order_id: order.id, checkout_url: order.pagarme_checkout_url })
    }
    if (orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0) !== order.total_cents) {
      return respond({ error: 'total_mismatch' }, 409)
    }

    const amount = order.total_cents as number
    const maxInstallments = Math.min(12, Math.max(1, Math.floor(amount / 1000)))
    const basePayload = {
      type: 'order', name: `Ticket Rio #${order.order_number}`, order_code: order.id,
      expires_in: 30, max_paid_sessions: 1,
      cart_settings: { items: orderItems.map((item) => ({
        name: `${item.product_name} · ${item.variant_name}${item.attributes?.service_date ? ` · ${item.attributes.service_date}` : ''}`.slice(0, 180),
        amount: item.unit_price_cents, default_quantity: item.quantity,
      })) },
      layout_settings: { primary_color: '#086be9', secondary_color: '#ffffff' },
      flow_settings: { success_url: `${siteUrl}/pedidos/${order.id}` },
    }
    const methodSets = [
      ['credit_card', 'pix', 'boleto'], ['credit_card', 'pix'], ['credit_card', 'boleto'],
      ['pix', 'boleto'], ['credit_card'], ['pix'], ['boleto'],
    ]
    let link: PaymentLink | null = null
    for (const methods of methodSets) {
      let installments = maxInstallments
      for (let attempt = 0; attempt < 2; attempt++) {
        const paymentSettings: Record<string, unknown> = {
          accepted_payment_methods: methods, statement_descriptor: 'TICKET RIO',
        }
        if (methods.includes('credit_card')) paymentSettings.credit_card_settings = {
          operation_type: 'auth_and_capture',
          installments: Array.from({ length: installments }, (_, index) => ({ number: index + 1, total: amount })),
        }
        if (methods.includes('pix')) paymentSettings.pix_settings = { expires_in: 3600 }
        if (methods.includes('boleto')) paymentSettings.boleto_settings = { due_in: 3 }
        const result = await fetch('https://api.pagar.me/core/v5/paymentlinks', {
          method: 'POST', signal: AbortSignal.timeout(15000),
          headers: { authorization: `Basic ${btoa(`${pagarmeKey}:`)}`, 'content-type': 'application/json',
            'Idempotency-Key': `ticket-rio-${order.id}` },
          body: JSON.stringify({ ...basePayload, payment_settings: paymentSettings }),
        })
        const candidate = await result.json() as PaymentLink
        if (result.ok) { link = candidate; break }
        const reason = JSON.stringify(candidate.errors ?? candidate.message ?? '').toLowerCase()
        console.error('Pagar.me payment configuration rejected', result.status, methods.join(','), reason.slice(0, 300))
        if (result.status !== 400 && result.status !== 422) return respond({ error: 'provider_unavailable' }, 503)
        if (methods.includes('credit_card') && installments > 1 && /installment|parcela/.test(reason)) {
          installments = 1
          continue
        }
        if (!/payment|pagamento|method|método|pix|boleto|credit.card|cartão/.test(reason)) {
          return respond({ error: 'provider_unavailable' }, 503)
        }
        break
      }
      if (link) break
    }
    if (!link?.id || !link.url || !checkoutUrlPattern.test(link.url)) {
      return respond({ error: 'provider_unavailable' }, 503)
    }
    const { error: saveError } = await admin.rpc('record_pagarme_link', {
      local_order_id: order.id, link_id: link.id, checkout_url: link.url,
    })
    if (saveError) {
      console.error('Payment link persistence failed', order.id, saveError.message)
      return respond({ error: 'checkout_retry' }, 503)
    }
    return respond({ order_id: order.id, checkout_url: link.url })
  } catch (error) {
    console.error('Pagar.me checkout exception', error instanceof Error ? error.message : 'unknown')
    return respond({ error: 'checkout_unavailable' }, 503)
  }
})
