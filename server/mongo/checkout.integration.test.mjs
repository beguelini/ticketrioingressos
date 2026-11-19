import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest'
import {createServer} from 'node:http'
import {randomUUID} from 'node:crypto'
import {database,initialize} from '../database.mjs'
import {handler} from './handler.mjs'
const enabled=process.env.TICKETRIO_INTEGRATION==='1'
if(enabled)process.loadEnvFile('.env.local')
if(enabled&&process.env.DATA_BACKEND==='supabase')vi.setConfig({testTimeout:120000,hookTimeout:180000})
describe.skipIf(!enabled)('Guest checkout and finite inventory',()=>{
  let db,client,server,base,orderId,providerCalls
  const testDb=`ticketrio_test_${randomUUID().replaceAll('-','').slice(0,16)}`
  const nativeFetch=globalThis.fetch
  const saved={key:process.env.PAGARME_SECRET_KEY,account:process.env.PAGARME_ACCOUNT_ID}
  const call=async(body,cookie)=>{
    const r=await nativeFetch(base,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173','x-forwarded-for':randomUUID(),...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)})
    return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],body:await r.json()}
  }
  const checkout=(key=randomUUID(),quantity=1)=>({kind:'function',name:'pagarme-checkout',body:{request_key:key,terms_version:4,contact:{name:'Cliente Teste',phone:'(21) 99999-1234'},lines:[{variant_id:'v',quantity,unit_price_cents:1}]}})
  beforeAll(async()=>{
    process.env.MONGODB_DB=testDb;if(process.env.DATA_BACKEND==='supabase')process.env.SUPABASE_DB_SCHEMA=testDb;process.env.SITE_URL='http://localhost:5173'
    process.env.PAGARME_SECRET_KEY='test-fixture-only';process.env.PAGARME_ACCOUNT_ID='acc_fixture'
    ;({db,client}=await database());await initialize(db)
    server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/api/backend`
    vi.stubGlobal('fetch',async(url,options)=>{
      if(String(url).endsWith('/paymentlinks')) {
        providerCalls++;const payload=JSON.parse(options.body);orderId=payload.order_code
        expect(payload.cart_settings.items[0].amount).toBe(10000)
        expect(payload.max_sessions).toBe(1);expect(payload.expires_at).toBeTruthy();expect(payload.payment_settings.credit_card_settings.installments).toHaveLength(10);expect(payload.payment_settings.credit_card_settings.installments.every(i=>i.total===10000)).toBe(true)
        return new Response(JSON.stringify({id:`pl_${orderId.replaceAll('-','')}`,url:`https://payment-link.pagar.me/pl_${orderId.replaceAll('-','')}`}))
      }
      if(String(url).includes('/core/v5/orders/'))return new Response(JSON.stringify({id:'or_fixture',code:orderId,currency:'BRL',status:'paid',customer:{name:'Cliente Verificado',email:'pagador@example.test',document_type:'CPF',document:'00000000000'},items:[{amount:10000,quantity:1}],charges:[{id:'ch_fixture',status:'paid',payment_method:'pix',amount:10000}]}))
      throw Error('Unexpected external request')
    })
  },180000)
  beforeEach(async()=>{
    for(const name of ['users','sessions','orders','order_items','stock_reservations','product_variants','store_products','store_pages','store_settings','webhook_events','payments','deliveries'])await db.collection(name).deleteMany({})
    await db.collection('store_settings').insertOne({key:'commerce_enabled',value:true})
    await db.collection('store_pages').insertOne({slug:'termos-de-compra',version:4,status:'published',approval_status:'approved'})
    await db.collection('store_products').insertOne({id:'p',name_pt:'Ingresso de teste',status:'published',sales_mode:'online',kind:'ticket'})
    await db.collection('product_variants').insertOne({id:'v',product_id:'p',name_pt:'Padrão',price_cents:10000,currency:'BRL',available:true,stock_total:2,stock_reserved:0,min_quantity:1,max_quantity:10})
    providerCalls=0
  })
  afterAll(async()=>{
    vi.unstubAllGlobals()
    if(saved.key===undefined)delete process.env.PAGARME_SECRET_KEY;else process.env.PAGARME_SECRET_KEY=saved.key
    if(saved.account===undefined)delete process.env.PAGARME_ACCOUNT_ID;else process.env.PAGARME_ACCOUNT_ID=saved.account
    try {if(server)await new Promise(resolve=>server.close(resolve));if(db?.databaseName===testDb)for(const {name} of await db.listCollections({},{nameOnly:true}).toArray())await db.collection(name).drop()}
    finally{await client?.close()}
  })
  it('creates a guest with isolated HttpOnly session, WhatsApp and server-calculated price',async()=>{
    const capabilities=await (await nativeFetch(`${base}?commerce-status=1`)).json();expect(capabilities.data).toEqual({checkout_version:2,database_provider:db.kind??'mongodb',provider_configured:true})
    const r=await call(checkout());expect(r.status).toBe(200);expect(r.cookie).toBeTruthy()
    const order=await db.collection('orders').findOne({id:r.body.data.order_id})
    expect(order.total_cents).toBe(10000);expect(order.customer_snapshot.phone).toBe('21999991234')
    const user=await db.collection('users').findOne({id:order.customer_id});expect(user.is_guest).toBe(true);expect(user.password_hash).toBeUndefined()
    expect(await db.collection('staff_roles').findOne({user_id:user.id})).toBe(null)
    expect((await call({kind:'query',table:'orders'},r.cookie)).body.data).toHaveLength(1)
    expect((await call({kind:'query',table:'orders'})).status).toBe(403)
    const repeat=await call(checkout(order.request_key),r.cookie);expect(repeat.body.data.order_id).toBe(order.id);expect(providerCalls).toBe(1)
  })
  it('prevents overselling the last available ticket during simultaneous checkouts',async()=>{
    await db.collection('product_variants').updateOne({id:'v'},{$set:{stock_total:1}})
    const results=await Promise.all([call(checkout()),call(checkout())])
    expect(results.map(r=>r.status).sort()).toEqual([200,409])
    expect((await db.collection('product_variants').findOne({id:'v'})).stock_reserved).toBe(1)
    expect(await db.collection('orders').countDocuments()).toBe(1)
  })
  it('rejects missing WhatsApp, unapproved terms, and unknown prices before creating orders',async()=>{
    const bad=checkout();bad.body.contact.phone='invalid';expect((await call(bad)).status).toBe(400)
    await db.collection('store_pages').updateOne({slug:'termos-de-compra'},{$set:{approval_status:'pending'}})
    expect((await call(checkout())).status).toBe(409)
    await db.collection('store_pages').updateOne({slug:'termos-de-compra'},{$set:{approval_status:'approved'}})
    await db.collection('product_variants').updateOne({id:'v'},{$set:{price_cents:null}})
    expect((await call(checkout())).status).toBe(409);expect(providerCalls).toBe(0);expect(await db.collection('users').countDocuments()).toBe(0)
  })
  it('consumes stock only once after a verified payment; duplicate events do not consume again',async()=>{
    await call(checkout())
    const event={kind:'webhook',id:'hook_fixture',account:{id:'acc_fixture'},type:'order.paid',data:{id:'or_fixture'}}
    expect((await call({kind:'webhook',body:event})).status).toBe(200);expect((await call({kind:'webhook',body:event})).status).toBe(200)
    const v=await db.collection('product_variants').findOne({id:'v'});expect(v.stock_total).toBe(1);expect(v.stock_reserved).toBe(0)
    expect((await db.collection('orders').findOne({id:orderId})).payment_status).toBe('approved')
    expect(await db.collection('deliveries').countDocuments()).toBe(1)
    expect((await db.collection('orders').findOne({id:orderId})).customer_snapshot).toMatchObject({full_name:'Cliente Verificado',email:'pagador@example.test',document_number:'00000000000'})
    expect(await db.collection('payments').findOne({order_id:orderId})).toMatchObject({provider:'pagarme',method:'pix',reference:'ch_fixture'})
  })
  it('releases expired reservations on catalog refresh and holds late payments for manual review',async()=>{
    await call(checkout())
    await db.collection('orders').updateOne({id:orderId},{$set:{expires_at:'2000-01-01T00:00:00.000Z'}})
    await call({kind:'query',table:'store_products'})
    expect((await db.collection('product_variants').findOne({id:'v'})).stock_reserved).toBe(0)
    expect((await call({kind:'webhook',body:{id:'hook_late',account:{id:'acc_fixture'},data:{id:'or_fixture'}}})).status).toBe(200)
    expect((await db.collection('orders').findOne({id:orderId})).status).toBe('payment_review')
    expect(await db.collection('deliveries').countDocuments()).toBe(0)
  })
})
