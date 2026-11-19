import postgres from 'postgres'
import {readFileSync} from 'node:fs'
import {AsyncLocalStorage} from 'node:async_hooks'
import {randomUUID} from 'node:crypto'
import {collections,identifier,path,indexName,schemaSql} from './schema.mjs'
const context=new AsyncLocalStorage()
let connection
const packed=v=>JSON.parse(JSON.stringify(v,(_,x)=>x?.type==='Buffer'&&Array.isArray(x.data)?{base64:Buffer.from(x.data).toString('base64')}:typeof x==='bigint'?Number(x):x))
const json=v=>JSON.stringify(packed(v))
function parameters(){const values=[];return {values,add:v=>{values.push(v);return `$${values.length}`}}}
function arithmetic(value,p){
 if(typeof value==='string'&&value.startsWith('$'))return `(${path(value.slice(1))} #>> '{}')::numeric`
 if(typeof value==='number')return `${p.add(value)}::numeric`
 if(value?.$subtract)return `(${arithmetic(value.$subtract[0],p)}-${arithmetic(value.$subtract[1],p)})`
 throw Error('unsupported_expression')
}
export function where(filter,p){
 const clauses=[]
 for(const [field,value] of Object.entries(filter)){
  if(field==='$and'||field==='$or'){if(!Array.isArray(value))throw Error('invalid_filter');clauses.push(value.length?`(${value.map(v=>where(v,p)).join(field==='$and'?' and ':' or ')})`:field==='$and'?'true':'false');continue}
  if(field==='$expr'){const [op,args]=Object.entries(value)[0];if(op!=='$gte')throw Error('unsupported_expression');clauses.push(`(${arithmetic(args[0],p)} >= ${arithmetic(args[1],p)})`);continue}
  const target=path(field)
  if(value&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof Date)){
   for(const [op,v] of Object.entries(value)){
    if(op==='$in'||op==='$nin'){const options=v.map(x=>`${p.add(json(x))}::text::jsonb`).join(',');clauses.push(options?`${target} ${op==='$nin'?'not in':'in'} (${options})`:op==='$in'?'false':'true')}
    else if(op==='$ne')clauses.push(`${target} is distinct from ${p.add(json(v))}::text::jsonb`)
    else if(['$gt','$gte','$lt','$lte'].includes(op))clauses.push(`${target} ${{'$gt':'>','$gte':'>=','$lt':'<','$lte':'<='}[op]} ${p.add(json(v))}::text::jsonb`)
    else if(op==='$type'){if(!['string','number','boolean','array','object'].includes(v))throw Error('invalid_type');clauses.push(`jsonb_typeof(${target})=${p.add(v)}`)}
    else if(op==='$exists')clauses.push(`${target} is ${v?'not ':''}null`)
    else throw Error('unsupported_filter')
   }
  }else clauses.push(`coalesce(${target},'null'::text::jsonb)=${p.add(json(value))}::text::jsonb`)
 }
 return clauses.length?`(${clauses.join(' and ')})`:'true'
}
function project(row,projection){if(!projection)return row;const keys=Object.entries(projection).filter(([,v])=>v).map(([k])=>k);return keys.length?Object.fromEntries(keys.filter(k=>row[k]!==undefined).map(k=>[k,row[k]])):Object.fromEntries(Object.entries(row).filter(([k])=>projection[k]!==0))}
function updated(row,update,insert){
 const result={...row,...(insert?update.$setOnInsert:{}),...update.$set}
 for(const [key,amount] of Object.entries(update.$inc??{})){if(typeof amount!=='number'||!Number.isFinite(amount))throw Error('invalid_increment');result[key]=(result[key]??0)+amount}
 for(const key of Object.keys(update.$unset??{}))delete result[key]
 return packed(result)
}
function normalize(error){if(error.code==='23505')error.code=11000;throw error}
class Cursor{
 constructor(collection,filter,options){this.collection=collection;this.filter=filter;this.options=options;this.max=0;this.sortBy={}}
 sort(spec){this.sortBy=spec;return this} limit(max){this.max=max;return this} project(projection){this.options={...this.options,projection};return this}
 async toArray(){const p=parameters(),condition=where(this.filter,p),sort=Object.entries(this.sortBy).map(([key,d])=>`${path(key)} ${d===-1?'desc':'asc'} nulls last`).join(',');const limit=this.max?` limit ${p.add(Math.min(Math.max(this.max,1),100000))}`:''
 const sql=this.collection.sql(this.options),rows=await sql.unsafe(`select document from ${this.collection.table} where ${condition}${sort?' order by '+sort:''}${limit}${this.options?.session?' for update':''}`,p.values)
 return rows.map(r=>project(r.document,this.options?.projection))}
}
class Collection{
 constructor(db,name){if(!collections.includes(name))throw Error('unknown_collection');this.db=db;this.name=name;this.table=`${identifier(db.databaseName)}.${identifier(name)}`}
 sql(options){return options?.session?.sql??context.getStore()??this.db.sql}
 find(filter={},options={}){return new Cursor(this,filter,options)}
 async findOne(filter={},options={}){return (await this.find(filter,options).limit(1).toArray())[0]??null}
 async countDocuments(filter={},options={}){const p=parameters();const rows=await this.sql(options).unsafe(`select count(*)::integer as count from ${this.table} where ${where(filter,p)}`,p.values);return rows[0].count}
 async insertOne(input,options={}){const row=packed(input),id=String(row.id??row._id??randomUUID());row._id??=id;try{await this.sql(options).unsafe(`insert into ${this.table}(key_id,document) values($1,$2::text::jsonb)`,[id,json(row)]);return {insertedId:id}}catch(e){normalize(e)}}
 async insertMany(rows,options={}){let insertedCount=0;for(const row of rows){await this.insertOne(row,options);insertedCount++}return {insertedCount}}
 async mutate(filter,update,options={},multiple=false,remove=false){
  const execute=async sql=>{const p=parameters(),condition=where(filter,p)
   if(options.upsert)await sql.unsafe('select pg_advisory_xact_lock(hashtextextended($1,0))',[this.table+json(filter)])
   const found=await sql.unsafe(`select key_id,document from ${this.table} where ${condition} order by key_id${multiple?'':' limit 1'} for update`,p.values)
   if(!found.length&&options.upsert){const base=Object.fromEntries(Object.entries(filter).filter(([k,v])=>!k.startsWith('$')&&(v===null||typeof v!=='object')));const row=updated(base,update,true);await this.insertOne(row,{session:{sql}});return {before:null,after:row,count:1,upserted:true}}
   for(const entry of found){if(remove)await sql.unsafe(`delete from ${this.table} where key_id=$1`,[entry.key_id]);else await sql.unsafe(`update ${this.table} set document=$2::text::jsonb where key_id=$1`,[entry.key_id,json(updated(entry.document,update,false))])}
   return {before:found[0]?.document??null,after:found[0]?updated(found[0].document,update,false):null,count:found.length,upserted:false}
  }
  try{const current=options.session?.sql??context.getStore();return await (current?execute(current):this.db.sql.begin(execute))}catch(e){normalize(e)}
 }
 async updateOne(filter,update,options={}){const r=await this.mutate(filter,update,options);return {matchedCount:r.upserted?0:r.count,modifiedCount:r.upserted?0:r.count,upsertedCount:r.upserted?1:0}}
 async updateMany(filter,update,options={}){const r=await this.mutate(filter,update,options,true);return {matchedCount:r.count,modifiedCount:r.count}}
 async findOneAndUpdate(filter,update,options={}){const r=await this.mutate(filter,update,options);return options.returnDocument==='after'?r.after:r.before}
 async findOneAndDelete(filter,options={}){return (await this.mutate(filter,{},options,false,true)).before}
 async deleteOne(filter,options={}){return {deletedCount:(await this.mutate(filter,{},options,false,true)).count}}
 async deleteMany(filter={},options={}){return {deletedCount:(await this.mutate(filter,{},options,true,true)).count}}
 async drop(){if(!/^ticketrio_test_[a-f0-9]+$/.test(this.db.databaseName))throw Error('drop_only_test_tables');await this.db.sql.unsafe(`drop table ${this.table}`)}
 async createIndex(keys,options={}){if(options.expireAfterSeconds!==undefined)return 'expiration_checked_at_read';const fields=Object.keys(keys);const expressions=fields.map(k=>`(${path(k)})`).join(',');const sql=`create ${options.unique?'unique ':''}index if not exists ${identifier(indexName(this.name,keys))} on ${this.table} (${expressions})${options.sparse?' where '+fields.map(k=>`${path(k)} is not null`).join(' and '):''}`;await this.db.sql.unsafe(sql);return indexName(this.name,keys)}
 async indexes(){return []}
}
export function openPostgres(url){return postgres(url,{ssl:{rejectUnauthorized:true,ca:readFileSync(new URL('./supabase-ca.crt',import.meta.url),'utf8')},max:2,prepare:false,idle_timeout:20,connect_timeout:20,onnotice:()=>{}})}
export function createDatabase(sql,schema){
 identifier(schema)
 const db={kind:'supabase',databaseName:schema,sql,collection:name=>new Collection(db,name),createCollection:async name=>{if(!collections.includes(name))throw Error('unknown_collection');await sql.unsafe(`create table if not exists ${identifier(schema)}.${identifier(name)}(key_id text primary key,document jsonb not null check(jsonb_typeof(document)='object'));alter table ${identifier(schema)}.${identifier(name)} enable row level security`);return db.collection(name)},listCollections:()=>({toArray:async()=>{const rows=await sql.unsafe('select table_name as name from information_schema.tables where table_schema=$1',[schema]);return rows.filter(r=>collections.includes(r.name))}})}
 const client={db:name=>createDatabase(sql,name).db,close:()=>sql.end({timeout:5}),startSession:()=>{const session={sql:null,async withTransaction(fn){for(let attempt=0;;attempt++){try{return await sql.begin(tx=>{session.sql=tx;return context.run(tx,fn)})}catch(e){if(!['40001','40P01'].includes(e.code)||attempt>=2)throw e}finally{session.sql=null}}},async endSession(){}};return session}}
 return {db,client}
}
export async function database(){if(!process.env.SUPABASE_DB_URL)throw Error('supabase_database_unavailable');connection??=openPostgres(process.env.SUPABASE_DB_URL);return createDatabase(connection,process.env.SUPABASE_DB_SCHEMA||'ticketrio')}
export async function initialize(db){if(!/^ticketrio_test_[a-f0-9]+$/.test(db.databaseName))throw Error('initialize_only_isolated_test_schema');await db.sql.unsafe(schemaSql(db.databaseName))}
