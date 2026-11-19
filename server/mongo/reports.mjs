import {fail,text} from './security.mjs'
export async function mediaReport(db,who,input) {
  if(!['administrator','marketing'].includes(who.role))fail('Acesso negado.',403)
  const from=text(input.from_date,10,10),to=text(input.to_date,10,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)fail('invalid_period')
  if(db.kind==='supabase')return postgresMedia(db,from,to)
  const spend=await db.collection('media_spend_daily').aggregate([{$match:{spend_date:{$gte:from,$lte:to}}},{$group:{_id:{source:'$utm_source',campaign:'$utm_campaign'},spend:{$sum:'$amount_cents'}}}]).toArray()
  const leads=await db.collection('inquiries').aggregate([{$match:{created_at:{$gte:new Date(`${from}T00:00:00.000-03:00`).toISOString(),$lt:new Date(`${to}T23:59:59.999-03:00`).toISOString()},utm_source:{$type:'string'},utm_campaign:{$type:'string'}}},{$group:{_id:{source:'$utm_source',campaign:'$utm_campaign'},leads:{$sum:1}}}]).toArray()
  const orders=await db.collection('orders').aggregate([{$match:{is_training:{$ne:true},payment_status:'approved',created_at:{$gte:new Date(`${from}T00:00:00.000-03:00`).toISOString(),$lt:new Date(`${to}T23:59:59.999-03:00`).toISOString()}}},{$lookup:{from:'order_attribution',localField:'id',foreignField:'order_id',as:'a'}},{$unwind:'$a'},{$group:{_id:{source:'$a.utm_source',campaign:'$a.utm_campaign'},approved_orders:{$sum:1},revenue_cents:{$sum:'$total_cents'}}}]).toArray()
  const result=new Map()
  for(const row of [...spend,...leads,...orders]){const key=JSON.stringify(row._id);const current=result.get(key)??{utm_source:row._id.source,utm_campaign:row._id.campaign,spend_cents:0,leads:0,approved_orders:0,revenue_cents:0};if(row.spend!==undefined)current.spend_cents+=row.spend;if(row.leads)current.leads+=row.leads;if(row.approved_orders){current.approved_orders+=row.approved_orders;current.revenue_cents+=row.revenue_cents}result.set(key,current)}
  return [...result.values()]
}

async function postgresMedia(db,from,to){
 const schema='"'+db.databaseName+'"',start=new Date(`${from}T00:00:00.000-03:00`).toISOString(),end=new Date(`${to}T23:59:59.999-03:00`).toISOString()
 const rows=await db.sql.unsafe(`with metrics as (
 select document->>'utm_source' as source,document->>'utm_campaign' as campaign,sum((document->>'amount_cents')::bigint) as spend,0::bigint as leads,0::bigint as orders,0::bigint as revenue from ${schema}.media_spend_daily where document->>'spend_date'>=$1 and document->>'spend_date'<=$2 group by 1,2
 union all select document->>'utm_source',document->>'utm_campaign',0,count(*),0,0 from ${schema}.inquiries where document->>'created_at'>=$3 and document->>'created_at'<$4 and jsonb_typeof(document->'utm_source')='string' and jsonb_typeof(document->'utm_campaign')='string' group by 1,2
 union all select a.document->>'utm_source',a.document->>'utm_campaign',0,0,count(*),sum((o.document->>'total_cents')::bigint) from ${schema}.orders o join ${schema}.order_attribution a on a.document->>'order_id'=o.document->>'id' where o.document->>'payment_status'='approved' and o.document->>'is_training' is distinct from 'true' and o.document->>'created_at'>=$3 and o.document->>'created_at'<$4 group by 1,2)
 select source as utm_source,campaign as utm_campaign,sum(spend) as spend_cents,sum(leads) as leads,sum(orders) as approved_orders,sum(revenue) as revenue_cents from metrics group by 1,2`,[from,to,start,end])
 return rows.map(row=>({...row,...Object.fromEntries(['spend_cents','leads','approved_orders','revenue_cents'].map(k=>[k,Number(row[k])]))}))
}
