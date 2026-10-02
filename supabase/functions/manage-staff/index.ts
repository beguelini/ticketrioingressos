import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const origin = 'https://ticketrioingressos.com.br'
const roles = new Set(['administrator', 'commercial', 'operations', 'finance', 'marketing'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
function reply(body: unknown, status = 200) { return Response.json(body, { status, headers }) }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return reply({ ok: true })
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !publishable || !secret) return reply({ error: 'unavailable' }, 503)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply({ error: 'unauthorized' }, 401)
  const auth = createClient(url, publishable)
  const { data: { user }, error: userError } = await auth.auth.getUser(token)
  if (userError || !user) return reply({ error: 'unauthorized' }, 401)
  const admin = createClient(url, secret)
  const { data: staff, error: roleError } = await admin.from('staff_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (roleError || staff?.role !== 'administrator') return reply({ error: 'forbidden' }, 403)
  let body: { action?: string; email?: string; role?: string; user_id?: string }
  try { body = await request.json() } catch { return reply({ error: 'invalid_input' }, 400) }

  if (body.action === 'invite') {
    const email = body.email?.trim().toLowerCase() ?? ''
    if (!emailPattern.test(email) || email.length > 254 || !roles.has(body.role ?? '')) return reply({ error: 'invalid_input' }, 400)
    let existingId: string | null = null
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return reply({ error: 'user_lookup_failed' }, 503)
      existingId = data.users.find((entry) => entry.email?.toLowerCase() === email)?.id ?? null
      if (existingId || data.users.length < 1000) break
    }
    let targetId = existingId
    if (!targetId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/admin` })
      if (error || !data.user) return reply({ error: 'invite_failed', detail: error?.message }, 409)
      targetId = data.user.id
    }
    const { error } = await admin.from('staff_roles').upsert({ user_id: targetId, role: body.role, email }, { onConflict: 'user_id' })
    if (error) return reply({ error: 'role_save_failed' }, 503)
    return reply({ ok: true, invited: !existingId })
  }

  if ((body.action === 'update' || body.action === 'revoke') && body.user_id && body.user_id !== user.id) {
    const { data: target } = await admin.from('staff_roles').select('role').eq('user_id', body.user_id).maybeSingle()
    if (!target) return reply({ error: 'not_found' }, 404)
    if (target.role === 'administrator') {
      const { count, error } = await admin.from('staff_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'administrator')
      if (error || (count ?? 0) <= 1) return reply({ error: 'last_administrator' }, 409)
    }
    if (body.action === 'revoke') {
      const { error } = await admin.from('staff_roles').delete().eq('user_id', body.user_id)
      return error ? reply({ error: 'role_save_failed' }, 503) : reply({ ok: true })
    }
    if (!roles.has(body.role ?? '')) return reply({ error: 'invalid_input' }, 400)
    const { error } = await admin.from('staff_roles').update({ role: body.role }).eq('user_id', body.user_id)
    return error ? reply({ error: 'role_save_failed' }, 503) : reply({ ok: true })
  }
  return reply({ error: 'invalid_input' }, 400)
})
