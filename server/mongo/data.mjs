import modules from './modules.json' with {type:'json'}
import { randomUUID } from 'node:crypto'
import { clean, fail, safeObject, text } from './security.mjs'
const publicTables = new Set(['store_products','product_variants','store_categories','events','event_dates','parade_schools','parade_lineup','store_pages','store_faqs','store_banners','home_blocks','store_settings','support_topics'])
const ownerFields = {customer_profiles:'user_id',cart_items:'user_id',shopping_carts:'user_id',orders:'customer_id'}
const privateWrite = {customer_profiles:['user_id','first_name','last_name','phone','country_code','document_type','document_number'],cart_items:['user_id','variant_id','quantity','service_date','pickup_point'],shopping_carts:['user_id']}
const extra = {inquiries:['customer_id','name','email','phone','message','product_id','stage','assigned_to','next_followup_at','estimated_value_cents','utm_source','utm_medium','utm_campaign','updated_at'],crm_activities:['inquiry_id','actor_id','note'],media_spend_daily:['spend_date','utm_source','utm_campaign','amount_cents','notes','created_by']}
const extraRoles = {crm_activities:['administrator','commercial'],media_spend_daily:['administrator','marketing']}
const keys = {staff_roles:'user_id',customer_profiles:'user_id',shopping_carts:'user_id',store_pages:'slug',store_settings:'key',home_blocks:'block_key'}
export const tableKey = (table) => keys[table] || 'id'
export async function scope(db,table,who,write=false) {
  const config=modules[table]
  const staff=(extraRoles[table] ?? config?.roles ?? []).includes(who.role)
  if(write) {
    if(staff && (extra[table] || (config && !config.readOnly))) return {}
    if(who.user && privateWrite[table]) return {[ownerFields[table]]:who.user.id}
    if(table==='inquiries' && who.user) return {customer_id:who.user.id}
    fail('Acesso negado.',403)
  }
  if(staff) return {}
  if(table==='staff_roles' && who.user) return who.role && ['commercial','operations','finance'].includes(who.role) ? {role:{$in:['administrator',who.role]}} : {user_id:who.user.id}
  if(table==='support_topics') return {active:true}
  if(publicTables.has(table)) {
    if(table==='store_settings') return {key:{$in:['institutional','commerce_enabled']}}
    if(table==='home_blocks') return {visible:true}
    if(table==='product_variants') return {product_id:{$in:(await db.collection('store_products').find({status:'published'},{projection:{id:1}}).limit(2000).toArray()).map((p)=>p.id)}}
    if(table==='parade_schools') {
      const dates=(await db.collection('event_dates').find({status:'published'},{projection:{id:1}}).toArray()).map((d)=>d.id)
      return {id:{$in:(await db.collection('parade_lineup').find({status:'published',event_date_id:{$in:dates}},{projection:{school_id:1}}).toArray()).map((s)=>s.school_id)}}
    }
    if(table==='parade_lineup') return {status:'published',event_date_id:{$in:(await db.collection('event_dates').find({status:'published'},{projection:{id:1}}).toArray()).map((d)=>d.id)}}
    return {status:'published'}
  }
  if(ownerFields[table] && who.user) return {[ownerFields[table]]:who.user.id}
  if(['order_items','deliveries'].includes(table) && who.user) {
    const ids=(await db.collection('orders').find({customer_id:who.user.id},{projection:{id:1}}).toArray()).map((o)=>o.id)
    if(table==='order_items') return {order_id:{$in:ids}}
    const items=await db.collection('order_items').find({order_id:{$in:ids}},{projection:{id:1}}).toArray()
    return {order_item_id:{$in:items.map((i)=>i.id)}}
  }
  fail('Acesso negado.',403)
}
export function filters(items=[]) {
  if(!Array.isArray(items)||items.length>20) fail('invalid_filters')
  return items.map(({field,op,value})=>{
    if(typeof field!=='string'|| !/^[a-z_][a-z0-9_]*$/.test(field) || field.startsWith('_')) fail('invalid_filter')
    if(!['eq','neq','in','gte','lte'].includes(op)) fail('invalid_filter')
    if(op==='in') {if(!Array.isArray(value)||value.length>200||value.some((v)=>!['string','number','boolean'].includes(typeof v))) fail('invalid_filter');return {[field]:{$in:value}}}
    if(value!==null&&!['string','number','boolean'].includes(typeof value)) fail('invalid_filter')
    return {[field]:op==='eq'?value:{[{neq:'$ne',gte:'$gte',lte:'$lte'}[op]]:value}}
  })
}
function validate(table,input,who,insert) {
  safeObject(input)
  const config=modules[table]
  const owner=privateWrite[table] && !(config?.roles ?? []).includes(who.role)
  const fields=owner?privateWrite[table]:extra[table] ?? config?.fields.map((f)=>f.key) ?? []
  const allowed=new Set([...fields,...(insert?[tableKey(table)]:[])])
  const row={}
  for(const [key,value] of Object.entries(input)) {
    if(!allowed.has(key)) fail(`Campo não permitido: ${key}`)
    if(typeof value==='string'&&value.length>50000) fail('field_too_long')
    const spec=config?.fields.find((f)=>f.key===key)
    if(value!==null && spec?.kind==='number' && (typeof value!=='number'|| !Number.isSafeInteger(value)||value<0)) fail('invalid_number')
    if(value!==null && spec?.kind==='boolean'&&typeof value!=='boolean') fail('invalid_boolean')
    if(value!==null && spec?.options&&!spec.options.includes(value)) fail('invalid_option')
    if(spec && !['json','boolean','number'].includes(spec.kind) && value!==null && typeof value!=='string') fail('invalid_text')
    if(['slug','block_key'].includes(key)&& (typeof value!=='string'||!/^[a-z0-9_-]+$/.test(value))) fail('invalid_slug')
    if(key==='gallery'&&value!==null&&(!Array.isArray(value)||value.some((v)=>typeof v!=='string'))) fail('invalid_gallery')
    if(['image_url','video_url','target_url'].includes(key)&&value && !/^(\/[^/]|https:\/\/)/.test(value)) fail('invalid_url')
    row[key]=value
  }
  if(owner || (table==='inquiries'&& !['administrator','commercial'].includes(who.role))) {
    if(table==='inquiries' && ['stage','assigned_to','next_followup_at','estimated_value_cents'].some((k)=>k in row)) fail('forbidden_field',403)
    row[ownerFields[table]??'customer_id']=who.user.id
    if(table==='inquiries') row.email=who.user.email
  }
  if(table==='cart_items' && (!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>20||typeof row.variant_id!=='string')) fail('invalid_cart')
  if(table==='media_spend_daily') {if(!Number.isSafeInteger(row.amount_cents)||row.amount_cents<0||typeof row.spend_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.spend_date))fail('invalid_spend');row.created_by=who.user.id}
  if(table==='crm_activities'){row.actor_id=who.user.id;text(row.note,1,2000);text(row.inquiry_id,1,80)}
  if(table==='inquiries'&&insert){text(row.name,2,100);text(row.message,5,2000);row.stage??='new'}
  if(insert) for(const spec of config?.fields ?? []) if(spec.required&&(row[spec.key]===undefined||row[spec.key]===null||row[spec.key]==='')) fail(`Campo obrigatório: ${spec.key}`)
  return row
}
const defaults={store_products:{status:'draft',sales_mode:'inquiry',gallery:[],attributes:{},featured:false,sort_order:0},product_variants:{currency:'BRL',stock_total:0,stock_reserved:0,available:false,min_quantity:1,max_quantity:20,attributes:{}},store_categories:{status:'draft',sort_order:0},store_pages:{status:'draft',approval_status:'pending',version:1},events:{status:'draft'},event_dates:{status:'draft'},parade_lineup:{status:'draft'},store_faqs:{status:'draft',sort_order:0},store_banners:{status:'draft',sort_order:0}}
async function joins(db,table,row,select) {
  const result=clean(row)
  if(table==='store_products') {
    if(select.includes('product_variants(')) result.product_variants=(await db.collection('product_variants').find({product_id:row.id}).toArray()).map(clean)
    if(select.includes('event_dates(')) result.event_dates=clean(await db.collection('event_dates').findOne({id:row.event_date_id}))
    if(select.includes('store_categories(')) result.category=clean(await db.collection('store_categories').findOne({id:row.category_id}))
  }
  if(table==='parade_lineup'&&select.includes('parade_schools(')) result.parade_schools=clean(await db.collection('parade_schools').findOne({id:row.school_id}))
  if(table==='orders'&&select.includes('order_items(')) result.order_items=(await db.collection('order_items').find({order_id:row.id}).toArray()).map(clean)
  return result
}
export async function query(db,who,input) {
  const {table,operation='select'}=input
  if(!modules[table]&&!publicTables.has(table)&&!ownerFields[table]&&!extraRoles[table]) fail('unknown_table',404)
  if(!['select','insert','update','upsert','delete'].includes(operation)) fail('invalid_operation')
  const access=await scope(db,table,who,operation!=='select')
  const conditions=filters(input.filters)
  const filter={$and:[access,...conditions]}
  const col=db.collection(table)
  if(operation==='select') {
    const limit=Math.min(Math.max(Number(input.limit)||500,1),2000)
    const sort={}
    for(const item of input.sort??[]) {if(typeof item.field!=='string'|| !/^[a-z][a-z0-9_]*$/.test(item.field))fail('invalid_sort');sort[item.field]=item.ascending===false?-1:1}
    const count=input.count?await col.countDocuments(filter):null
    if(input.head) return {data:null,count,error:null}
    const rows=await col.find(filter).sort(sort).limit(limit).toArray()
    const data=await Promise.all(rows.map((r)=>joins(db,table,r,String(input.select??'*'))))
    // Projection is applied after joining, so nested selection remains compatible with the UI.
    const selection=String(input.select??'*')
    const fields=selection.split(/,(?![^()]*\))/).map((f)=>f.trim())
    const projected=fields.includes('*')?data:data.map((r)=>Object.fromEntries(fields.map((f)=>{const key=f.split(':')[0].split('(')[0];return [key,r[key]]})))
    if(input.single && projected.length>1) fail('multiple_rows',409)
    return {data:input.single?projected[0]??null:projected,count,error:null}
  }
  if(['update','delete'].includes(operation)&&conditions.length===0) {
    if(!ownerFields[table]) fail('filter_required')
  }
  if(operation==='delete') {await col.deleteMany(filter);return {data:null,error:null}}
  if(operation==='update') {
    const row=validate(table,input.values,who,false);row.updated_at=new Date().toISOString()
    const before=table==='inquiries'?await col.findOne(filter):null
    await col.updateMany(filter,{$set:row})
    await audit(db,who,table,'update')
    if(before) await db.collection('crm_activities').insertOne({id:randomUUID(),inquiry_id:before.id,actor_id:who.user.id,note:`Atualização: ${Object.keys(row).filter((k)=>k!=='updated_at').join(', ')}`,created_at:row.updated_at})
    return {data:null,error:null}
  }
  const values=Array.isArray(input.values)?input.values:[input.values]
  if(!values.length||values.length>300) fail('invalid_batch')
  const prepared=values.map((v)=>({...defaults[table],...validate(table,v,who,true)}))
  const result=[]
  for(const row of prepared) {
    const now=new Date().toISOString();const key=tableKey(table)
    const unique=table==='cart_items'?{user_id:row.user_id,variant_id:row.variant_id}:{[key]:row[key]}
    if(operation==='upsert' && Object.values(unique).every((v)=>typeof v==='string')) {
      const stored=await col.findOneAndUpdate({...unique,...access},{$set:{...row,updated_at:now},$setOnInsert:{id:randomUUID(),created_at:now}},{upsert:true,returnDocument:'after'})
      result.push(clean(stored))
    } else {
      const record={id:randomUUID(),created_at:now,...row};if(!record[key]) record[key]=record.id
      await col.insertOne(record);result.push(clean(record))
    }
  }
  await audit(db,who,table,operation)
  return {data:input.single?result[0]:result,error:null}
}
export async function audit(db,who,table,operation) {if(who.user) await db.collection('audit_log').insertOne({id:randomUUID(),actor_id:who.user.id,table_name:table,operation,created_at:new Date().toISOString()})}
