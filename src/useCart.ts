import { useEffect, useRef, useState } from 'react'
import { supabase, type CartLine } from './store'

const storageKey = 'ticket-rio-cart-v2'

function readCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is CartLine =>
      typeof item === 'object' && item !== null &&
      typeof item.variant_id === 'string' &&
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20)
  } catch { return [] }
}

export function useCart(userId: string | null) {
  const [lines, setLines] = useState<CartLine[]>(readCart)
  const previousUser = useRef<string | null>(null)
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(lines)) }, [lines])
  useEffect(() => {
    if (previousUser.current && previousUser.current !== userId) {
      localStorage.removeItem(storageKey)
      setLines([])
    }
    previousUser.current = userId
  }, [userId])
  useEffect(() => {
    if (!userId || !supabase) return
    let cancelled = false
    const reconcile = async () => {
      const client = supabase
      if (!client) return
      await client.from('shopping_carts').upsert({ user_id: userId })
      const { data } = await client.from('cart_items').select('variant_id,quantity').eq('user_id', userId)
      if (cancelled) return
      const merged = new Map<string, CartLine>()
      for (const line of data ?? []) merged.set(line.variant_id, { variant_id: line.variant_id, quantity: line.quantity })
      for (const line of readCart()) merged.set(line.variant_id, line)
      const next = [...merged.values()]
      setLines(next)
      if (next.length) await client.from('cart_items').upsert(next.map((line) => ({ ...line, user_id: userId })))
    }
    void reconcile()
    return () => { cancelled = true }
  }, [userId])
  const add = (variantId: string, quantity: number) => setLines((current) => {
    const existing = current.find((line) => line.variant_id === variantId)
    const next = existing
      ? current.map((line) => line.variant_id === variantId ? { ...line, quantity: Math.min(20, line.quantity + quantity) } : line)
      : [...current, { variant_id: variantId, quantity }]
    if (userId && supabase) void supabase.from('cart_items').upsert({ user_id: userId, variant_id: variantId, quantity: next.find((line) => line.variant_id === variantId)?.quantity ?? quantity })
    return next
  })
  const remove = (variantId: string) => {
    setLines((current) => current.filter((line) => line.variant_id !== variantId))
    if (userId && supabase) void supabase.from('cart_items').delete().eq('user_id', userId).eq('variant_id', variantId)
  }
  const clear = () => {
    setLines([])
    if (userId && supabase) void supabase.from('cart_items').delete().eq('user_id', userId)
  }
  return { lines, add, remove, clear, count: lines.reduce((sum, line) => sum + line.quantity, 0) }
}
