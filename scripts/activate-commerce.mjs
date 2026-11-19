import {randomUUID} from 'node:crypto'
import {database} from '../server/database.mjs'
const confirmed=process.argv.includes('--webhook-confirmed')
if(!confirmed)throw Error('Confirme primeiro o webhook na Pagar.me; execute com --webhook-confirmed somente após verificar a URL e os eventos.')
if(!process.env.PAGARME_SECRET_KEY||!/^acc_[A-Za-z0-9]+$/.test(process.env.PAGARME_ACCOUNT_ID??''))throw Error('Cadastre PAGARME_SECRET_KEY e PAGARME_ACCOUNT_ID no servidor.')
if(process.env.PAGARME_SECRET_KEY.includes('_test_'))throw Error('Não ative vendas com credencial de teste.')
const runtime=await fetch(`${process.env.SITE_URL}/api/backend?commerce-status=1`,{signal:AbortSignal.timeout(12000)})
const capabilities=runtime.ok?await runtime.json():null
if(capabilities?.data?.checkout_version!==2||!capabilities.data.provider_configured||capabilities.data.database_provider!=='supabase')throw Error('Publique primeiro o checkout com as credenciais no runtime de produção.')
const response=await fetch('https://api.pagar.me/core/v5/paymentlinks?page=1&size=1',{headers:{Authorization:`Basic ${Buffer.from(`${process.env.PAGARME_SECRET_KEY}:`).toString('base64')}`},signal:AbortSignal.timeout(12000)})
if(!response.ok)throw Error(`Pagar.me recusou a validação de acesso: HTTP ${response.status}.`)
const {db,client}=await database()
try {
  if(db.kind!=='supabase'||db.databaseName!=='ticketrio'||process.env.SITE_URL!=='https://ticketrioingressos.com.br')throw Error('Ambiente de produção divergente.')
  const session=client.startSession()
  try {await session.withTransaction(async()=>{
    const terms=await db.collection('store_pages').findOne({slug:'termos-de-compra',status:'published',approval_status:'approved',version:4},{session})
    if(!terms||!await db.collection('audit_log').findOne({action:'inventory-carnaval-2027-20261117'},{session}))throw Error('Termos ou estoque ainda não preparados.')
    const products=await db.collection('store_products').find({status:'published',sales_mode:'online', 'attributes.inventory_batch':'inventory-carnaval-2027-20261117'},{session}).toArray()
    const variants=await db.collection('product_variants').find({product_id:{$in:products.map(p=>p.id)},available:true,stock_total:{$gt:0},price_cents:{$gt:0}},{session}).toArray()
    if(!variants.length)throw Error('Nenhum produto com preço e estoque confirmado.')
    await db.collection('store_settings').updateOne({key:'commerce_enabled'},{$set:{value:true,status:'published',updated_at:new Date().toISOString()}},{session})
    await db.collection('audit_log').insertOne({id:randomUUID(),action:'commerce_enabled',webhook_confirmed:true,priced_in_stock_variants:variants.length,created_at:new Date().toISOString()},{session})
    console.log(`Ativação validada: ${variants.length} opções publicadas com preço e estoque.`)
  })}finally{await session.endSession()}
}finally{await client.close()}
