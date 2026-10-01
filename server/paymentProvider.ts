// Server-only contract. Select and integrate a real gateway before enabling commerce.
export type PaymentState = 'pending' | 'approved' | 'failed' | 'expired' | 'refunded'
export type Charge = { id: string; orderId: string; amountCents: number; state: PaymentState }
export interface PaymentProvider {
  createCharge(input: { orderId: string; amountCents: number; idempotencyKey: string }): Promise<Charge>
  getCharge(id: string): Promise<Charge | null>
}

export class DevelopmentPaymentSimulator implements PaymentProvider {
  private byKey = new Map<string, Charge>()
  private byId = new Map<string, Charge>()
  constructor(environment: { NODE_ENV?: string; VERCEL_ENV?: string }) {
    if (environment.NODE_ENV !== 'development' || environment.VERCEL_ENV) throw new Error('development_only')
  }
  async createCharge(input: { orderId: string; amountCents: number; idempotencyKey: string }): Promise<Charge> {
    if (input.amountCents <= 0 || !Number.isSafeInteger(input.amountCents)) throw new Error('invalid_amount')
    const existing = this.byKey.get(input.idempotencyKey)
    if (existing) {
      if (existing.orderId !== input.orderId || existing.amountCents !== input.amountCents) throw new Error('idempotency_conflict')
      return existing
    }
    const charge: Charge = { id: crypto.randomUUID(), orderId: input.orderId, amountCents: input.amountCents, state: 'pending' }
    this.byKey.set(input.idempotencyKey, charge)
    this.byId.set(charge.id, charge)
    return charge
  }
  async getCharge(id: string): Promise<Charge | null> { return this.byId.get(id) ?? null }
}
