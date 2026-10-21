import {randomUUID} from 'node:crypto'
import {fail} from './security.mjs'
export async function quote(db,lines,session) {
  if(!Array.isArray(lines)||!lines.length||lines.length>20)fail('invalid_cart')
  if(new Set(lines.map((l)=>l.variant_id)).size!==lines.length)fail('duplicate_variant')
  const items=[]
  for(const line of lines) {
    if(typeof line.variant_id!=='string'||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>20)fail('invalid_cart')
    const v=await db.collection('product_variants').findOne({id:line.variant_id},{session})
    const p=v?await db.collection('store_products').findOne({id:v.product_id,status:'published',sales_mode:'online'},{session}):null
    if(!p||!v.available||v.currency!=='BRL'||!Number.isSafeInteger(v.price_cents)||v.price_cents<=0||line.quantity<v.min_quantity||line.quantity>v.max_quantity||(v.stock_total-v.stock_reserved)<line.quantity)fail('unavailable_variant',409)
    if(p.kind==='transfer') {
      if(typeof line.service_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(line.service_date)||typeof line.pickup_point!=='string'||line.pickup_point.length<2||line.pickup_point.length>200)fail('transfer_selection_required')
      const date=await db.collection('event_dates').findOne({event_date:line.service_date,status:'published'},{session})
      if(!date)fail('invalid_service_date')
    }
    items.push({variant_id:v.id,product_id:p.id,product_name:p.name_pt,variant_name:v.name_pt,name:`${p.name_pt} · ${v.name_pt}`,quantity:line.quantity,unit_price_cents:v.price_cents,total_cents:line.quantity*v.price_cents,line_total_cents:line.quantity*v.price_cents,attributes:{...v.attributes,...(p.kind==='transfer'?{service_date:line.service_date,pickup_point:line.pickup_point}:{})}})
  }
  const total=items.reduce((s,i)=>s+i.total_cents,0)
  if(!Number.isSafeInteger(total)||total<=0)fail('invalid_total')
  return {items,total_cents:total,currency:'BRL'}
}
export async function expire(db,client) {
  const session=client.startSession()
  try {await session.withTransaction(async()=>{
    const expired=await db.collection('orders').find({status:'pending_payment',expires_at:{$lte:new Date().toISOString()}},{session}).limit(100).toArray()
    for(const order of expired) {
      const reservations=await db.collection('stock_reservations').find({order_id:order.id,status:'reserved'},{session}).toArray()
      for(const r of reservations)await db.collection('product_variants').updateOne({id:r.variant_id},{$inc:{stock_reserved:-r.quantity}},{session})
      await db.collection('stock_reservations').updateMany({order_id:order.id,status:'reserved'},{$set:{status:'released'}},{session})
      await db.collection('orders').updateOne({id:order.id,status:'pending_payment'},{$set:{status:'expired'}},{session})
    }
  })}finally{await session.endSession()}
}
export async function checkout(db,client,who,input,baseUrl) {
  if(!who.user)fail('sign_in_required',401)
  if(!process.env.PAGARME_SECRET_KEY)fail('checkout_unavailable',503)
  if(typeof input.request_key!=='string'||!/^[0-9a-f-]{36}$/i.test(input.request_key))fail('invalid_request_key')
  const enabled=await db.collection('store_settings').findOne({key:'commerce_enabled'})
  if(enabled?.value!==true)fail('commerce_disabled',409)
  await expire(db,client)
  let order
  const session=client.startSession()
  try{await session.withTransaction(async()=>{
    order=await db.collection('orders').findOne({customer_id:who.user.id,request_key:input.request_key},{session})
    if(order)return
    const terms=await db.collection('store_pages').findOne({slug:'termos-de-compra',status:'published',approval_status:'approved',version:input.terms_version},{session})
    if(!terms)fail('terms_not_accepted',409)
    const priced=await quote(db,input.lines,session)
    const id=randomUUID(),now=new Date().toISOString(),expires=new Date(Date.now()+1800000).toISOString()
    for(const item of priced.items) {
      const saved=await db.collection('product_variants').updateOne({id:item.variant_id,available:true,price_cents:item.unit_price_cents,$expr:{$gte:[{$subtract:['$stock_total','$stock_reserved']},item.quantity]}},{$inc:{stock_reserved:item.quantity}},{session})
      if(saved.modifiedCount!==1)fail('unavailable_variant',409)
      await db.collection('order_items').insertOne({id:randomUUID(),order_id:id,...item},{session})
      await db.collection('stock_reservations').insertOne({id:randomUUID(),order_id:id,variant_id:item.variant_id,quantity:item.quantity,status:'reserved',expires_at:expires},{session})
    }
    order={id,customer_id:who.user.id,request_key:input.request_key,order_number:Date.now(),status:'pending_payment',payment_status:'pending',delivery_status:'awaiting_supplier',total_cents:priced.total_cents,currency:'BRL',terms_version:terms.version,created_at:now,expires_at:expires}
    await db.collection('orders').insertOne(order,{session})
  })}finally{await session.endSession()}
  if(order.status!=='pending_payment'||order.expires_at<=new Date().toISOString())fail('order_unavailable',409)
  if(order.pagarme_checkout_url)return {order_id:order.id,checkout_url:order.pagarme_checkout_url}
  const items=await db.collection('order_items').find({order_id:order.id}).toArray()
  const response=await fetch('https://api.pagar.me/core/v5/paymentlinks',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${process.env.PAGARME_SECRET_KEY}:`).toString('base64')}`,'Content-Type':'application/json','Idempotency-Key':`ticket-rio-${order.id}`},body:JSON.stringify({type:'order',name:`Ticket Rio #${order.order_number}`,order_code:order.id,expires_in:30,max_paid_sessions:1,cart_settings:{items:items.map((i)=>({name:`${i.product_name} · ${i.variant_name}`.slice(0,180),amount:i.unit_price_cents,default_quantity:i.quantity}))},payment_settings:{accepted_payment_methods:['credit_card','pix'],credit_card_settings:{operation_type:'auth_and_capture',installments:[{number:1,total:order.total_cents}]},pix_settings:{expires_in:1800}},flow_settings:{success_url:`${baseUrl}/pedidos/${order.id}`}}),signal:AbortSignal.timeout(15000)})
  if(!response.ok)fail('provider_unavailable',503)
  const link=await response.json()
  if(typeof link.id!=='string'||!/^https:\/\/payment-link(?:-v3)?\.pagar\.me\/pl_[A-Za-z0-9]+$/.test(link.url??''))fail('invalid_checkout_url',503)
  await db.collection('orders').updateOne({id:order.id},{$set:{pagarme_link_id:link.id,pagarme_checkout_url:link.url}})
  return {order_id:order.id,checkout_url:link.url}
}
export async function webhook(db,client,event) {
  if(!process.env.PAGARME_SECRET_KEY||!process.env.PAGARME_ACCOUNT_ID)fail('unavailable',503)
  if(event.account?.id!==process.env.PAGARME_ACCOUNT_ID||!/^hook_[A-Za-z0-9]+$/.test(event.id??''))fail('invalid_event')
  const providerId=event.data?.order?.id??event.data?.charge?.order?.id??event.data?.id
  if(!/^or_[A-Za-z0-9]+$/.test(providerId??''))return {ignored:true}
  const response=await fetch(`https://api.pagar.me/core/v5/orders/${providerId}`,{headers:{Authorization:`Basic ${Buffer.from(`${process.env.PAGARME_SECRET_KEY}:`).toString('base64')}`},signal:AbortSignal.timeout(12000)})
  if(!response.ok)fail('provider_unavailable',503)
  const verified=await response.json(),charge=verified.charges?.find((c)=>c.status==='paid')??verified.charges?.find((c)=>c.status==='refunded')??verified.charges?.[0]
  const amount=verified.items?.reduce((sum,i)=>sum+i.amount*i.quantity,0)
  if(verified.id!==providerId||verified.currency!=='BRL'||!Number.isSafeInteger(amount)||amount<=0||charge?.amount!==amount)fail('invalid_provider_order')
  const status=charge?.status==='refunded'?'refunded':verified.status==='paid'&&charge?.status==='paid'?'approved':['failed','canceled'].includes(verified.status)?'failed':'pending'
  const session=client.startSession()
  try{await session.withTransaction(async()=>{
    if(await db.collection('webhook_events').findOne({external_event_id:event.id},{session}))return
    const order=await db.collection('orders').findOne({id:verified.code},{session})
    if(!order||!order.pagarme_link_id||order.total_cents!==amount||order.pagarme_order_id&&order.pagarme_order_id!==providerId)fail('order_mismatch',409)
    await db.collection('webhook_events').insertOne({id:randomUUID(),external_event_id:event.id,event_type:event.type,order_id:order.id,created_at:new Date().toISOString()},{session})
    // Never downgrade an approved or refunded order on an out-of-order pending event.
    if(status==='pending'||order.payment_status==='refunded'||order.payment_status==='approved'&&status!=='refunded')return
    const reservations=await db.collection('stock_reservations').find({order_id:order.id,status:'reserved'},{session}).toArray()
    const late=status==='approved'&&reservations.length===0
    for(const r of reservations)await db.collection('product_variants').updateOne({id:r.variant_id},{$inc:{stock_reserved:-r.quantity,...(status==='approved'?{stock_total:-r.quantity}:{})}},{session})
    await db.collection('stock_reservations').updateMany({order_id:order.id,status:'reserved'},{$set:{status:status==='approved'?'consumed':'released'}},{session})
    await db.collection('orders').updateOne({id:order.id},{$set:{payment_status:status,status:late?'payment_review':status==='approved'?'confirmed':status==='refunded'?'refunded':'cancelled',pagarme_order_id:providerId}},{session})
    await db.collection('payments').updateOne({order_id:order.id},{$set:{provider_order_id:providerId,amount_cents:amount,status},$setOnInsert:{id:randomUUID(),created_at:new Date().toISOString()}},{upsert:true,session})
    if(status==='approved'&&!late) {
      const items=await db.collection('order_items').find({order_id:order.id},{session}).toArray()
      for(const item of items)await db.collection('deliveries').insertOne({id:randomUUID(),order_item_id:item.id,status:'awaiting_supplier',created_at:new Date().toISOString()},{session})
    }
  })}finally{await session.endSession()}
  return {ok:true}
}
