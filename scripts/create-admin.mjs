import {randomUUID} from 'node:crypto'
import {writeFile,chmod} from 'node:fs/promises'
import {resolve} from 'node:path'
import {database} from '../server/mongo/db.mjs'
import {email} from '../server/mongo/security.mjs'
import {issueToken} from '../server/mongo/auth.mjs'
const address=email(process.argv[2]??process.env.ADMIN_EMAIL)
const output=process.argv[3]
if(!output)throw new Error('Informe o caminho privado de saída do link de primeiro acesso.')
const {db,client}=await database()
try {
 let user=await db.collection('users').findOne({email:address})
 if(!user){user={id:randomUUID(),email:address,created_at:new Date().toISOString()};await db.collection('users').insertOne(user)}
 await db.collection('staff_roles').updateOne({user_id:user.id},{$set:{email:address,role:'administrator'},$setOnInsert:{id:randomUUID(),created_at:new Date().toISOString()}},{upsert:true})
 const link=await issueToken(db,user,'invite',process.env.ADMIN_SETUP_URL||process.env.SITE_URL||'http://localhost:5173',true)
 await writeFile(resolve(output),`Primeiro acesso TicketRio\nConta: ${address}\nDefina uma senha de pelo menos 12 caracteres pelo link abaixo. O link é de uso único e expira em uma hora.\n\n${link}\n`,{mode:0o600})
 await chmod(resolve(output),0o600)
 console.log('Administrador criado. Link salvo no arquivo privado informado; nenhuma senha padrão foi criada.')
}finally{await client.close()}
