import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const siteOrigin = 'https://ticketrioingressos.com.br'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const supportRoles = new Set(['administrator','commercial','operations','finance'])
const headers = {
  'Access-Control-Allow-Origin': siteOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const response = (value: unknown, status = 200) => Response.json(value, { status, headers })
type Input = { action?: string; id?: string; message?: string; status?: string; assigned_to?: string | null; topic_id?: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response({ ok: true })
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)
  if (request.headers.get('origin') !== siteOrigin) return response({ error: 'forbidden_origin' }, 403)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !publishable || !secret) return response({ error: 'unavailable' }, 503)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return response({ error: 'unauthorized' }, 401)
  const auth = createClient(url, publishable)
  const { data: { user }, error: userError } = await auth.auth.getUser(token)
  if (userError || !user) return response({ error: 'unauthorized' }, 401)
  const admin = createClient(url, secret)
  const { data: staff } = await admin.from('staff_roles').select('role').eq('user_id', user.id).maybeSingle()
  const role = staff?.role ?? ''
  if (!supportRoles.has(role)) return response({ error: 'forbidden' }, 403)
  const raw = await request.text()
  if (raw.length > 6000) return response({ error: 'too_large' }, 413)
  let input: Input
  try { input = JSON.parse(raw) as Input } catch { return response({ error: 'invalid_input' }, 400) }
  if (!input || typeof input !== 'object') return response({ error: 'invalid_input' }, 400)

  try {
    if (input.action === 'list') {
      let query = admin.from('support_conversations').select('id,topic_id,agent_key,queue_role,product_id,inquiry_id,customer_name,customer_email,status,assigned_to,created_at,last_message_at,last_customer_message_at,last_staff_read_at').order('last_message_at', { ascending: false }).limit(200)
      if (role !== 'administrator') query = query.eq('queue_role', role)
      const [conversations, topics, agents, members] = await Promise.all([
        query,
        admin.from('support_topics').select('id,category_pt,title_pt,agent_key,active').order('sort_order'),
        admin.from('support_agents').select('agent_key,name,queue_role,scope,guardrails,automation_status').order('name'),
        admin.from('staff_roles').select('user_id,email,role').in('role', ['administrator','commercial','operations','finance']),
      ])
      if (conversations.error || topics.error || agents.error || members.error) return response({ error: 'read_failed' }, 503)
      return response({ role, conversations: conversations.data, topics: topics.data, agents: agents.data, members: members.data })
    }
    if (!input.id || !uuid.test(input.id)) return response({ error: 'invalid_id' }, 400)
    const { data: conversation, error: conversationError } = await admin.from('support_conversations').select('id,topic_id,agent_key,queue_role,product_id,inquiry_id,customer_name,customer_email,status,assigned_to,created_at,last_message_at,last_customer_message_at,last_staff_read_at').eq('id', input.id).maybeSingle()
    if (conversationError || !conversation) return response({ error: 'not_found' }, 404)
    if (role !== 'administrator' && role !== conversation.queue_role) return response({ error: 'forbidden' }, 403)

    if (input.action === 'thread') {
      const [messages, product] = await Promise.all([
        admin.from('support_messages').select('id,sender_type,sender_id,body,created_at').eq('conversation_id', conversation.id).order('created_at').order('id').limit(300),
        conversation.product_id ? admin.from('store_products').select('name_pt,slug').eq('id', conversation.product_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (messages.error) return response({ error: 'read_failed' }, 503)
      await admin.from('support_conversations').update({ last_staff_read_at: new Date().toISOString() }).eq('id', conversation.id)
      return response({ conversation, messages: messages.data, product: product.data })
    }
    if (input.action === 'reply') {
      const message = input.message?.trim() ?? ''
      if (message.length < 1 || message.length > 2000) return response({ error: 'invalid_message' }, 400)
      const { error } = await admin.from('support_messages').insert({ conversation_id: conversation.id, sender_type: 'staff', sender_id: user.id, body: message })
      if (error) return response({ error: 'send_failed' }, 503)
      const now = new Date().toISOString()
      await admin.from('support_conversations').update({ assigned_to: conversation.assigned_to ?? user.id, status: 'waiting_customer', last_message_at: now, last_staff_message_at: now, last_staff_read_at: now, closed_at: null }).eq('id', conversation.id)
      return response({ ok: true })
    }
    if (input.action === 'status' && ['closed','waiting_staff'].includes(input.status ?? '')) {
      const closed = input.status === 'closed'
      const { error } = await admin.from('support_conversations').update({ status: input.status, closed_at: closed ? new Date().toISOString() : null }).eq('id', conversation.id)
      return error ? response({ error: 'update_failed' }, 503) : response({ ok: true })
    }
    if (input.action === 'assign') {
      const targetId = input.assigned_to ?? null
      if (targetId && !uuid.test(targetId)) return response({ error: 'invalid_assignee' }, 400)
      if (targetId) {
        const { data: target } = await admin.from('staff_roles').select('role').eq('user_id', targetId).maybeSingle()
        if (!target || (target.role !== conversation.queue_role && target.role !== 'administrator')) return response({ error: 'invalid_assignee' }, 400)
      }
      const { error } = await admin.from('support_conversations').update({ assigned_to: targetId }).eq('id', conversation.id)
      return error ? response({ error: 'update_failed' }, 503) : response({ ok: true })
    }
    if (input.action === 'reroute' && role === 'administrator' && input.topic_id && /^[a-z_]+$/.test(input.topic_id)) {
      const { data: topic } = await admin.from('support_topics').select('id,agent_key,active').eq('id', input.topic_id).maybeSingle()
      if (!topic?.active) return response({ error: 'topic_unavailable' }, 400)
      const { data: agent } = await admin.from('support_agents').select('queue_role').eq('agent_key', topic.agent_key).single()
      if (!agent) return response({ error: 'topic_unavailable' }, 400)
      const { error } = await admin.from('support_conversations').update({ topic_id: topic.id, agent_key: topic.agent_key, queue_role: agent.queue_role, assigned_to: null, status: 'waiting_staff', closed_at: null }).eq('id', conversation.id)
      return error ? response({ error: 'update_failed' }, 503) : response({ ok: true })
    }
    return response({ error: 'invalid_action' }, 400)
  } catch (error) {
    console.error('Support staff exception', error instanceof Error ? error.message : 'unknown')
    return response({ error: 'unavailable' }, 503)
  }
})
