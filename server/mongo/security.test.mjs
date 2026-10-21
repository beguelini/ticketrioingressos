import {describe,it,expect} from 'vitest'
import {passwordHash,passwordMatches,safeObject,digest} from './security.mjs'
import {filters} from './data.mjs'
import {imageType} from './files.mjs'
describe('TicketRio security primitives',()=>{
 it('stores salted password hashes and rejects incorrect passwords',async()=>{const a=await passwordHash('Uma-senha-segura-2026!'),b=await passwordHash('Uma-senha-segura-2026!');expect(a).not.toBe(b);expect(await passwordMatches('Uma-senha-segura-2026!',a)).toBe(true);expect(await passwordMatches('incorreta',a)).toBe(false)})
 it('rejects short passwords',async()=>expect(passwordHash('curta')).rejects.toThrow())
 it('rejects Mongo operators in payloads and filters',()=>{expect(()=>safeObject({name:{$ne:null}})).toThrow();expect(()=>filters([{field:'id',op:'eq',value:{$ne:null}}])).toThrow();expect(()=>filters([{field:'$where',op:'eq',value:'code'}])).toThrow()})
 it('allows only scalar query filters',()=>expect(filters([{field:'id',op:'in',value:['one','two']}])).toEqual([{id:{$in:['one','two']}}]))
 it('rejects active SVG/HTML uploads and verifies binary signatures',()=>{expect(()=>imageType(Buffer.from('<svg onload="alert(1)"></svg>'))).toThrow();expect(imageType(Buffer.from([255,216,255,0]))).toBe('image/jpeg')})
 it('hashes session and recovery tokens before persistence',()=>expect(digest('secret')).toMatch(/^[a-f0-9]{64}$/))
})
