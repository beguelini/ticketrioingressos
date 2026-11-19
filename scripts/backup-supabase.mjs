import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {database} from '../server/database.mjs'
import {collections,identifier} from '../server/postgres/schema.mjs'
const output=process.argv[2]
if(!output)throw Error('Informe uma pasta privada fora do repositorio.')
const {db,client}=await database()
try{
 if(db.kind!=='supabase')throw Error('Expected Supabase backend')
 const root=resolve(output);await mkdir(root,{recursive:false,mode:0o700})
 const manifest={database:db.databaseName,created_at:new Date().toISOString(),consistency:'repeatable read, read only transaction',collections:[]}
 await db.sql.begin('isolation level repeatable read read only',async tx=>{
  for(const name of collections){const rows=await tx.unsafe(`select key_id,document from ${identifier(db.databaseName)}.${identifier(name)} order by key_id`),data=JSON.stringify(rows);await writeFile(join(root,`${name}.json`),data,{mode:0o600});manifest.collections.push({name,count:rows.length,sha256:createHash('sha256').update(data).digest('hex')})}
 })
 await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});console.log(`Backup Supabase: ${manifest.collections.length} tabelas.`)
}finally{await client.close()}
