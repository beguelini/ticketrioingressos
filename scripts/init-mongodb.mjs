import {randomUUID} from 'node:crypto'
import {readFile,access} from 'node:fs/promises'
import {database,initialize} from '../server/mongo/db.mjs'
import seed from '../server/mongo/seed.json' with {type:'json'}
const {db,client}=await database()
try {
  await initialize(db)
  for(const [table,records] of Object.entries(seed))for(const raw of records) {
    const row={id:randomUUID(),status:'draft',created_at:new Date().toISOString(),...raw}
    if(table==='store_settings' && typeof row.value==='string'){try{row.value=JSON.parse(row.value)}catch{ /* Plain string setting. */ }}
    const key=table==='store_pages'?'slug':table==='store_settings'?'key':table==='home_blocks'?'block_key':table==='support_agents'?'agent_key':table==='store_categories'?'slug':'id'
    if(table==='support_topics')row.active=true
    if(table==='support_agents')row.automation_status='planned'
    await db.collection(table).updateOne({[key]:row[key]},{$setOnInsert:row},{upsert:true})
  }
  await db.collection('store_settings').updateOne({key:'commerce_enabled'},{$setOnInsert:{id:randomUUID(),value:false}},{upsert:true})
  const categorySpecs=[['ingressos','Ingressos','ticket','/images/ingressos/05-arquibancada.jpg'],['ensaio-tecnico','Ensaio Técnico','ticket','/images/ensaio-tecnico.jpg'],['camarotes','Camarotes','package','/images/camarote-vista.webp'],['transfers','Transfers','transfer','/images/rio-pelo-mar.webp'],['city-tours','Rio City Tour','tour','/images/pao-de-acucar.webp'],['metro','Metrô','metro','/images/santa-teresa-bonde.webp'],['camisetas','Camisetas','apparel','/images/bloco-de-rua.webp']]
  const categories=new Map()
  for(const [slug,name,kind,image] of categorySpecs) {
    await db.collection('store_categories').updateOne({slug},{$setOnInsert:{id:randomUUID(),slug,name_pt:name,status:'published',sort_order:categories.size,image_url:image}},{upsert:true})
    categories.set(slug,{...(await db.collection('store_categories').findOne({slug})),kind,image})
  }
  const legacy=JSON.parse(await readFile(new URL('../data/legacy-catalog-2026-10-01.json',import.meta.url),'utf8'))
  for(const p of legacy.products) {
    const category=categories.get(p.category_slug)??[...categories.values()].find((c)=>c.kind===p.kind)??categories.get('ingressos')
    const local=`/images/camarotes/${p.slug}.jpg`
    let image=p.image_url?.startsWith('/')?p.image_url:category.image
    try{await access(new URL(`../public${local}`,import.meta.url));image=local}catch{ /* Use a local category image when the legacy storage is unavailable. */ }
    const record={id:randomUUID(),sku:p.sku,slug:p.slug,kind:p.kind,category_id:category.id,event_date_id:null,name_pt:p.name_pt,name_en:p.name_en??null,summary_pt:p.summary_pt??null,description_pt:p.description_pt??null,image_url:image,gallery:p.gallery??[],attributes:{...p.attributes,source_url:p.source_url,reference_only:true},included_pt:p.included_pt??null,excluded_pt:p.excluded_pt??null,instructions_pt:p.instructions_pt??null,status:'published',sales_mode:'inquiry',featured:false,sort_order:0,created_at:new Date().toISOString()}
    await db.collection('store_products').updateOne({sku:p.sku},{$setOnInsert:record},{upsert:true})
    const product=await db.collection('store_products').findOne({sku:p.sku})
    await db.collection('product_variants').updateOne({sku:p.variant_sku},{$setOnInsert:{id:randomUUID(),sku:p.variant_sku,product_id:product.id,name_pt:p.name_pt,price_cents:null,currency:'BRL',stock_total:0,stock_reserved:0,available:false,min_quantity:1,max_quantity:20,attributes:{}}},{upsert:true})
  }
  console.log(JSON.stringify({database:db.databaseName,products:await db.collection('store_products').countDocuments(),topics:await db.collection('support_topics').countDocuments(),ready:true}))
}finally{await client.close()}
