import {readFileSync,mkdirSync,writeFileSync,chmodSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {createHash} from 'node:crypto'
import {MongoClient} from 'mongodb'
import {openPostgres,createDatabase} from '../server/postgres/db.mjs'
import {collections,identifier} from '../server/postgres/schema.mjs'
// Explicit private env paths prevent accidentally reading another project's credentials.
const [sourcePath,targetPath,reportPath]=process.argv.slice(2)
if(!sourcePath||!targetPath||!reportPath)throw Error('Usage: node scripts/migrate-to-supabase.mjs SOURCE_ENV TARGET_ENV REPORT_DIRECTORY')
const source=parseEnv(readFileSync(sourcePath,'utf8')),target=parseEnv(readFileSync(targetPath,'utf8'))
if((source.MONGODB_DB??'ticketrio')!=='ticketrio'||!['ticketrio','ticketrio_preview'].includes(target.SUPABASE_DB_SCHEMA)||!target.SUPABASE_DB_URL?.includes('mgnyisszebmxlvxsaghz'))throw Error('TicketRio source/target guard failed')
const mongo=new MongoClient(source.MONGODB_URI),sql=openPostgres(target.SUPABASE_DB_URL),schema=target.SUPABASE_DB_SCHEMA
const normalize=value=>JSON.parse(JSON.stringify(value,(_,v)=>v?._bsontype==='Binary'?{base64:Buffer.from(v.buffer).toString('base64')}:v))
const digest=rows=>createHash('sha256').update(JSON.stringify(rows.sort((a,b)=>String(a._id).localeCompare(String(b._id))))).digest('hex')
try{
 await mongo.connect()
 const documents={}
 for(const name of collections)documents[name]=(await mongo.db('ticketrio').collection(name).find({}).toArray()).map(normalize)
 // Preview does not inherit live browser sessions, recovery links or customer leads.
 if(schema==='ticketrio_preview')for(const name of ['sessions','auth_tokens','rate_limits','inquiries'])documents[name]=[]
 const {db}=createDatabase(sql,schema),report={source:'ticketrio',target:schema,created_at:new Date().toISOString(),collections:{}}
 await sql.begin(async tx=>{
  for(const name of collections){
   const table=`${identifier(schema)}.${identifier(name)}`
   const [{count}]=await tx.unsafe(`select count(*)::integer as count from ${table}`)
   if(count)throw Error(`Target must be empty: ${name}`)
   if(documents[name].length)await tx.unsafe(`insert into ${table}(key_id,document) select coalesce(value->>'id',value->>'_id'),value from jsonb_array_elements($1::text::jsonb)`,[JSON.stringify(documents[name])])
   const imported=(await tx.unsafe(`select document from ${table}`)).map(r=>r.document)
   const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v
   const canonical=rows=>rows.map(stable)
   const sourceHash=digest(canonical(documents[name])),targetHash=digest(canonical(imported))
   if(sourceHash!==targetHash)throw Error(`Verification failed: ${name}`)
   report.collections[name]={count:imported.length,sha256:targetHash}
  }
 })
 mkdirSync(reportPath,{recursive:true,mode:0o700})
 const file=`${reportPath}/migration-${schema}.json`;writeFileSync(file,JSON.stringify(report,null,2),{mode:0o600});chmodSync(file,0o600)
 console.log(JSON.stringify({target:db.databaseName,collections:collections.length,records:Object.values(report.collections).reduce((n,r)=>n+r.count,0),verified:true}))
}finally{await Promise.allSettled([mongo.close(),sql.end({timeout:5})])}
