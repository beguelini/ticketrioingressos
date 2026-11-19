import {createHash} from 'node:crypto'
export const collections=['users','sessions','auth_tokens','rate_limits','staff_roles','customer_profiles','store_categories','events','event_dates','parade_schools','parade_lineup','store_products','product_variants','store_pages','store_faqs','store_banners','home_blocks','store_settings','inquiries','shopping_carts','cart_items','orders','order_items','stock_reservations','stock_movements','payments','refunds','webhook_events','order_events','deliveries','transfer_routes','transfer_stops','transfer_passengers','notification_attempts','audit_log','crm_activities','media_spend_daily','order_attribution','support_agents','support_topics','support_conversations','support_messages','files']
export const identifier=value=>{if(typeof value!=='string'||!/^[a-z_][a-z0-9_]{0,62}$/.test(value))throw Error('invalid_identifier');return `"${value}"`}
export const indexName=(table,keys)=>`idx_${table.slice(0,22)}_${createHash('sha256').update(JSON.stringify(keys)).digest('hex').slice(0,16)}`
const unique={users:[['email'],['username']],staff_roles:[['user_id']],customer_profiles:[['user_id']],shopping_carts:[['user_id']],cart_items:[['user_id','variant_id']],store_products:[['sku'],['slug']],product_variants:[['sku']],store_categories:[['slug']],store_pages:[['slug']],store_settings:[['key']],home_blocks:[['block_key']],support_agents:[['agent_key']],files:[['bucket','path']],orders:[['customer_id','request_key']],webhook_events:[['external_event_id']]}
export const path=field=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(field))throw Error('invalid_field');return `document #> '{${field.split('.').join(',')}}'`}
export function schemaSql(schema){
 const s=identifier(schema)
 let sql=`create schema if not exists ${s};\nrevoke all on schema ${s} from public,anon,authenticated;\n`
 for(const name of collections){const table=`${s}.${identifier(name)}`
  sql+=`create table if not exists ${table} (key_id text primary key, document jsonb not null check(jsonb_typeof(document)='object'));\nalter table ${table} enable row level security;\nrevoke all on ${table} from public,anon,authenticated;\n`
  sql+=`create index if not exists ${identifier(indexName(name,['gin']))} on ${table} using gin(document jsonb_path_ops);\n`
  for(const keys of unique[name]??[]){sql+=`create unique index if not exists ${identifier(indexName(name,keys))} on ${table} (${keys.map(k=>`(${path(k)})`).join(',')}) where ${keys.map(k=>`${path(k)} is not null and ${path(k)} <> 'null'::jsonb`).join(' and ')};\n`}
  for(const field of ['id','user_id','customer_id','order_id','product_id','order_item_id','conversation_id','created_at','expires_at'])sql+=`create index if not exists ${identifier(indexName(name,[field,'lookup']))} on ${table} ((${path(field)}));\n`
 }
 return sql
}
