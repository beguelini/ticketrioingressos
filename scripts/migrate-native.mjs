import {readFile} from 'node:fs/promises'
import {parseEnv} from 'node:util'
import {MongoClient} from 'mongodb'
const [sourceFile,targetFile]=process.argv.slice(2)
if(!sourceFile||!targetFile)throw new Error('Informe os arquivos privados de origem e destino.')
const sourceConfig=parseEnv(await readFile(sourceFile,'utf8')),targetConfig=parseEnv(await readFile(targetFile,'utf8'))
if(!sourceConfig.MONGODB_URI||!targetConfig.MONGODB_URI)throw new Error('Credenciais ausentes.')
if(new URL(sourceConfig.MONGODB_URI).hostname===new URL(targetConfig.MONGODB_URI).hostname)throw new Error('A migração exige clusters diferentes.')
const source=new MongoClient(sourceConfig.MONGODB_URI),target=new MongoClient(targetConfig.MONGODB_URI)
try {
 await Promise.all([source.connect(),target.connect()])
 const src=source.db(sourceConfig.MONGODB_DB||'ticketrio'),dst=target.db(targetConfig.MONGODB_DB||'ticketrio')
 if((await dst.listCollections({},{nameOnly:true}).toArray()).length)throw new Error('Destino não vazio: nenhum registro foi sobrescrito.')
 let total=0
 for(const {name} of await src.listCollections({},{nameOnly:true}).toArray()) {
  const rows=await src.collection(name).find({}).toArray()
  await dst.createCollection(name)
  if(rows.length)await dst.collection(name).insertMany(rows)
  for(const index of await src.collection(name).indexes()) {
   if(index.name==='_id_')continue
   const {key,...options}=index;delete options.v;delete options.ns
   await dst.collection(name).createIndex(key,options)
  }
  const count=await dst.collection(name).countDocuments()
  if(!['sessions','auth_tokens','rate_limits'].includes(name)&&count!==rows.length)throw new Error(`Contagem divergente: ${name}`)
  total+=count
 }
 console.log(JSON.stringify({database:dst.databaseName,documents:total,migrated:true,sourcePreserved:true}))
}finally{await Promise.all([source.close(),target.close()])}
