import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {BSON} from 'mongodb'
const {EJSON}=BSON
import {database} from '../server/mongo/db.mjs'
const output=process.argv[2]
if(!output)throw new Error('Informe uma pasta privada de backup fora do repositório.')
const root=resolve(output)
await mkdir(root,{recursive:false,mode:0o700})
const {db,client}=await database()
try {
 const manifest={database:db.databaseName,created_at:new Date().toISOString(),consistency:'Run while application writes are stopped. Files are EJSON, including binary uploads and auth records.',collections:[]}
 for(const {name} of await db.listCollections({},{nameOnly:true}).toArray()) {
  const documents=await db.collection(name).find({}).toArray(),indexes=await db.collection(name).indexes()
  const data=EJSON.stringify({documents,indexes},{relaxed:false})
  await writeFile(join(root,`${name}.ejson`),data,{mode:0o600})
  manifest.collections.push({name,count:documents.length,sha256:createHash('sha256').update(data).digest('hex')})
 }
 await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600})
 console.log(`Backup concluído: ${manifest.collections.length} coleções.`)
}finally{await client.close()}
