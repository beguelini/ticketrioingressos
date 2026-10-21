import { randomUUID } from 'node:crypto'
import { clean, digest, email, fail, rateLimit, secret, text } from './security.mjs'
const supportRoles=['administrator','commercial','operations','finance']
const now=()=>new Date().toISOString()
const message=(db,id,type,body,user=null)=>db.collection('support_messages').insertOne({id:randomUUID(),conversation_id:id,sender_type:type,sender_id:user,body,created_at:now()})
export async function visitor(db,req,input) {
  const ip=req.headers['x-forwarded-for']?.split(',')[0]??req.socket?.remoteAddress??'unknown'
  await rateLimit(db,`support-ip:${ip}`,80,300)
  if(input.action==='start') {
    if(input.website) fail('invalid_input')
    const name=text(input.name,2,100),address=email(input.email),body=text(input.message,5,2000)
    await rateLimit(db,`support-start:${ip}`,4,3600)
    const topic=await db.collection('support_topics').findOne({id:text(input.topic_id,1,80),active:true})
    if(!topic)fail('topic_unavailable')
    const agent=await db.collection('support_agents').findOne({agent_key:topic.agent_key})
    if(!agent)fail('queue_unavailable',503)
    const product=input.product_id?await db.collection('store_products').findOne({id:text(input.product_id,1,80),status:'published'}):null
    const token=secret(),id=randomUUID(),created=now()
    const conversation={id,topic_id:topic.id,agent_key:topic.agent_key,queue_role:agent.queue_role,product_id:product?.id??null,customer_name:name,customer_email:address,visitor_token_hash:digest(token),status:'waiting_staff',assigned_to:null,created_at:created,last_message_at:created,last_customer_message_at:created,last_staff_read_at:null}
    await db.collection('support_conversations').insertOne(conversation)
    await message(db,id,'visitor',body)
    if(agent.queue_role==='commercial') {
      const inquiry={id:randomUUID(),name,email:address,message:body,stage:'new',product_id:product?.id??null,created_at:created}
      for(const field of ['utm_source','utm_medium','utm_campaign']) {const value=input.attribution?.[field];if(typeof value==='string'&&/^[a-z0-9 _.-]{1,120}$/.test(value))inquiry[field]=value}
      await db.collection('inquiries').insertOne(inquiry)
      await db.collection('support_conversations').updateOne({id},{$set:{inquiry_id:inquiry.id}})
    }
    return {id,token,status:'waiting_staff',created_at:created}
  }
  const id=text(input.id,1,80),token=text(input.token,43,43)
  const conversation=await db.collection('support_conversations').findOne({id,visitor_token_hash:digest(token)})
  if(!conversation)fail('invalid_session',401)
  if(input.action==='thread')return {status:conversation.status,topic_id:conversation.topic_id,messages:(await db.collection('support_messages').find({conversation_id:id}).sort({created_at:1}).limit(300).toArray()).map(clean)}
  if(input.action==='send') {
    await rateLimit(db,`support-send:${id}`,12,300)
    await message(db,id,'visitor',text(input.message,1,2000))
    await db.collection('support_conversations').updateOne({id},{$set:{status:'waiting_staff',last_message_at:now(),last_customer_message_at:now(),closed_at:null}})
    return {ok:true}
  }
  fail('invalid_action')
}
export async function staff(db,who,input) {
  if(!supportRoles.includes(who.role))fail('Acesso negado.',403)
  const access=who.role==='administrator'?{}:{queue_role:who.role}
  if(input.action==='list')return {role:who.role,conversations:(await db.collection('support_conversations').find(access).sort({last_message_at:-1}).limit(200).toArray()).map(clean),topics:(await db.collection('support_topics').find({}).sort({sort_order:1}).toArray()).map(clean),agents:(await db.collection('support_agents').find({}).toArray()).map(clean),members:(await db.collection('staff_roles').find({role:{$in:supportRoles}}).toArray()).map(clean)}
  const conversation=await db.collection('support_conversations').findOne({...access,id:text(input.id,1,80)})
  if(!conversation)fail('not_found',404)
  const id=conversation.id
  if(input.action==='thread') {
    await db.collection('support_conversations').updateOne({id},{$set:{last_staff_read_at:now()}})
    return {conversation:clean(conversation),messages:(await db.collection('support_messages').find({conversation_id:id}).sort({created_at:1}).limit(300).toArray()).map(clean),product:clean(await db.collection('store_products').findOne({id:conversation.product_id}))}
  }
  let update
  if(input.action==='reply') {await message(db,id,'staff',text(input.message,1,2000),who.user.id);update={assigned_to:conversation.assigned_to??who.user.id,status:'waiting_customer',last_message_at:now(),last_staff_message_at:now(),last_staff_read_at:now(),closed_at:null}}
  if(input.action==='status'&&['closed','waiting_staff'].includes(input.status))update={status:input.status,closed_at:input.status==='closed'?now():null}
  if(input.action==='assign') {
    if(input.assigned_to!==null) {const target=await db.collection('staff_roles').findOne({user_id:text(input.assigned_to,1,80),role:{$in:['administrator',conversation.queue_role]}});if(!target)fail('invalid_assignee')}
    update={assigned_to:input.assigned_to}
  }
  if(input.action==='reroute'&&who.role==='administrator') {
    const topic=await db.collection('support_topics').findOne({id:text(input.topic_id,1,80),active:true})
    const agent=topic?await db.collection('support_agents').findOne({agent_key:topic.agent_key}):null
    if(!agent)fail('topic_unavailable')
    update={topic_id:topic.id,agent_key:agent.agent_key,queue_role:agent.queue_role,assigned_to:null,status:'waiting_staff',closed_at:null}
  }
  if(!update)fail('invalid_action')
  await db.collection('support_conversations').updateOne({id},{$set:update})
  return {ok:true}
}
