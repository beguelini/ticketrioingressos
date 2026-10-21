import {randomUUID} from 'node:crypto'
import {email,fail,text} from './security.mjs'
import {issueToken,sendAuthEmail} from './auth.mjs'
const roles=['administrator','commercial','operations','finance','marketing']
export async function manageStaff(db,client,who,input,baseUrl) {
  if(who.role!=='administrator')fail('Acesso negado.',403)
  if(input.action==='invite') {
    if(!roles.includes(input.role))fail('invalid_role')
    const address=email(input.email)
    let user=await db.collection('users').findOne({email:address})
    const invited=!user?.password_hash
    if(invited&&(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM))fail('Configure RESEND_API_KEY e EMAIL_FROM para enviar convites.',503)
    if(!user) {user={id:randomUUID(),email:address,created_at:new Date().toISOString()};await db.collection('users').insertOne(user)}
    if(invited)await sendAuthEmail(db,user,await issueToken(db,user,'invite',baseUrl,true),'Convite para o painel Ticket Rio')
    await db.collection('staff_roles').updateOne({user_id:user.id},{$set:{role:input.role,email:address},$setOnInsert:{id:randomUUID(),created_at:new Date().toISOString()}},{upsert:true})
    return {ok:true,invited}
  }
  const id=text(input.user_id,1,80)
  if(id===who.user.id)fail('Você não pode alterar o próprio acesso.',409)
  if(!['update','revoke'].includes(input.action)||input.action==='update'&&!roles.includes(input.role))fail('invalid_action')
  const session=client.startSession()
  try {await session.withTransaction(async()=>{
    // Serialize changes to administrator membership, including simultaneous revocations.
    await db.collection('store_settings').updateOne({key:'staff_version'},{$inc:{value:1}},{upsert:true,session})
    const target=await db.collection('staff_roles').findOne({user_id:id},{session})
    if(!target)fail('not_found',404)
    if(target.role==='administrator'&&await db.collection('staff_roles').countDocuments({role:'administrator'},{session})<=1)fail('last_administrator',409)
    if(input.action==='revoke')await db.collection('staff_roles').deleteOne({user_id:id},{session})
    else await db.collection('staff_roles').updateOne({user_id:id},{$set:{role:input.role}},{session})
    await db.collection('sessions').deleteMany({user_id:id},{session})
  })}finally{await session.endSession()}
  return {ok:true}
}
