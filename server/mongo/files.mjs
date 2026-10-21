import {randomUUID} from 'node:crypto'
import {fail,text} from './security.mjs'
export function imageType(bytes) {
  if(bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) return 'image/jpeg'
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png'
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp'
  fail('Formato permitido: JPEG, PNG ou WebP.')
}
export async function upload(db,who,input) {
  if(!['administrator','commercial','marketing'].includes(who.role))fail('Acesso negado.',403)
  if(input.bucket!=='ticket-rio-media')fail('invalid_bucket')
  const path=text(input.path,1,300)
  if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))fail('invalid_path')
  if(typeof input.base64!=='string'||input.base64.length>2800000)fail('Imagem muito grande. Limite de 2 MB.',413)
  const bytes=Buffer.from(input.base64,'base64'),mime=imageType(bytes)
  if(bytes.length>2*1024*1024)fail('Imagem muito grande. Limite de 2 MB.',413)
  await db.collection('files').insertOne({id:randomUUID(),bucket:input.bucket,path,mime,bytes,owner_id:who.user.id,created_at:new Date().toISOString()})
  return {path}
}
