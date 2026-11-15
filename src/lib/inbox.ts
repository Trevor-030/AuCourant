import type { Group, Merge, Suggestion, Tx, Unread } from './data'
import { toIso } from './format'
import { KIND_DIRECTION, personKeyOf, type PTx, type TxKind } from './personal-data'
import type { ParsedSms, ParsedType, RawSms } from '../native'

/**
 * Real messages: turns what the Java parser read (SmsNative.readInbox + SmsNative.parse) into
 * the payments, groups and review items the screens show.
 *
 * Everything here is pure and in memory. It applies the grouping rules in architecture.md
 * (match key, built-in pairs, code book, suggest and confirm) until Room storage takes over.
 * It never imports React Native, so `npm run test:inbox` can run it with plain Node.
 */

export type InboxRow = { sms: RawSms; parsed: ParsedSms }
export type CodeName = { code: string; name: string }
export type ChurchData = {
  txs: Tx[]
  groups: Group[]
  merges: Merge[]
  suggestions: Suggestion[]
  unread: Unread[]
  /** Code book: number code to group id. */
  codes: Record<string, string>
}

export const NO_REFERENCE = 'noref'

/** Church only: wordings that count as another group at once (architecture.md, grouping rule 3). */
const BUILT_IN_PAIRS: Record<string, string> = { offertory: 'Offering', tithes: 'Tithe' }

/** Similar names at or above this score are suggested as a merge. Tune with real references (spike 3). */
const SUGGEST_AT = 0.8

// ---- Small helpers ----------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

