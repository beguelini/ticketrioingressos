import { MongoClient } from 'mongodb'
let connection
export async function database() {
  if (!process.env.MONGODB_URI) throw new Error('database_unavailable')
  connection ??= new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 }).connect().catch((error) => { connection = undefined; throw error })
  const client = await connection
  return { client, db: client.db(process.env.MONGODB_DB || 'ticketrio') }
}
export const collections = ['users','sessions','auth_tokens','rate_limits','staff_roles','customer_profiles','store_categories','events','event_dates','parade_schools','parade_lineup','store_products','product_variants','store_pages','store_faqs','store_banners','home_blocks','store_settings','inquiries','shopping_carts','cart_items','orders','order_items','stock_reservations','stock_movements','payments','refunds','webhook_events','order_events','deliveries','transfer_routes','transfer_stops','transfer_passengers','notification_attempts','audit_log','crm_activities','media_spend_daily','order_attribution','support_agents','support_topics','support_conversations','support_messages','files']
export async function initialize(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name))
  for (const name of collections) if (!existing.has(name)) await db.createCollection(name)
  for (const name of collections.filter((n) => !['sessions','auth_tokens','rate_limits'].includes(n))) await db.collection(name).createIndex({ id: 1 }, { unique: true, sparse: true })
  for (const [name, keys] of [ ['users',{email:1}], ['staff_roles',{user_id:1}], ['customer_profiles',{user_id:1}], ['shopping_carts',{user_id:1}], ['cart_items',{user_id:1,variant_id:1}], ['store_products',{sku:1}], ['store_products',{slug:1}], ['product_variants',{sku:1}], ['store_categories',{slug:1}], ['store_pages',{slug:1}], ['store_settings',{key:1}], ['home_blocks',{block_key:1}], ['support_agents',{agent_key:1}], ['files',{bucket:1,path:1}], ['orders',{customer_id:1,request_key:1}], ['webhook_events',{external_event_id:1}] ]) await db.collection(name).createIndex(keys,{unique:true,sparse:true})
  for (const name of ['sessions','auth_tokens','rate_limits']) await db.collection(name).createIndex({expires_at:1},{expireAfterSeconds:0})
  await db.collection('store_products').createIndex({status:1,sort_order:1})
  await db.collection('orders').createIndex({customer_id:1,created_at:-1})
  await db.collection('support_messages').createIndex({conversation_id:1,created_at:1})
  await db.collection('support_conversations').createIndex({queue_role:1,last_message_at:-1})
}
