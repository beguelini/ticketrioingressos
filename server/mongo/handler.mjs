import {database} from './db.mjs'
import {authAction,identity} from './auth.mjs'
import {query} from './data.mjs'
import {visitor,staff} from './support.mjs'
import {manageStaff} from './team.mjs'
import {upload} from './files.mjs'
import {mediaReport} from './reports.mjs'
import {quote,checkout,webhook,expire} from './commerce.mjs'
import {fail,rateLimit} from './security.mjs'
export async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
  const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
  try {
    const url=new URL(req.url,'http://localhost')
    const {db,client}=await database()
    const who=await identity(db,req)
    if(req.method==='GET'&&url.searchParams.has('file')) {
      const bucket=url.searchParams.get('bucket'),path=url.searchParams.get('file')
      if(!['ticket-rio-media','ticket-rio-documents'].includes(bucket))fail('not_found',404)
      const file=await db.collection('files').findOne({bucket,path,...(bucket==='ticket-rio-documents'&&who.role!=='administrator'?{owner_id:who.user?.id??''}:{})})
      if(!file)fail('not_found',404)
      res.setHeader('Content-Type',file.mime);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox")
      res.end(Buffer.from(file.bytes.buffer));return
    }
    if(req.method!=='POST')fail('method_not_allowed',405)
    let input=req.body
    if(!input) {let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>3000000)fail('payload_too_large',413)}try{input=JSON.parse(raw)}catch{fail('invalid_json')}}
    if(typeof input==='string') {try{input=JSON.parse(input)}catch{fail('invalid_json')}}
    if(!input||typeof input!=='object'||Array.isArray(input))fail('invalid_input')
    if(url.searchParams.get('webhook')==='1')input={kind:'webhook',body:input}
    const baseUrl=process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:process.env.SITE_URL||'https://ticketrioingressos.com.br'
    if(input.kind!=='webhook'&&input.kind!=='cron') {
      const allowed=new Set([new URL(baseUrl).origin,...(process.env.ALLOWED_ORIGINS??'').split(',').filter(Boolean)])
      if(process.env.VERCEL_URL)allowed.add(`https://${process.env.VERCEL_URL}`)
      if(process.env.VERCEL_BRANCH_URL)allowed.add(`https://${process.env.VERCEL_BRANCH_URL}`)
      if(process.env.NODE_ENV!=='production') {allowed.add('http://localhost:5173');allowed.add('http://127.0.0.1:5173')}
      // Same-origin JSON requests only. No cross-origin credentials or permissive CORS.
      if(!allowed.has(req.headers.origin)||!String(req.headers['content-type']??'').startsWith('application/json'))fail('forbidden_origin',403)
      if(req.headers['sec-fetch-site']==='cross-site')fail('forbidden_origin',403)
      const ip=req.headers['x-forwarded-for']?.split(',')[0]??req.socket?.remoteAddress??'unknown'
      await rateLimit(db,`api:${ip}`,300,60)
    }
    let data
    if(input.kind==='auth')data=await authAction(db,req,res,input,who,baseUrl)
    else if(input.kind==='query') {send(await query(db,who,input));return}
    else if(input.kind==='upload')data=await upload(db,who,input)
    else if(input.kind==='function'&&input.name==='support-visitor')data=await visitor(db,req,input.body)
    else if(input.kind==='function'&&input.name==='support-staff')data=await staff(db,who,input.body)
    else if(input.kind==='function'&&input.name==='manage-staff')data=await manageStaff(db,client,who,input.body,baseUrl)
    else if(input.kind==='function'&&input.name==='pagarme-checkout')data=await checkout(db,client,who,input.body,baseUrl)
    else if(input.kind==='rpc'&&input.name==='quote_cart')data=await quote(db,input.body.lines)
    else if(input.kind==='rpc'&&input.name==='media_performance')data=await mediaReport(db,who,input.body)
    else if(input.kind==='webhook')data=await webhook(db,client,input.body)
    else if(input.kind==='cron') {if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)fail('unauthorized',401);await expire(db,client);data={ok:true}}
    else fail('not_found',404)
    send({data,error:null})
  }catch(error){const status=error.status??(error.code===11000?409:503);send({data:null,error:{message:error.status?error.message:error.code===11000?'Registro já existente.':'Serviço temporariamente indisponível.'}},status)}
}
