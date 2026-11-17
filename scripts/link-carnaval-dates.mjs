import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {BSON} from 'mongodb'
import {database} from '../server/mongo/db.mjs'
import manifest from '../data/inventory-carnaval-2027.json' with {type:'json'}
if(!process.argv[2])throw Error('Informe uma pasta privada nova para backup.')
const output=resolve(process.argv[2])
const {db,client}=await database()
try {
  if(!['ticketrio','ticketrio_preview'].includes(db.databaseName))throw Error('Banco não autorizado.')
  await mkdir(output,{mode:0o700})
  const session=client.startSession()
  try{await session.withTransaction(async()=>{
    if((await db.collection('store_settings').findOne({key:'commerce_enabled'},{session}))?.value===true)throw Error('Operação exige vendas desativadas.')
    for(const table of ['events','event_dates','store_products'])await writeFile(join(output,`${table}.ejson`),BSON.EJSON.stringify(await db.collection(table).find({},{session}).toArray(),{relaxed:false}),{mode:0o600})
    let event=await db.collection('events').findOne({year:2027,title_pt:'Carnaval do Rio 2027'},{session})
    if(!event){event={id:randomUUID(),year:2027,title_pt:'Carnaval do Rio 2027',status:'published'};await db.collection('events').insertOne(event,{session})}
    for(const date of new Set(manifest.items.map(i=>i.date))) {
      let row=await db.collection('event_dates').findOne({event_date:date},{session})
      if(!row){row={id:randomUUID(),event_id:event.id,event_date:date,parade_group:date<='2027-02-06'?'Série Ouro':date==='2027-02-13'?'Campeãs':'Grupo Especial',status:'published'};await db.collection('event_dates').insertOne(row,{session})}
      const result=await db.collection('store_products').updateMany({'attributes.inventory_batch':'inventory-carnaval-2027-20261117','attributes.event_date':date},{$set:{event_date_id:row.id}},{session})
      if(!result.matchedCount)throw Error('Estoque ainda não importado.')
    }
  })}finally{await session.endSession()}
  console.log('Seis datas vinculadas ao catálogo de 2027; nenhum estoque ou preço alterado.')
}finally{await client.close()}
