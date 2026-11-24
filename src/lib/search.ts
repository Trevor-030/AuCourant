import { money, normalize } from './format'
import type { PTx } from './personal-data'

/** True when the query is empty or any field contains it (case and spacing ignored, as in normalize). */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const n = normalize(q)
  return !n || fields.some((f) => f && normalize(f).includes(n))
}

/**
 * The Personal search: name, nickname, phone, reference, amount and category. Not the SMS text: every
 * MoMo message says "Current Balance", "Fee charged" and "Reference", so "rent" or "fee" matched them all.
 */
export function pTxMatches(t: PTx, q: string, nickname: string | null | undefined, categoryName: string) {
  // The phone is shown spaced ("020 555 0118"); people often type it without the spaces.
  return matches(q, t.name, nickname, t.phone, t.phone?.replace(/\s/g, ''), t.reference, money(t.amount), t.amount.toFixed(2), categoryName)
}
