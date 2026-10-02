import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const siteOrigin = 'https://ticketrioingressos.com.br'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const headers = {
  'Access-Control-Allow-Origin': siteOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const response = (value: unknown, status = 200) => Response.json(value, { status, headers })
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
const safeCompare = (a: string, b: string) => a.length === b.length && [...a].reduce((difference, value, index) => difference | (value.charCodeAt(0) ^ b.charCodeAt(index)), 0) === 0
const cleanAttribution = (value: unknown, limit: number) => typeof value === 'string' && value.length <= limit && /^[a-z0-9 _.-]+$/.test(value) ? value : null
type Input = { action?: string; name?: string; email?: string; topic_id?: string; product_id?: string | null; message?: string; id?: string; token?: string; website?: string; attribution?: { utm_source?: string; utm_medium?: string | null; utm_campaign?: string } | null }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response({ ok: true })
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)
  if (request.headers.get('origin') !== siteOrigin) return response({ error: 'forbidden_origin' }, 403)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !secret) return response({ error: 'unavailable' }, 503)
  const raw = await request.text()
  if (raw.length > 8000) return response({ error: 'too_large' }, 413)
  let input: Input
  try { input = JSON.parse(raw) as Input } catch { return response({ error: 'invalid_input' }, 400) }
  if (!input || typeof input !== 'object') return response({ error: 'invalid_input' }, 400)
  const admin = createClient(url, secret)

  try {
    if (input.action === 'start') {
      const name = input.name?.trim() ?? ''
      const email = input.email?.trim().toLowerCase() ?? ''
      const message = input.message?.trim() ?? ''
      if (input.website || name.length < 2 || name.length > 100 || !emailPattern.test(email) || email.length > 254 ||
        message.length < 5 || message.length > 2000 || !input.topic_id || !/^[a-z_]+$/.test(input.topic_id) ||
        (input.product_id && !uuid.test(input.product_id))) return response({ error: 'invalid_input' }, 400)
      const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const rateKey = await hash(`${secret}|start|${ip}|${email}`)
      const { data: permitted, error: rateError } = await admin.rpc('support_consume_rate_limit', { rate_key: rateKey, max_hits: 4, window_seconds: 3600 })
      if (rateError) return response({ error: 'unavailable' }, 503)
      if (!permitted) return response({ error: 'rate_limited' }, 429)
      const { data: topic } = await admin.from('support_topics').select('id,agent_key,active').eq('id', input.topic_id).maybeSingle()
      if (!topic?.active) return response({ error: 'topic_unavailable' }, 400)
      const { data: agent } = await admin.from('support_agents').select('queue_role').eq('agent_key', topic.agent_key).single()
      if (!agent) return response({ error: 'unavailable' }, 503)
      let productId: string | null = null
      if (input.product_id) {
        const { data: product } = await admin.from('store_products').select('id').eq('id', input.product_id).eq('status', 'published').maybeSingle()
        productId = product?.id ?? null
      }
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const { data: conversation, error: createError } = await admin.from('support_conversations').insert({
        topic_id: topic.id, agent_key: topic.agent_key, queue_role: agent.queue_role,
        product_id: productId, customer_name: name, customer_email: email,
        visitor_token_hash: await hash(token),
      }).select('id,created_at,status').single()
      if (createError || !conversation) return response({ error: 'create_failed' }, 503)
      const { error: messageError } = await admin.from('support_messages').insert({ conversation_id: conversation.id, sender_type: 'visitor', body: message })
      if (messageError) {
        await admin.from('support_conversations').delete().eq('id', conversation.id)
        return response({ error: 'create_failed' }, 503)
      }
      if (agent.queue_role === 'commercial') {
        const source = cleanAttribution(input.attribution?.utm_source, 80)
        const campaign = cleanAttribution(input.attribution?.utm_campaign, 120)
        const { data: inquiry, error: leadError } = await admin.from('inquiries').insert({
          name, email, message, product_id: productId,
          utm_source: source && campaign ? source : null,
          utm_medium: source && campaign ? cleanAttribution(input.attribution?.utm_medium, 80) : null,
          utm_campaign: source && campaign ? campaign : null,
        }).select('id').single()
        if (inquiry && !leadError) await admin.from('support_conversations').update({ inquiry_id: inquiry.id }).eq('id', conversation.id)
        else console.error('Support lead creation failed', conversation.id, leadError?.message)
      }
      return response({ id: conversation.id, token, status: conversation.status, created_at: conversation.created_at })
    }

    if (!input.id || !uuid.test(input.id) || !input.token || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) return response({ error: 'invalid_session' }, 401)
    const { data: conversation } = await admin.from('support_conversations').select('id,visitor_token_hash,status,topic_id,created_at,last_message_at').eq('id', input.id).maybeSingle()
    if (!conversation || !safeCompare(conversation.visitor_token_hash, await hash(input.token))) return response({ error: 'invalid_session' }, 401)

    if (input.action === 'thread') {
      const { data: messages, error } = await admin.from('support_messages').select('id,sender_type,body,created_at').eq('conversation_id', conversation.id).order('created_at').order('id').limit(200)
      return error ? response({ error: 'read_failed' }, 503) : response({ status: conversation.status, topic_id: conversation.topic_id, messages })
    }
    if (input.action === 'send') {
      const message = input.message?.trim() ?? ''
      if (message.length < 1 || message.length > 2000) return response({ error: 'invalid_message' }, 400)
      const { data: permitted, error: rateError } = await admin.rpc('support_consume_rate_limit', {
        rate_key: await hash(`${secret}|message|${conversation.id}`), max_hits: 12, window_seconds: 300,
      })
      if (rateError) return response({ error: 'unavailable' }, 503)
      if (!permitted) return response({ error: 'rate_limited' }, 429)
      const { error } = await admin.from('support_messages').insert({ conversation_id: conversation.id, sender_type: 'visitor', body: message })
      if (error) return response({ error: 'send_failed' }, 503)
      const now = new Date().toISOString()
      await admin.from('support_conversations').update({ status: 'waiting_staff', last_message_at: now, last_customer_message_at: now, closed_at: null }).eq('id', conversation.id)
      return response({ ok: true })
    }
    return response({ error: 'invalid_action' }, 400)
  } catch (error) {
    console.error('Support visitor exception', error instanceof Error ? error.message : 'unknown')
    return response({ error: 'unavailable' }, 503)
  }
})
