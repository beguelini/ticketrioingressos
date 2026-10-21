import {readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {BSON} from 'mongodb'
import {database} from '../server/mongo/db.mjs'
const root=resolve(process.argv[2]??'')
if(!process.argv[2])throw new Error('Informe a pasta de backup.')
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'))
const {db,client}=await database()
try {
 if(db.databaseName===manifest.database)throw new Error('Restaure em um novo banco, diferente da origem.')
 if((await db.listCollections({},{nameOnly:true}).toArray()).length)throw new Error('O destino deve estar vazio.')
 const verified=[]
 for(const record of manifest.collections) {
  if(!/^[a-zA-Z0-9_.-]+$/.test(record.name)||record.name.includes('..'))throw new Error('Nome de coleção inválido.')
  const data=await readFile(join(root,`${record.name}.ejson`),'utf8')
  if(createHash('sha256').update(data).digest('hex')!==record.sha256)throw new Error(`Hash inválido: ${record.name}`)
  const parsed=BSON.EJSON.parse(data,{relaxed:false})
  if(parsed.documents.length!==record.count)throw new Error(`Contagem inválida: ${record.name}`)
  verified.push({name:record.name,...parsed})
 }
 for(const {name,documents,indexes} of verified) {
  await db.createCollection(name)
  if(documents.length)await db.collection(name).insertMany(documents)
  for(const index of indexes) {if(index.name==='_id_')continue;const {key,...options}=index;delete options.v;delete options.ns;await db.collection(name).createIndex(key,options)}
 }
 console.log(`Restauração concluída: ${verified.length} coleções. Valide o novo banco antes de usá-lo.`)
}finally{await client.close()}
