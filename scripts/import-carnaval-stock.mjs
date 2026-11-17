import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {BSON} from 'mongodb'
import {database} from '../server/mongo/db.mjs'
import manifest from '../data/inventory-carnaval-2027.json' with {type:'json'}

const batch='inventory-carnaval-2027-20261117'
const output=process.argv[2]
if(!output)throw Error('Informe uma pasta privada nova para o backup.')
const {db,client}=await database()
try {
  if(!['ticketrio','ticketrio_preview'].includes(db.databaseName))throw Error('Banco não autorizado.')
  if(await db.collection('audit_log').findOne({action:batch}))throw Error('Lote já aplicado; não reimporte estoque após vendas.')
  const backup=resolve(output)
  await mkdir(backup,{recursive:false,mode:0o700})
  // Snapshot only the collections this operation may change, inside the transaction.
  const session=client.startSession()
  let result
  try {await session.withTransaction(async()=>{
    if((await db.collection('store_settings').findOne({key:'commerce_enabled'},{session}))?.value===true)throw Error('Suspenda vendas antes de importar estoque.')
    if(await db.collection('stock_reservations').countDocuments({status:'reserved'},{session}))throw Error('Há reservas ativas; revisão manual necessária.')
    const products=await db.collection('store_products').find({},{session}).toArray()
    const variants=await db.collection('product_variants').find({},{session}).toArray()
    const categories=await db.collection('store_categories').find({},{session}).toArray()
    for(const [name,documents] of [['store_products',products],['product_variants',variants]])await writeFile(join(backup,`${name}.ejson`),BSON.EJSON.stringify(documents,{relaxed:false}),{mode:0o600})
    const ingressos=categories.find(c=>c.slug==='ingressos'),camarotes=categories.find(c=>c.slug==='camarotes')
    if(!ingressos||!camarotes||manifest.items.length!==120||manifest.items.reduce((s,i)=>s+i.quantity,0)!==417)throw Error('Catálogo ou manifesto divergente.')
    result={items:0,created:0,priced:0,stock:0,unpriced:[]}
    for(const item of manifest.items) {
      const date=item.date.split('-').reverse().join('/')
      const matches=products.filter(p=>p.name_pt.includes(date)&&(item.type==='Camarote'?p.kind==='package'&&p.name_pt.toUpperCase().includes(item.lounge):p.kind==='ticket'&&p.name_pt.toUpperCase().includes(item.type.toUpperCase())&&new RegExp(`SETOR\\s*0?${item.sector}\\b`,'i').test(p.name_pt)))
      if(matches.length>1)throw Error(`Correspondência ambígua: ${item.key}`)
      let product=matches[0]
      const label=item.type==='Camarote'?`Camarote ${item.lounge} — ${date}`:`${item.type} — Setor ${item.sector}${item.row?` — Fila ${item.row}`:''} — ${date}`
      if(!product) {
        const sku=`TR-${item.date}-${item.type.toUpperCase()}-${item.sector||item.lounge.replaceAll(' ','-')}${item.row?`-${item.row}`:''}`
        product={id:randomUUID(),sku,slug:sku.toLowerCase(),kind:item.type==='Camarote'?'package':'ticket',category_id:(item.type==='Camarote'?camarotes:ingressos).id,name_pt:label,name_en:null,summary_pt:`${label}. Entrega oficial coordenada pela equipe via WhatsApp.`,description_pt:null,image_url:ingressos.image_url,gallery:[],status:'draft',sales_mode:'inquiry',featured:false,sort_order:100,attributes:{},created_at:new Date().toISOString()}
        await db.collection('store_products').insertOne(product,{session});result.created++
      }
      const found=variants.filter(v=>v.product_id===product.id)
      if(found.length>1||found.some(v=>v.stock_reserved))throw Error(`Variantes exigem revisão: ${product.sku}`)
      const variant=found[0]
      const price=variant?.price_cents>0?variant.price_cents:product.attributes?.source_price_cents??null
      if(price!==null&&(!Number.isSafeInteger(price)||price<=0))throw Error('Preço inválido.')
      const attributes={...product.attributes,inventory_batch:batch,inventory_key:item.key,event_date:item.date,...(item.sector?{sector:item.sector}:{}),...(item.row?{row:item.row}:{}),stock_policy:'finite',reference_only:price===null}
      await db.collection('store_products').updateOne({id:product.id},{$set:{attributes,sales_mode:price?'online':'inquiry'}},{session})
      const fields={stock_total:item.quantity,stock_reserved:0,price_cents:price,currency:'BRL',available:price!==null&&item.quantity>0,min_quantity:1,max_quantity:10,attributes:{event_date:item.date,...(item.sector?{sector:item.sector}:{}),...(item.row?{row:item.row}:{})}}
      if(variant)await db.collection('product_variants').updateOne({id:variant.id},{$set:fields},{session})
      else await db.collection('product_variants').insertOne({id:randomUUID(),sku:`${product.sku}-PADRAO`,product_id:product.id,name_pt:label,...fields},{session})
      result.items++;result.stock+=item.quantity
      if(price)result.priced++;else result.unpriced.push({key:item.key,name:label,quantity:item.quantity})
    }
    await db.collection('audit_log').insertOne({_id:batch,id:randomUUID(),action:batch,created_at:new Date().toISOString(),summary:{...result,unpriced:result.unpriced.length}},{session})
  })}finally{await session.endSession()}
  await writeFile(join(backup,'result.json'),JSON.stringify(result,null,2),{mode:0o600})
  console.log(JSON.stringify({...result,unpriced:result.unpriced.length}))
}finally{await client.close()}