/** Phone time of the message, as the date and time strings the screens use. */
export function stamp(millis: number) {
  const d = new Date(millis)
  return { date: toIso(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

/** "KOFI BOATENG" becomes "Kofi Boateng". MTN writes names in capitals; other wording is kept. */
export function titleCase(name: string) {
  const n = name.trim().replace(/\s+/g, ' ')
  if (n !== n.toUpperCase()) return n
  return n.toLowerCase().replace(/(^|[\s\-'.])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** "0241234567" and "233241234567" become "024 123 4567". Other shapes are kept as written. */
export function formatPhone(number: string) {
  let d = number.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('233')) d = '0' + d.slice(3)
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : number.trim()
}

/** Lower case, punctuation removed, single spaces. Two references with the same key are one group. */
export function matchKey(reference: string) {
  return reference
    .toLowerCase()
    .replace(/[.,;:!?'"`()[\]{}\-_/\\*&@#+=<>|~^%$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function levenshtein(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

/** True for spacing differences ("Thanks giving") and near spellings ("Havest"). Never joins by itself. */
export function similarNames(a: string, b: string) {
  const x = matchKey(a).replace(/\s/g, '')
  const y = matchKey(b).replace(/\s/g, '')
  if (!x || !y) return false
  if (x === y) return true
  if (Math.min(x.length, y.length) < 4) return false
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length) >= SUGGEST_AT
}

/**
 * The transaction ID is the unique key, so reading the same message twice does nothing.
 * A reversal quotes the ID of the payment it reverses, so it gets its own key.
 */
function rowKey(r: InboxRow) {
  if (!r.parsed.txId) return 's:' + r.sms.id
  return (r.parsed.type === 'REVERSAL' ? 'r:' : 't:') + r.parsed.txId
}

/** Oldest first, one row per transaction. */
function ordered(rows: InboxRow[]) {
  const seen = new Set<string>()
  const out: InboxRow[] = []
  for (const r of [...rows].sort((a, b) => a.sms.date - b.sms.date)) {
    const k = rowKey(r)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

const newestFirst = <T extends { date: string; time: string }>(list: T[]) =>
  list.sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))

// ---- Not read ---------------------------------------------------------------------

/** Messages no template could read, or with the amount missing. Kept with their text, never dropped. */
export function unreadOf(rows: InboxRow[]): Unread[] {
  return newestFirst(rows.filter((r) => r.parsed.status !== 'PARSED').map((r) => ({ id: 'u:' + r.sms.id, raw: r.sms.body, ...stamp(r.sms.date) })))
}

// ---- Church and organisation ------------------------------------------------------

/** A church with no payments yet: the system group, plus the numbers named at first run. */
export function emptyChurch(codeNames: CodeName[] = []): ChurchData {
  const data: ChurchData = { txs: [], groups: [{ id: NO_REFERENCE, name: 'No reference', system: true }], merges: [], suggestions: [], unread: [], codes: {} }
  for (const { code, name } of codeNames) {
    const key = matchKey(name)
    if (!key) continue
    let g = data.groups.find((x) => !x.system && matchKey(x.name) === key)
    if (!g) {
      g = { id: 'g:' + key, name: name.trim() }
      data.groups.push(g)
    }
    data.codes[String(Number(code))] = g.id
  }
  return data
}

/**
 * Adds received payments to the groups. Rows already present are skipped, so a rescan only adds
 * what is new, and everything the treasurer did (renames, merges, moved payments) stays.
 *
 * Only "Payment received" messages are church payments: they carry the Reference field.
 */
export function addChurchRows(prev: ChurchData, rows: InboxRow[], opts: { builtInPairs: boolean }): ChurchData & { added: number } {
  const groups = prev.groups.map((g) => ({ ...g }))
  const merges = prev.merges.map((m) => ({ ...m, txIds: [...m.txIds] }))
  const codes = { ...prev.codes }
  const txs = [...prev.txs]
  const have = new Set(txs.map((t) => t.id))
  const haveUnread = new Set(prev.unread.map((u) => u.id))
  const created: string[] = []

  const find = (id: string) => groups.find((g) => g.id === id)
  const named = (name: string) => {
    const key = matchKey(name)
    let g = find('g:' + key) ?? groups.find((x) => !x.system && !x.code && !x.hidden && matchKey(x.name) === key)
    if (!g) {
      g = { id: 'g:' + key, name: capital(name.trim()) }
      groups.push(g)
      created.push(g.id)
    }
    return g
  }

  /** A merged (hidden) group passes its payments on, and the merge remembers them for Undo. */
  const settle = (start: Group, txId: string) => {
    let g = start
    for (let hops = 0; g.hidden && hops < 10; hops++) {
      const m = merges.find((x) => x.sourceId === g.id)
      const target = m && find(m.targetId)
      if (!m || !target) {
        g.hidden = false
        break
      }
      m.txIds.push(txId)
      g = target
    }
    return g.id
  }

  const groupFor = (p: ParsedSms, txId: string): string => {
    if (p.referenceKind === 'NONE' || !p.reference) return NO_REFERENCE
    if (p.referenceKind === 'CODE') {
      const known = codes[p.reference] ? find(codes[p.reference]) : undefined
      if (known) return settle(known, txId)
      const id = 'code-' + p.reference
      if (!find(id)) groups.push({ id, name: 'Code ' + p.reference, code: p.reference })
      return id
    }
    const key = matchKey(p.reference)
    if (!key) return NO_REFERENCE
    let g = find('g:' + key) ?? groups.find((x) => !x.system && !x.code && !x.hidden && matchKey(x.name) === key)
    if (!g && opts.builtInPairs && BUILT_IN_PAIRS[key]) {
      const target = named(BUILT_IN_PAIRS[key])
      g = { id: 'g:' + key, name: capital(p.reference), hidden: true }
      groups.push(g)
      merges.push({ id: 'm:' + key, sourceId: g.id, targetId: target.id, txIds: [], date: '', builtIn: true })
    }
    return settle(g ?? named(p.reference), txId)
  }

  let added = 0
  for (const r of ordered(rows)) {
    const p = r.parsed
    if (p.type !== 'RECEIVED' || p.status !== 'PARSED' || p.amount == null) continue
    const id = rowKey(r)
    if (have.has(id)) continue
    have.add(id)
    const phone = p.counterpartyNumber ? formatPhone(p.counterpartyNumber) : ''
    txs.push({
      id,
      sender: p.counterpartyName ? titleCase(p.counterpartyName) : phone || 'Unknown sender',
      phone,
      amount: p.amount,
      fee: p.fee ?? 0,
      groupId: groupFor(p, id),
      reference: p.referenceKind === 'NONE' ? null : p.reference,
      ...stamp(r.sms.date),
      txId: p.txId ?? '',
      raw: r.sms.body,
    })
    added++
  }

  // Suggest and confirm: only pairs with a group that is new in this pass, so a pair the
  // treasurer kept separate is not asked about again.
  const count = (id: string) => txs.filter((t) => t.groupId === id).length
  const open = groups.filter((g) => !g.system && !g.code && !g.hidden)
  const suggestions = [...prev.suggestions]
  const paired = new Set(suggestions.map((s) => [s.keepId, s.mergeId].sort().join('|')))
  for (const id of created) {
    const a = find(id)
    if (!a || a.hidden) continue
    for (const b of open) {
      const pair = [a.id, b.id].sort().join('|')
      if (b.id === a.id || paired.has(pair) || !similarNames(a.name, b.name)) continue
      paired.add(pair)
      // Keep the one with more payments; on a tie, the one that was there first.
      const [keep, merge] = count(a.id) > count(b.id) ? [a, b] : [b, a]
      suggestions.push({ id: `s:${keep.id}|${merge.id}`, keepId: keep.id, mergeId: merge.id })
    }
  }

  const unread = [...unreadOf(rows).filter((u) => !haveUnread.has(u.id)), ...prev.unread]
  return { txs: newestFirst(txs), groups, merges, suggestions, unread, codes, added }
}

// ---- Personal or business ---------------------------------------------------------

const KIND: Record<Exclude<ParsedType, 'UNREAD'>, TxKind> = {
  RECEIVED: 'received',
  CASH_IN: 'cash-in',
  REVERSAL: 'reversal',
  SENT: 'sent',
  MERCHANT: 'merchant',
  BILL: 'bill',
  CASH_OUT: 'cash-out',
  AIRTIME: 'airtime',
}

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Every payment the parser read, with its direction, uncategorised. Run `categoriseAll` over
 * the result. The fee is the MoMo fee plus any tax charged on the payment.
 */
export function toPersonalTxs(rows: InboxRow[]): PTx[] {
  const out: PTx[] = []
  const byTxId = new Map<string, PTx>()
  for (const r of ordered(rows)) {
    const p = r.parsed
    if (p.type === 'UNREAD' || p.status !== 'PARSED' || p.amount == null) continue
    const kind = KIND[p.type]
    let name: string
    let phone = p.counterpartyNumber ? formatPhone(p.counterpartyNumber) : null
    let personKey: string
    let reference = p.referenceKind === 'NONE' ? null : p.reference
    if (kind === 'airtime') {
      // The user's own top-ups are one "person", not the number that was topped up.
      name = /data bundle/i.test(r.sms.body) ? 'Data bundle' : 'Airtime'
      personKey = 'm:airtime'
      reference = null
    } else if (kind === 'merchant' || kind === 'bill') {
      name = (p.merchant ?? p.counterpartyName ?? '').trim() || (kind === 'bill' ? 'Bill payment' : 'Shop payment')
      phone = null
      personKey = personKeyOf(null, name)
    } else if (kind === 'reversal') {
      // The message only quotes the reversed payment's ID; take the person from that payment.
      const original = p.txId ? byTxId.get(p.txId) : undefined
      name = original?.name ?? 'Reversal'
      phone = original?.phone ?? null
      personKey = original?.personKey ?? 'm:reversal'
    } else {
      name = p.counterpartyName ? titleCase(p.counterpartyName) : (phone ?? 'Unknown')
      personKey = personKeyOf(phone, name)
    }
    const tx: PTx = {
      id: rowKey(r),
      kind,
      direction: KIND_DIRECTION[kind],
      amount: p.amount,
      fee: cents((p.fee ?? 0) + (p.tax ?? 0)),
      balance: p.balance,
      name,
      phone,
      personKey,
      reference,
      ...stamp(r.sms.date),
      txId: p.txId ?? '',
      raw: r.sms.body,
      categoryId: null,
      catSource: null,
    }
    if (kind !== 'reversal' && tx.txId) byTxId.set(tx.txId, tx)
    out.push(tx)
  }
  // Some messages (cash in) give only a number. Use the name another message gave for it.
  const names = new Map<string, string>()
  for (const t of out) if (t.phone && t.name !== t.phone) names.set(t.personKey, t.name)
  for (const t of out) if (t.phone && t.name === t.phone) t.name = names.get(t.personKey) ?? t.name
  return newestFirst(out)
}
