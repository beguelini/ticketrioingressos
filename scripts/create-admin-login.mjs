import { randomUUID, randomBytes } from 'node:crypto'
import { open, unlink } from 'node:fs/promises'
import { database } from '../server/mongo/db.mjs'
import { email, passwordHash } from '../server/mongo/security.mjs'

const address = email(process.argv[2])
const output = process.argv[3]
if (!output) throw new Error('Informe o arquivo privado de saída.')
// Refuse to overwrite any previously delivered credentials.
const file = await open(output, 'wx', 0o600)
let client, committed = false
try {
  const connection = await database()
  client = connection.client
  const db = connection.db
  if (!['ticketrio', 'ticketrio_preview'].includes(db.databaseName)) throw new Error('Banco não autorizado.')
  await db.collection('users').createIndex({username:1}, {unique:true,sparse:true})
  const password = randomBytes(24).toString('base64url')
  const now = new Date().toISOString()
  const user = {id:randomUUID(),email:address,username:'admin',password_hash:await passwordHash(password),email_confirmed_at:now,created_at:now}
  await file.writeFile(`Ticket Rio · acesso administrativo\nPainel: ${process.env.SITE_URL || 'https://ticketrioingressos.com.br'}/admin\nUsuário: admin\nSenha: ${password}\nE-mail de recuperação: ${address}\nPermissão: administrador completo\n`)
  await file.sync()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      if (await db.collection('users').findOne({$or:[{email:address},{username:'admin'}]}, {session})) throw new Error('Conta ou usuário já existe; nenhuma senha foi alterada.')
      await db.collection('users').insertOne(user, {session})
      await db.collection('staff_roles').insertOne({id:randomUUID(),user_id:user.id,email:address,role:'administrator',created_at:now}, {session})
      await db.collection('audit_log').insertOne({id:randomUUID(),action:'create_admin_login',user_id:user.id,created_at:now}, {session})
    })
    committed = true
  } finally { await session.endSession() }
  console.log('Conta admin criada. Credenciais salvas no arquivo privado; senha omitida dos logs.')
} finally {
  await file.close()
  if (!committed) await unlink(output)
  await client?.close()
}
