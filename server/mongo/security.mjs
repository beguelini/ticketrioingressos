import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCallback)
export const digest = (value) => createHash('sha256').update(String(value)).digest('hex')
export const secret = () => randomBytes(32).toString('base64url')
export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
export function text(value, min = 0, max = 2000) { if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail('invalid_input'); return value.trim() }
export function email(value) { const result = text(value, 3, 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('invalid_email'); return result }
export async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) fail('Use uma senha de 12 a 128 caracteres.')
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${Buffer.from(await scrypt(password,salt,64)).toString('hex')}`
}
export async function passwordMatches(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || !encoded) return false
  const [salt,hash] = encoded.split(':'); const expected = Buffer.from(hash,'hex')
  const actual = Buffer.from(await scrypt(password,salt,64))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
export async function rateLimit(db, key, max, seconds) {
  const now = Date.now(); const window = Math.floor(now / (seconds * 1000))
  const row = await db.collection('rate_limits').findOneAndUpdate({_id:digest(`${key}:${window}`)},{$inc:{hits:1},$setOnInsert:{expires_at:new Date((window+1)*seconds*1000)}},{upsert:true,returnDocument:'after'})
  if (row.hits > max) fail('Muitas tentativas. Aguarde e tente novamente.',429)
}
export function safeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_input')
  for (const [key,item] of Object.entries(value)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) || ['__proto__','constructor','prototype'].includes(key)) fail('invalid_field')
    if (item && typeof item === 'object') { if (Array.isArray(item)) item.forEach((v) => { if (v && typeof v === 'object') safeObject(v) }); else safeObject(item) }
  }
  return value
}
export function clean(row) { if (!row) return null; const {_id, password_hash, token_hash, visitor_token_hash, ...result} = row; void _id; void password_hash; void token_hash; void visitor_token_hash; return result }
export const publicUser = (row) => row ? {id:row.id,email:row.email,email_confirmed_at:row.email_confirmed_at ?? null} : null
