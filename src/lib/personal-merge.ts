import { personKeyOf, type Category, type CategoryRule, type PTx } from './personal-data'

/**
 * Personal merges and refunds, as pure functions so they run under plain Node
 * (scripts/test-personal-merge.js). Design: docs/superpowers/specs/2026-11-24-personal-merge-design.md.
 */

export type Totals = { moneyIn: number; moneyOut: number; fees: number; count: number }

/** How much has been given back on each payment, by payment id. Refunds of a payment that is not in `all` are left out. */
export function refundsByPayment(all: PTx[]): Map<string, number> {
  const ids = new Set(all.map((t) => t.id))
  const out = new Map<string, number>()
  for (const t of all) if (t.refundOf && ids.has(t.refundOf)) out.set(t.refundOf, (out.get(t.refundOf) ?? 0) + t.amount)
  return out
}

/**
 * Money in, money out and fees of a list. A refund never counts as money in; a refunded payment counts
 * only what was not given back, never below zero. `refunds` comes from all payments, so a refund in a
 * later period still reduces the payment it belongs to. Fees always count: a reversal does not return the fee.
 */
export function totalsOf(list: PTx[], refunds: Map<string, number> = new Map()): Totals {
  const t = { moneyIn: 0, moneyOut: 0, fees: 0, count: list.length }
  for (const x of list) {
    if (x.direction === 'in') {
      if (!x.refundOf) t.moneyIn += x.amount
    } else t.moneyOut += Math.max(0, x.amount - (refunds.get(x.id) ?? 0))
    t.fees += x.fee
  }
  return t
}

// ---- People ----------------------------------------------------------------------------

/** Person `fromKey` merged into `toKey`. Saved (list `person_merge`); the Java scan reads it for new payments. */
export type PersonMerge = {
  id: string
  fromKey: string
  toKey: string
  /** Payments moved when merging, so Separate can move them back. */
  txIds: string[]
  /** The kept person's nickname before the merge, and the merged-away person's, so Separate restores both. */
  nicknameBefore: string | null
  fromNickname: string | null
  date: string
}

export type PeopleState = { txs: PTx[]; rules: CategoryRule[]; nicknames: Record<string, string> }

/** The name the app shows for a person when there is no nickname: the newest payment's. */
function nameOf(txs: PTx[], key: string): string | undefined {
  let best: PTx | undefined
  for (const t of txs) if (t.personKey === key && (!best || t.date + t.time > best.date + best.time)) best = t
  return best?.name
}

/**
 * Moves person `fromKey`'s payments and rules to `toKey`. On a rule clash the kept person's rule wins.
 * `keepName` other than the kept person's own name becomes their nickname; otherwise the merged-away
 * person's nickname moves over when the kept person has none.
 */
export function mergePeople(
  s: PeopleState,
  a: { id: string; fromKey: string; toKey: string; keepName: string; date: string },
): PeopleState & { record: PersonMerge } {
  const moved = s.txs.filter((t) => t.personKey === a.fromKey).map((t) => t.id)
  const txs = s.txs.map((t) => (t.personKey === a.fromKey ? { ...t, personKey: a.toKey } : t))
  const keptHasRule = s.rules.some((r) => r.kind === 'person' && r.value === a.toKey)
  const rules = s.rules
    .filter((r) => !(keptHasRule && r.kind === 'person' && r.value === a.fromKey))
    .map((r) => (r.kind === 'person' && r.value === a.fromKey ? { ...r, value: a.toKey } : r))
  const nicknameBefore = s.nicknames[a.toKey] ?? null
  const fromNickname = s.nicknames[a.fromKey] ?? null
  const nicknames = { ...s.nicknames }
  delete nicknames[a.fromKey]
  if (a.keepName !== nameOf(s.txs, a.toKey)) nicknames[a.toKey] = a.keepName
  else if (!nicknameBefore && fromNickname) nicknames[a.toKey] = fromNickname
  return { txs, rules, nicknames, record: { id: a.id, fromKey: a.fromKey, toKey: a.toKey, txIds: moved, nicknameBefore, fromNickname, date: a.date } }
}

/**
 * Undoes a merge: the moved payments, and any later payment whose own number or name is `fromKey`, go back.
 * Both nicknames are restored. Rules stay with the kept person.
 */
export function separatePeople(s: PeopleState, r: PersonMerge): PeopleState {
  const moved = new Set(r.txIds)
  const txs = s.txs.map((t) => (moved.has(t.id) || personKeyOf(t.phone, t.name) === r.fromKey ? { ...t, personKey: r.fromKey } : t))
  const nicknames = { ...s.nicknames }
  if (r.nicknameBefore) nicknames[r.toKey] = r.nicknameBefore
  else delete nicknames[r.toKey]
  if (r.fromNickname) nicknames[r.fromKey] = r.fromNickname
  return { txs, rules: s.rules, nicknames }
}

/** The person a key belongs to after every merge (B into A, then A into C gives C). Stops on a loop. */
export function resolveKey(key: string, merges: PersonMerge[]): string {
  const seen = new Set([key])
  for (;;) {
    const m = merges.find((x) => x.fromKey === key)
    if (!m || seen.has(m.toKey)) return key
    key = m.toKey
    seen.add(key)
  }
}

// ---- Categories ------------------------------------------------------------------------

export type CategoryState = { txs: PTx[]; rules: CategoryRule[]; categories: Category[] }

/**
 * Moves every payment and rule of category `fromId` to `toId` and removes `fromId`. How each payment got
 * its category (catSource) is kept. Null when it cannot be done: a built-in category (the scan files
 * payments into it by type), a missing category, or the same one twice.
 */
export function mergeCategories(s: CategoryState, fromId: string, toId: string): CategoryState | null {
  const from = s.categories.find((c) => c.id === fromId)
  if (!from || from.builtIn || fromId === toId || !s.categories.some((c) => c.id === toId)) return null
  return {
    txs: s.txs.map((t) => (t.categoryId === fromId ? { ...t, categoryId: toId } : t)),
    rules: s.rules.map((r) => (r.categoryId === fromId ? { ...r, categoryId: toId } : r)),
    categories: s.categories.filter((c) => c.id !== fromId),
  }
}
