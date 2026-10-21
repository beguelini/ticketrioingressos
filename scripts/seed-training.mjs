import {randomUUID,randomBytes} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {database} from '../server/mongo/db.mjs'
import {passwordHash} from '../server/mongo/security.mjs'
const output=process.argv[2]
if(!output)throw new Error('Informe um arquivo privado para as credenciais.')
const {db,client}=await database()
const batch='training-2026-10',address='raulbeguelini29+treinamento@gmail.com'
try {
 const now=new Date().toISOString()
 const products=await db.collection('store_products').find({status:'published'}).sort({sort_order:1}).toArray()
 if(!products.length)throw new Error('Catálogo vazio.')
 const names=['Marina Duarte','Lucas Almeida','Beatriz Costa','Gabriel Martins','Camila Rocha','Rafael Nunes','Sofia Ribeiro','Pedro Azevedo']
 const states=[['confirmed','approved','available_official_app'],['pending_payment','pending','awaiting_supplier'],['confirmed','approved','awaiting_supplier'],['confirmed','approved','delivered'],['cancelled','refunded','cancelled'],['confirmed','approved','ready_for_pickup']]
 const session=client.startSession()
 let created=0
 try {await session.withTransaction(async()=>{
  for(let i=0;i<12;i++) {
   const id=`${batch}-sale-${i+1}`
   if(await db.collection('orders').findOne({id},{session}))continue
   const kind=['ticket','package','transfer','tour'][i%4],pool=products.filter(p=>p.kind===kind)
   const c=i%8,p=pool[Math.floor(i/4)%pool.length]??products[i%products.length],customerId=`${batch}-customer-${c+1}`,quantity=2+i%3,unit=35000+i*12500
   const [status,payment_status,delivery_status]=states[i%states.length]
   const created_at=new Date(Date.now()-(12-i)*86400000).toISOString()
   const customer={full_name:names[c],email:`cliente${c+1}@example.invalid`,phone:`+55 (00) 00000-000${c+1}`,document_type:'Documento demonstrativo',document_number:`DEMO-CLIENTE-${String(c+1).padStart(3,'0')}`,birth_date:`199${c}-0${c%8+1}-15`,country:'Brasil',language:'Português',address:{street:`Rua de Treinamento, ${100+c}`,complement:`Apartamento ${201+c}`,district:'Bairro Exemplo',city:'Rio de Janeiro',state:'RJ',postal_code:'00000-000'},emergency_contact:'Contato fictício · +55 (00) 00000-0000'}
   await db.collection('customer_profiles').updateOne({user_id:customerId},{$setOnInsert:{id:customerId,user_id:customerId,first_name:names[c].split(' ')[0],last_name:names[c].split(' ').slice(1).join(' '),...customer,is_training:true,training_batch:batch,created_at}},{upsert:true,session})
   const productDate=p.name_pt.match(/(\d{2})\/(\d{2})\/(\d{4})/)
   const serviceDate=productDate?`${productDate[3]}-${productDate[2]}-${productDate[1]}`:`2027-02-${String(5+i%8).padStart(2,'0')}`
   const item={id:`${id}-item`,order_id:id,product_id:p.id,variant_id:`${id}-variant`,product_name:p.name_pt,variant_name:'Experiência demonstrativa · 2027',quantity,unit_price_cents:unit,total_cents:quantity*unit,attributes:{service_date:serviceDate,pickup_point:i%2?'Hotel Exemplo · Copacabana':'Ponto demonstrativo · Centro',sector:`Setor demonstrativo ${i%4+3}`,participants:Array.from({length:quantity},(_,j)=>({name:j?`Acompanhante fictício ${j}`:names[c],document:`DEMO-PAX-${i+1}-${j+1}`,age:j?28+j:35})),accessibility:i%4===0?'Mobilidade reduzida: confirmar assistência no treinamento':'Sem solicitação especial'},is_training:true,training_batch:batch}
   await db.collection('orders').insertOne({id,customer_id:customerId,request_key:id,order_number:`TR-DEMO-${String(i+1).padStart(3,'0')}`,status,payment_status,delivery_status,total_cents:quantity*unit,currency:'BRL',created_at,updated_at:now,is_training:true,training_batch:batch,customer_snapshot:customer,sales_channel:['WhatsApp','Loja','Parceiro'][i%3],assigned_to:'Equipe de treinamento',internal_notes:'VENDA FICTÍCIA PARA TREINAMENTO. Não cobrar, emitir ingresso, reservar estoque nem contatar os dados demonstrativos.',logistics:{meeting_time:'18:30',return_time:'Após o evento · simulação',supplier:'Fornecedor demonstrativo',hotel:'Hotel Exemplo · endereço fictício',instructions:i%2?'Simular conferência da lista de passageiros e ponto de embarque.':'Simular conferência dos documentos e orientação sobre entrega oficial.'}},{session})
   await db.collection('order_items').insertOne(item,{session})
   await db.collection('payments').insertOne({id:`${id}-payment`,order_id:id,status:payment_status,amount_cents:quantity*unit,currency:'BRL',method:i%2?'pix':'credit_card',provider:'simulation',installments:i%2?1:3,reference:`SIM-${String(i+1).padStart(3,'0')}`,is_training:true,training_batch:batch,created_at},{session})
   await db.collection('deliveries').insertOne({id:`${id}-delivery`,order_item_id:item.id,order_id:id,status:delivery_status,supplier:'Fornecedor demonstrativo',recipient_email:customer.email,instructions:'Simulação: nenhum ingresso válido será emitido.',is_training:true,training_batch:batch,created_at},{session})
   for(const [j,note] of ['Venda demonstrativa criada',`Pagamento simulado: ${{approved:'aprovado',pending:'pendente',refunded:'reembolsado'}[payment_status]}`,`Logística: ${{available_official_app:'disponível no app',awaiting_supplier:'aguardando fornecedor',delivered:'entregue',cancelled:'cancelada',ready_for_pickup:'pronta para retirada'}[delivery_status]}`].entries())await db.collection('order_events').insertOne({id:`${id}-event-${j}`,order_id:id,note,actor:'Equipe de treinamento',created_at:new Date(new Date(created_at).getTime()+j*3600000).toISOString(),is_training:true,training_batch:batch},{session})
   created++
  }
 })}finally{await session.endSession()}
 // Never reset an existing password on a rerun.
 let user=await db.collection('users').findOne({email:address}),password
 if(!user){password=randomBytes(24).toString('base64url');user={id:randomUUID(),email:address,password_hash:await passwordHash(password),email_confirmed_at:now,created_at:now};await db.collection('users').insertOne(user)}
 await db.collection('staff_roles').updateOne({user_id:user.id},{$set:{email:address,role:'administrator'},$setOnInsert:{id:randomUUID(),created_at:now}},{upsert:true})
 await writeFile(output,`Ticket Rio · acesso administrativo de treinamento\nURL: https://ticketrioingressos.com.br/admin?secao=sales\nE-mail: ${address}\n${password?`Senha: ${password}`:'A conta já existe. A senha anterior foi preservada.'}\n\nAlias do Gmail de raulbeguelini29@gmail.com. A conta principal foi preservada.\nEste acesso é administrador completo: compartilhe apenas com equipe autorizada.\n12 vendas marcadas TREINAMENTO, dados inteiramente fictícios, sem cobranças, mensagens ou estoque real.\n`,{mode:0o600,flag:'wx'})
 console.log(JSON.stringify({created,total:await db.collection('orders').countDocuments({training_batch:batch}),credentials:'saved privately',database:db.databaseName}))
}finally{await client.close()}
