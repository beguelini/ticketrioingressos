import { describe, expect, it } from 'vitest'
import { DevelopmentPaymentSimulator } from './paymentProvider'

describe('simulador de pagamento', () => {
  it('é proibido fora do desenvolvimento local', () => {
    expect(() => new DevelopmentPaymentSimulator({ NODE_ENV: 'production' })).toThrow('development_only')
    expect(() => new DevelopmentPaymentSimulator({ NODE_ENV: 'development', VERCEL_ENV: 'preview' })).toThrow('development_only')
  })
  it('é idempotente por chave e rejeita valor alterado', async () => {
    const provider = new DevelopmentPaymentSimulator({ NODE_ENV: 'development' })
    const input = { orderId: 'a', amountCents: 10000, idempotencyKey: 'key' }
    const first = await provider.createCharge(input)
    expect(await provider.createCharge(input)).toEqual(first)
    await expect(provider.createCharge({ ...input, amountCents: 1 })).rejects.toThrow('idempotency_conflict')
  })
})
