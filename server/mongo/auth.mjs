import { randomUUID } from 'node:crypto'
import { digest, email, fail, passwordHash, passwordMatches, publicUser, rateLimit, secret } from './security.mjs'
const cookieName = process.env.NODE_ENV === 'production' ? '__Host-ticketrio-session' : 'ticketrio-session'
const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
export const cookie = (value, age = 604800) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`
export async function identity(db, req) {
  const value = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)
  if (!value) return {user:null,role:null}
  const session = await db.collection('sessions').findOne({_id:digest(value),expires_at:{$gt:new Date()}})
  if (!session) return {user:null,role:null}
  const user = await db.collection('users').findOne({id:session.user_id,disabled:{$ne:true}})
  const staff = user ? await db.collection('staff_roles').findOne({user_id:user.id}) : null
  return {user,role:staff?.role ?? null,session}
}
export async function issueSession(db,res,user) {
  const token = secret()
  await db.collection('sessions').insertOne({_id:digest(token),user_id:user.id,expires_at:new Date(Date.now()+604800000)})
  res.setHeader('Set-Cookie',cookie(token))
}
export async function issueToken(db,user,purpose,baseUrl,admin = false) {
  const token = secret()
  await db.collection('auth_tokens').insertOne({_id:digest(token),user_id:user.id,purpose,expires_at:new Date(Date.now()+3600000)})
  const url = new URL(admin ? '/admin' : purpose === 'verify' ? '/login' : '/redefinir-senha',baseUrl)
  url.hash = `token=${token}&type=${purpose === 'verify' ? 'verify' : 'recovery'}`
  return url.href
}
export async function sendAuthEmail(db,user,url,subject) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) fail('Envio de e-mail não configurado.',503)
  const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[user.email],subject,html:`<p>Ticket Rio</p><p><a href="${url.replaceAll('&','&amp;')}">Continuar com segurança</a></p><p>Este link expira em uma hora. Se você não solicitou, ignore esta mensagem.</p>`}),signal:AbortSignal.timeout(10000)})
  await db.collection('notification_attempts').insertOne({id:randomUUID(),customer_id:user.id,channel:'email',status:response.ok?'sent':'failed',created_at:new Date().toISOString()})
  if (!response.ok) fail('Não foi possível enviar o e-mail.',503)
}
export async function authAction(db,req,res,input,who,baseUrl) {
  const {action} = input
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown'
  await rateLimit(db,`auth:${ip}`,60,900)
  if (action === 'user') return {user:publicUser(who.user)}
  if (action === 'logout') { if(who.session) await db.collection('sessions').deleteOne({_id:who.session._id});res.setHeader('Set-Cookie',cookie('',0));return {ok:true} }
  if (action === 'login') {
    const address = email(input.email)
    await rateLimit(db,`login:${address}`,10,900)
    const user = await db.collection('users').findOne({email:address,disabled:{$ne:true}})
    // Perform the same expensive operation for unknown users.
    const valid = await passwordMatches(input.password,user?.password_hash ?? `${'00'.repeat(16)}:${'00'.repeat(64)}`)
    if (!valid || !user?.email_confirmed_at) fail('Confira o e-mail, a senha e a confirmação da conta.',401)
    await issueSession(db,res,user);return {user:publicUser(user)}
  }
  if (action === 'register') {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) fail('Cadastro por e-mail temporariamente indisponível.',503)
    const address = email(input.email); const hashed = await passwordHash(input.password)
    await rateLimit(db,`register:${ip}`,5,3600)
    let user = await db.collection('users').findOne({email:address})
    if (!user) {user={id:randomUUID(),email:address,password_hash:hashed,created_at:new Date().toISOString()};try{await db.collection('users').insertOne(user)}catch(e){if(e.code!==11000) throw e;user=null}}
    if(user && !user.email_confirmed_at) await sendAuthEmail(db,user,await issueToken(db,user,'verify',baseUrl),'Confirme sua conta Ticket Rio')
    return {ok:true}
  }
  if (action === 'recover') {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) fail('Recuperação por e-mail temporariamente indisponível.',503)
    const address=email(input.email);await rateLimit(db,`recover:${address}`,3,3600)
    const user=await db.collection('users').findOne({email:address,disabled:{$ne:true}})
    if(user) await sendAuthEmail(db,user,await issueToken(db,user,'reset',baseUrl,Boolean(await db.collection('staff_roles').findOne({user_id:user.id}))),'Recupere seu acesso Ticket Rio')
    return {ok:true}
  }
  if(action === 'verify' || action === 'password') {
    const hashed = action === 'password' ? await passwordHash(input.password) : null
    if(typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) fail('Link inválido ou expirado.',401)
    const token=await db.collection('auth_tokens').findOneAndDelete({_id:digest(input.token),purpose:action==='verify'?'verify':{$in:['reset','invite']},expires_at:{$gt:new Date()}})
    if(!token) fail('Link inválido ou expirado.',401)
    const update={email_confirmed_at:new Date().toISOString(),...(hashed?{password_hash:hashed}:{})}
    const user=await db.collection('users').findOneAndUpdate({id:token.user_id,disabled:{$ne:true}},{$set:update},{returnDocument:'after'})
    if(!user) fail('Conta indisponível.',401)
    await db.collection('auth_tokens').deleteMany({user_id:user.id});await db.collection('sessions').deleteMany({user_id:user.id});await issueSession(db,res,user)
    return {user:publicUser(user)}
  }
  fail('invalid_action')
}
