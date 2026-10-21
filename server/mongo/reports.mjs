import {fail,text} from './security.mjs'
export async function mediaReport(db,who,input) {
  if(!['administrator','marketing'].includes(who.role))fail('Acesso negado.',403)
  const from=text(input.from_date,10,10),to=text(input.to_date,10,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)fail('invalid_period')
  const spend=await db.collection('media_spend_daily').aggregate([{$match:{spend_date:{$gte:from,$lte:to}}},{$group:{_id:{source:'$utm_source',campaign:'$utm_campaign'},spend:{$sum:'$amount_cents'}}}]).toArray()
  const leads=await db.collection('inquiries').aggregate([{$match:{created_at:{$gte:new Date(`${from}T00:00:00.000-03:00`).toISOString(),$lt:new Date(`${to}T23:59:59.999-03:00`).toISOString()},utm_source:{$type:'string'},utm_campaign:{$type:'string'}}},{$group:{_id:{source:'$utm_source',campaign:'$utm_campaign'},leads:{$sum:1}}}]).toArray()
  const orders=await db.collection('orders').aggregate([{$match:{payment_status:'approved',created_at:{$gte:new Date(`${from}T00:00:00.000-03:00`).toISOString(),$lt:new Date(`${to}T23:59:59.999-03:00`).toISOString()}}},{$lookup:{from:'order_attribution',localField:'id',foreignField:'order_id',as:'a'}},{$unwind:'$a'},{$group:{_id:{source:'$a.utm_source',campaign:'$a.utm_campaign'},approved_orders:{$sum:1},revenue_cents:{$sum:'$total_cents'}}}]).toArray()
  const result=new Map()
  for(const row of [...spend,...leads,...orders]){const key=JSON.stringify(row._id);const current=result.get(key)??{utm_source:row._id.source,utm_campaign:row._id.campaign,spend_cents:0,leads:0,approved_orders:0,revenue_cents:0};if(row.spend!==undefined)current.spend_cents+=row.spend;if(row.leads)current.leads+=row.leads;if(row.approved_orders){current.approved_orders+=row.approved_orders;current.revenue_cents+=row.revenue_cents}result.set(key,current)}
  return [...result.values()]
}
