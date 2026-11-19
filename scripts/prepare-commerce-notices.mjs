import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {BSON} from 'mongodb'
import {database} from '../server/database.mjs'
import notices from '../data/commerce-notices-restored.json' with {type:'json'}
if(!process.argv[2])throw Error('Informe uma pasta privada nova para backup dos avisos.')
const output=resolve(process.argv[2])
const {db,client}=await database()
try {
  if(!['ticketrio','ticketrio_preview'].includes(db.databaseName))throw Error('Banco não autorizado.')
  await mkdir(output,{mode:0o700})
  const session=client.startSession()
  try{await session.withTransaction(async()=>{
    if((await db.collection('store_settings').findOne({key:'commerce_enabled'},{session}))?.value===true)throw Error('Operação exige vendas desativadas.')
    const current=await db.collection('store_pages').find({slug:{$in:notices.map(p=>p.slug)}},{session}).toArray()
    if(current.length!==3||current.some(p=>p.approval_status==='approved'))throw Error('Avisos existentes exigem revisão; não sobrescrever edições aprovadas.')
    await writeFile(join(output,'store_pages.ejson'),BSON.EJSON.stringify(current,{relaxed:false}),{mode:0o600})
    for(const page of notices)await db.collection('store_pages').updateOne({slug:page.slug},{$set:page},{session})
  })}finally{await session.endSession()}
  console.log('Avisos de compra anteriores restaurados, com operação atual e atendimento manual via WhatsApp. Vendas permanecem desativadas.')
}finally{await client.close()}
