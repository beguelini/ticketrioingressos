import { beforeAll, describe, expect, it, vi } from 'vitest'
import { authAction } from './auth.mjs'
import { passwordHash } from './security.mjs'

describe('Administrative username authentication', () => {
  let user
  const password = 'A-test-password-2026!'
  beforeAll(async () => {
    user = {id:'admin-id',email:'owner+admin@example.test',username:'admin',password_hash:await passwordHash(password),email_confirmed_at:'2026-11-16'}
  })
  function setup(account = user, role = 'administrator') {
    const users = {findOne:vi.fn(async (filter) => {
      if (!account || account.disabled || (filter.username ? filter.username !== account.username : filter.email !== account.email)) return null
      return account
    })}
    const staff = {findOne:vi.fn(async () => role === 'administrator' ? {role} : null)}
    const sessions = {insertOne:vi.fn()}
    const limits = {findOneAndUpdate:vi.fn(async () => ({hits:1}))}
    const db = {collection:(name) => ({users,staff_roles:staff,sessions,rate_limits:limits})[name]}
    const res = {setHeader:vi.fn()}
    const login = (identifier, secret = password) => authAction(db,{headers:{},socket:{remoteAddress:'test'}},res,{action:'login',email:identifier,password:secret},{},'http://localhost:5173')
    return {login,res,limits,sessions}
  }
  it('accepts admin, normalizes case, and shares the email attempt limit', async () => {
    const {login,res,limits} = setup()
    expect((await login(' ADMIN ')).user.email).toBe(user.email)
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie',expect.stringContaining('HttpOnly'))
    const aliasKey = limits.findOneAndUpdate.mock.calls[1][0]._id
    await login(user.email)
    expect(limits.findOneAndUpdate.mock.calls[3][0]._id).toBe(aliasKey)
  })
  it.each(['commercial', null])('rejects admin when the administrative role is revoked (%s)', async (role) => {
    const {login,sessions} = setup(user,role)
    await expect(login('admin')).rejects.toMatchObject({status:401})
    expect(sessions.insertOne).not.toHaveBeenCalled()
  })
  it('rejects wrong passwords, missing accounts, disabled and unconfirmed accounts', async () => {
    await expect(setup().login('admin','incorrect')).rejects.toMatchObject({status:401})
    for (const account of [null,{...user,disabled:true},{...user,email_confirmed_at:null}]) {
      await expect(setup(account).login('admin')).rejects.toMatchObject({status:401})
    }
  })
  it('preserves customer login by email and rejects arbitrary usernames and objects', async () => {
    const customer = {...user,email:'customer@example.test',username:undefined}
    expect((await setup(customer,null).login(customer.email)).user.email).toBe(customer.email)
    await expect(setup().login('other-user')).rejects.toThrow('invalid_email')
    await expect(setup().login({$ne:null})).rejects.toThrow('invalid_input')
  })
})
