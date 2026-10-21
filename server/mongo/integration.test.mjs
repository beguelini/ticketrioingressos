import {beforeAll,afterAll,describe,it,expect} from 'vitest'
import {createServer} from 'node:http'
import {randomUUID} from 'node:crypto'
import {database,initialize} from './db.mjs'
import {handler} from './handler.mjs'
import {passwordHash,digest} from './security.mjs'
import {issueToken} from './auth.mjs'
import {quote,expire} from './commerce.mjs'
const enabled=process.env.TICKETRIO_INTEGRATION==='1'
if(enabled)process.loadEnvFile('.env.local')
describe.skipIf(!enabled)('MongoDB isolated end-to-end API',()=>{
 let db,client,server,base,admin,customer,other,adminCookie,customerCookie
 const testDb=`ticketrio_test_${randomUUID().replaceAll('-','').slice(0,16)}`
 const headers={'Content-Type':'application/json',Origin:'http://localhost:5173'}
 const call=async(body,cookie,origin=headers.Origin)=>{
  const response=await fetch(base,{method:'POST',headers:{...headers,Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)})
  return {status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0],body:await response.json()}
 }
 beforeAll(async()=>{
  process.env.MONGODB_DB=testDb;process.env.SITE_URL='http://localhost:5173';process.env.VERCEL_BRANCH_URL='qa-branch.vercel.app'
  ;({db,client}=await database());await initialize(db)
  const hashed=await passwordHash('Teste-MongoDB-12345!')
  admin={id:randomUUID(),email:'admin@example.test',password_hash:hashed,email_confirmed_at:new Date().toISOString()}
  customer={...admin,id:randomUUID(),email:'customer@example.test'};other={...admin,id:randomUUID(),email:'other@example.test'}
  await db.collection('users').insertMany([admin,customer,other])
  await db.collection('staff_roles').insertOne({id:randomUUID(),user_id:admin.id,email:admin.email,role:'administrator'})
  await db.collection('store_products').insertMany([{id:'published',sku:'PUBLIC',slug:'public',name_pt:'Publicado',status:'published',sales_mode:'online'},{id:'draft',sku:'DRAFT',slug:'draft',status:'draft'}])
  await db.collection('product_variants').insertOne({id:'variant',product_id:'published',sku:'VARIANT',name_pt:'Padrão',price_cents:10000,currency:'BRL',stock_total:2,stock_reserved:0,available:true,min_quantity:1,max_quantity:20})
  await db.collection('orders').insertMany([{id:'own-order',customer_id:customer.id},{id:'other-order',customer_id:other.id}])
  await db.collection('support_agents').insertOne({id:'a',agent_key:'tickets',queue_role:'commercial'})
  await db.collection('support_topics').insertOne({id:'tickets',agent_key:'tickets',active:true})
  server=createServer(handler);await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/api/backend`
  adminCookie=(await call({kind:'auth',action:'login',email:admin.email,password:'Teste-MongoDB-12345!'})).cookie
  customerCookie=(await call({kind:'auth',action:'login',email:customer.email,password:'Teste-MongoDB-12345!'})).cookie
 },60000)
 afterAll(async()=>{if(server)await new Promise((resolve)=>server.close(resolve));if(db&&db.databaseName===testDb&&/^ticketrio_test_[a-f0-9]+$/.test(testDb))await db.dropDatabase();await client?.close()})
 it('uses HttpOnly sessions and returns only public identity',async()=>{
  const result=await call({kind:'auth',action:'login',email:customer.email,password:'Teste-MongoDB-12345!'})
  expect(result.cookie).toBeTruthy();expect(result.body.data.user).toEqual({id:customer.id,email:customer.email,email_confirmed_at:customer.email_confirmed_at});expect(JSON.stringify(result.body)).not.toContain('password_hash')
 })
 it('does not authenticate with an incorrect password',async()=>expect((await call({kind:'auth',action:'login',email:customer.email,password:'errada'})).status).toBe(401))
 it('does not accept cross-origin writes',async()=>expect((await call({kind:'query',table:'inquiries',operation:'insert'},adminCookie,'https://evil.example')).status).toBe(403))
 it('allows the exact Vercel branch alias',async()=>expect((await call({kind:'query',table:'store_products'},null,'https://qa-branch.vercel.app')).status).toBe(200))
 it('only publishes approved catalog visibility',async()=>{const r=await call({kind:'query',table:'store_products'});expect(r.body.data.map((p)=>p.id)).toEqual(['published'])})
 it('allows admin access to drafts',async()=>expect((await call({kind:'query',table:'store_products'},adminCookie)).body.data).toHaveLength(2))
 it('isolates customer orders even when the client requests another owner',async()=>{const r=await call({kind:'query',table:'orders',filters:[{field:'customer_id',op:'eq',value:other.id}]},customerCookie);expect(r.body.data).toEqual([])})
 it('does not allow customer self-assignment of staff roles',async()=>expect((await call({kind:'query',table:'staff_roles',operation:'insert',values:{user_id:customer.id,role:'administrator'}},customerCookie)).status).toBe(403))
 it('does not allow clients to approve payments or orders',async()=>expect((await call({kind:'query',table:'orders',operation:'update',values:{payment_status:'approved'},filters:[{field:'id',op:'eq',value:'own-order'}]},customerCookie)).status).toBe(403))
 it('rejects query operator injection over HTTP',async()=>expect((await call({kind:'query',table:'store_products',filters:[{field:'status',op:'eq',value:{$ne:'draft'}}]})).status).toBe(400))
 it('forces profile ownership instead of trusting posted user IDs',async()=>{
  expect((await call({kind:'query',table:'customer_profiles',operation:'upsert',values:{user_id:other.id,first_name:'Cliente'}},customerCookie)).status).toBe(200)
  expect(await db.collection('customer_profiles').findOne({user_id:other.id})).toBe(null)
  expect((await db.collection('customer_profiles').findOne({user_id:customer.id})).first_name).toBe('Cliente')
 })
 it('enforces required fields and protects stock reservations',async()=>{
  expect((await call({kind:'query',table:'store_products',operation:'insert',values:{name_pt:'Incompleto'}},adminCookie)).status).toBe(400)
  expect((await call({kind:'query',table:'product_variants',operation:'update',values:{stock_reserved:999},filters:[{field:'id',op:'eq',value:'variant'}]},adminCookie)).status).toBe(400)
 })
 it('calculates prices and refuses quantities beyond inventory',async()=>{expect((await quote(db,[{variant_id:'variant',quantity:2,unit_price_cents:1}])).total_cents).toBe(20000);await expect(quote(db,[{variant_id:'variant',quantity:3}])).rejects.toThrow('unavailable_variant')})
 it('rejects repeated cart variants',async()=>expect(quote(db,[{variant_id:'variant',quantity:1},{variant_id:'variant',quantity:1}])).rejects.toThrow('duplicate_variant'))
 it('keeps checkout disabled without provider credentials',async()=>expect((await call({kind:'function',name:'pagarme-checkout',body:{request_key:randomUUID()}},customerCookie)).status).toBe(503))
 it('requires role authorization for staff functions',async()=>expect((await call({kind:'function',name:'manage-staff',body:{action:'invite',email:other.email,role:'administrator'}},customerCookie)).status).toBe(403))
 it('creates human support threads without exposing their bearer-token hash',async()=>{
  const start=await call({kind:'function',name:'support-visitor',body:{action:'start',topic_id:'tickets',name:'Visitante',email:'visitor@example.test',message:'Tenho uma dúvida sobre ingressos.'}})
  expect(start.status).toBe(200);expect(start.body.data.token).toHaveLength(43)
  const thread=await call({kind:'function',name:'support-visitor',body:{action:'thread',...start.body.data}})
  expect(thread.body.data.messages).toHaveLength(1);expect(JSON.stringify(thread.body)).not.toContain('visitor_token_hash')
  expect((await call({kind:'function',name:'support-visitor',body:{action:'thread',id:start.body.data.id,token:'x'.repeat(43)}})).status).toBe(401)
 })
 it('limits staff queues by role',async()=>{
  await db.collection('staff_roles').insertOne({id:randomUUID(),user_id:customer.id,role:'operations'})
  const r=await call({kind:'function',name:'support-staff',body:{action:'list'}},customerCookie)
  expect(r.body.data.conversations).toEqual([])
  await db.collection('staff_roles').deleteOne({user_id:customer.id})
 })
 it('expires reservations transactionally and only once',async()=>{
  await db.collection('orders').insertOne({id:'expired',customer_id:customer.id,request_key:randomUUID(),status:'pending_payment',expires_at:'2000-01-01T00:00:00.000Z'})
  await db.collection('product_variants').updateOne({id:'variant'},{$set:{stock_reserved:1}})
  await db.collection('stock_reservations').insertOne({id:randomUUID(),order_id:'expired',variant_id:'variant',quantity:1,status:'reserved'})
  await expire(db,client);await expire(db,client)
  expect((await db.collection('product_variants').findOne({id:'variant'})).stock_reserved).toBe(0)
 })
 it('consumes password setup links once and revokes old sessions',async()=>{
  const link=await issueToken(db,customer,'invite','http://localhost:5173',true),token=new URLSearchParams(new URL(link).hash.slice(1)).get('token')
  const update=await call({kind:'auth',action:'password',password:'Senha-alterada-12345!',token})
  expect(update.status).toBe(200);expect(await db.collection('auth_tokens').findOne({_id:digest(token)})).toBe(null)
  expect((await call({kind:'auth',action:'user'},customerCookie)).body.data.user).toBe(null)
  expect((await call({kind:'auth',action:'password',password:'Outra-senha-12345!',token})).status).toBe(401)
  customerCookie=update.cookie
 })
 it('stores images and serves only safe public binary content',async()=>{
  const bytes=Buffer.from([255,216,255,0,1,2,3])
  const response=await call({kind:'upload',bucket:'ticket-rio-media',path:'qa/image.jpg',base64:bytes.toString('base64')},adminCookie)
  expect(response.status).toBe(200)
  const file=await fetch(`${base}?bucket=ticket-rio-media&file=qa%2Fimage.jpg`)
  expect(file.headers.get('content-type')).toBe('image/jpeg');expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes)
  expect((await call({kind:'upload',bucket:'ticket-rio-media',path:'qa/active.svg',base64:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')},adminCookie)).status).toBe(400)
 })
 it('denies public access to private documents',async()=>{
  await db.collection('files').insertOne({id:randomUUID(),bucket:'ticket-rio-documents',path:'private.pdf',owner_id:other.id,mime:'application/pdf',bytes:Buffer.from('private')})
  expect((await fetch(`${base}?bucket=ticket-rio-documents&file=private.pdf`)).status).toBe(404)
  expect((await fetch(`${base}?bucket=ticket-rio-documents&file=private.pdf`,{headers:{Cookie:customerCookie}})).status).toBe(404)
 })
 it('does not expose database internals through the query API',async()=>expect((await call({kind:'query',table:'users'},adminCookie)).status).toBe(404))
 it('revokes a session on logout',async()=>{await call({kind:'auth',action:'logout'},customerCookie);expect((await call({kind:'auth',action:'user'},customerCookie)).body.data.user).toBe(null)})
})
