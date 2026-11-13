import { amount2, addDays, fromMin, toMin } from './format'

/**
 * Personal or business: sample data and types (architecture-personal.md).
 *
 * Payments here have a direction and a category. The raw SMS text uses the same
 * wording as the Java templates in native/android/java/com/aucourant/parser, several of
 * which are provisional (no real sample yet). Fake people and numbers only.
 */

export type TxKind = 'received' | 'cash-in' | 'reversal' | 'sent' | 'merchant' | 'bill' | 'cash-out' | 'airtime'
export type Direction = 'in' | 'out'
/** How the category was set. Manual choices are never overwritten by rules. */
export type CatSource = 'type' | 'person' | 'word' | 'manual'

export const KIND_DIRECTION: Record<TxKind, Direction> = {
  received: 'in',
  'cash-in': 'in',
  reversal: 'in',
  sent: 'out',
  merchant: 'out',
  bill: 'out',
  'cash-out': 'out',
  airtime: 'out',
}

export const KIND_LABEL: Record<TxKind, string> = {
  received: 'Money received',
  'cash-in': 'Cash in',
  reversal: 'Reversal',
  sent: 'Money sent',
  merchant: 'Shop payment',
  bill: 'Bill payment',
  'cash-out': 'Cash withdrawal',
  airtime: 'Airtime or data',
}

export type PTx = {
  id: string
  kind: TxKind
  direction: Direction
  amount: number
  fee: number
  /** Balance after this payment, as written in the SMS. Shown only under More details. */
  balance: number | null
  /** The other side: a person's name, a shop or a biller. */
  name: string
  phone: string | null
  /** Groups payments by person (normalized number) or by shop name. */
  personKey: string
  reference: string | null
  date: string
  time: string
  txId: string
  raw: string
  categoryId: string | null
  catSource: CatSource | null
}

export type Category = { id: string; name: string; builtIn?: boolean; hidden?: boolean }
export type CategoryRule = { id: string; kind: 'person' | 'word'; value: string; label: string; categoryId: string }

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food', builtIn: true },
  { id: 'transport', name: 'Transport', builtIn: true },
  { id: 'airtime', name: 'Airtime and data', builtIn: true },
  { id: 'bills', name: 'Bills', builtIn: true },
  { id: 'family', name: 'Family and friends', builtIn: true },
  { id: 'savings', name: 'Savings', builtIn: true },
  { id: 'business', name: 'Business', builtIn: true },
  { id: 'cash', name: 'Cash withdrawals', builtIn: true },
  { id: 'fees', name: 'Fees', builtIn: true },
  { id: 'other', name: 'Other', builtIn: true },
]

/** Built-in type rules (architecture-personal.md, the categoriser, rule 3). */
export const TYPE_CATEGORY: Partial<Record<TxKind, string>> = { airtime: 'airtime', bill: 'bills', 'cash-out': 'cash' }

export const personKeyOf = (phone: string | null, name: string) => (phone ? phone.replace(/\D/g, '') : 'm:' + name.trim().toLowerCase())

// ---- Sample set -------------------------------------------------------------------

const P = {
  kofi: ['Kofi Boateng', '054 555 0172'],
  ama: ['Ama Owusu', '020 555 0118'],
  akosua: ['Akosua Mensah', '024 555 0134'],
  yaw: ['Yaw Darko', '024 555 0190'],
  efua: ['Efua Quaye', '055 555 0146'],
  kwame: ['Kwame Asante', '027 555 0163'],
  abena: ['Abena Sarpong', '024 555 0127'],
  long: ['Nana Akua Adomaa Oforiwaa-Boatemaa Asantewaa', '024 555 0199'],
  me: ['', '024 555 0101'],
} as const
type Who = keyof typeof P

type Plan =
  | { kind: 'received' | 'sent' | 'cash-out' | 'cash-in'; day: number; amount: number; who: Who; ref?: string | null; time?: string }
  | { kind: 'merchant' | 'bill'; day: number; amount: number; shop: string; ref?: string | null; time?: string }
  | { kind: 'airtime'; day: number; amount: number; data?: boolean; time?: string }
  | { kind: 'reversal'; day: number; of: number; time?: string }

/** Day 0 is 1 Sep 2026; TODAY (28 Oct) is day 57. */
const START = '2026-09-01'
const OPENING_BALANCE = 2400

function plans(): Plan[] {
  const out: Plan[] = []
  // Family: Kofi gets money twice a month (no rule yet, so the "Move them" flow has something to do).
  ;[3, 17, 31, 45, 52, 56].forEach((day, i) => out.push({ kind: 'sent', day, amount: [200, 150, 250, 200, 100, 300][i], who: 'kofi', ref: i % 2 ? 'chop money' : '-' }))
  // Ama already has a person rule (Family).
  ;[9, 38].forEach((day) => out.push({ kind: 'sent', day, amount: 120, who: 'ama', ref: 'school fees' }))
  // Shop sales: customers paying in most days.
  const buyers: Who[] = ['akosua', 'yaw', 'efua', 'abena', 'akosua', 'yaw', 'akosua']
  for (let day = 1; day <= 57; day += 2) out.push({ kind: 'received', day, amount: [35, 60, 120, 45, 80, 25, 150][day % 7], who: buyers[day % buyers.length], ref: day % 7 === 3 ? null : 'goods' })
  out.push({ kind: 'received', day: 40, amount: 1250, who: 'long', ref: 'bulk order' })
  // Groceries and fuel, caught by word rules.
  ;[2, 8, 15, 22, 29, 36, 43, 50, 55].forEach((day, i) => out.push({ kind: 'merchant', day, amount: [85.5, 42, 120, 64.5, 98, 51, 133.2, 76, 45.5][i], shop: 'KASOA FRESH MART', ref: 'groceries' }))
  ;[5, 19, 33, 47, 54].forEach((day, i) => out.push({ kind: 'merchant', day, amount: [150, 120, 200, 150, 100][i], shop: 'GOIL WEIJA', ref: 'fuel' }))
  // A shop with no rule: stays Uncategorised until the user decides.
  ;[12, 41, 53].forEach((day, i) => out.push({ kind: 'merchant', day, amount: [230, 65, 48][i], shop: 'MELCOM ACCRA MALL', ref: null }))
  // Bills, airtime and cash out: caught by built-in type rules.
  ;[4, 35].forEach((day) => out.push({ kind: 'bill', day, amount: 150, shop: 'ECG PREPAID' }))
  ;[6, 36].forEach((day) => out.push({ kind: 'bill', day, amount: 99, shop: 'DSTV GHANA' }))
  for (let day = 0; day <= 56; day += 7) out.push({ kind: 'airtime', day, amount: day % 14 ? 10 : 20, data: day % 14 === 0 })
  ;[10, 24, 39, 51].forEach((day, i) => out.push({ kind: 'cash-out', day, amount: [300, 200, 500, 250][i], who: 'kwame' }))
  // Cash in at an agent, and a payment sent by mistake then reversed.
  out.push({ kind: 'cash-in', day: 26, amount: 400, who: 'kwame', ref: null })
  out.push({ kind: 'sent', day: 48, amount: 80, who: 'abena', ref: '-', time: '13:05' })
  out.push({ kind: 'reversal', day: 48, of: out.length - 1, time: '15:40' })
  // A payment to a new person today: Uncategorised.
  out.push({ kind: 'sent', day: 57, amount: 60, who: 'efua', ref: 'transport', time: '08:14' })
  return out
}

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** MoMo send fee: 1%, capped. Cash out: 1%, at least GHS 1. */
const feeFor = (kind: TxKind, amount: number) =>
  kind === 'sent' ? Math.min(Math.round(amount) / 100, 10) : kind === 'cash-out' ? Math.max(1, Math.round(amount) / 100) : 0

const ghs = (n: number) => 'GHS ' + amount2(n)
const bare = (phone: string | null) => (phone ?? '').replace(/\s/g, '')

/** Same wording as the Java templates (provisional except received and cash in). */
function rawSms(t: Omit<PTx, 'raw' | 'categoryId' | 'catSource'>, reversedTxId?: string) {
  const bal = t.balance == null ? '' : ` Current Balance: ${ghs(t.balance)}.`
  const fee = ` Fee charged: ${ghs(t.fee)}. TAX charged: GHS 0.00.`
  const ref = t.reference ?? ''
  switch (t.kind) {
    case 'received':
      return `Payment received for ${ghs(t.amount)} from ${t.name.toUpperCase()} ${bare(t.phone)}.${bal} Reference: ${ref}. Transaction ID: ${t.txId}.${fee}`
    case 'cash-in':
      return `Y'ello. Cash In of GHS${amount2(t.amount)} recd frm ${bare(t.phone)} Ref ${ref || '-'}. Trxn ${t.txId} Bal GHS${amount2(t.balance ?? 0)}. Thank you for using MTN MoMo.`
    case 'sent':
      return `Payment made for ${ghs(t.amount)} to ${t.name.toUpperCase()} ${bare(t.phone)}.${bal} Reference: ${ref || '-'}. Transaction ID: ${t.txId}.${fee}`
    case 'merchant':
      return `Payment of ${ghs(t.amount)} to merchant ${t.name} has been completed.${bal} Reference: ${ref}. Transaction ID: ${t.txId}. Fee charged: GHS 0.00.`
    case 'bill':
      return `Your bill payment of ${ghs(t.amount)} to ${t.name} was successful.${bal} Transaction ID: ${t.txId}. Fee charged: GHS 0.00.`
    case 'cash-out':
      return `Cash Out made for ${ghs(t.amount)} to ${t.name.toUpperCase()} ${bare(t.phone)}.${bal} Transaction ID: ${t.txId}.${fee}`
    case 'airtime':
      return t.reference === 'data'
        ? `You have bought a data bundle of ${ghs(t.amount)} for ${bare(t.phone)}.${bal} Transaction ID: ${t.txId}.`
        : `You have bought ${ghs(t.amount)} airtime for ${bare(t.phone)}.${bal} Transaction ID: ${t.txId}.`
    case 'reversal':
      return `Reversal of ${ghs(t.amount)} for Transaction ID ${reversedTxId} has been credited to your wallet.${bal}`
  }
}

/** Uncategorised payments. Run `categoriseAll` over them with the seed rules. */
export function seedPersonalTxs(): PTx[] {
  const rand = rng(1609)
  const list = plans()
  // Spread the day's payments through waking hours, in a stable order.
  const timed = list.map((p, i) => ({ p, i, time: p.time ?? fromMin(toMin('07:30') + Math.floor(rand() * 13 * 60)) }))
  timed.sort((a, b) => a.p.day - b.p.day || a.time.localeCompare(b.time))
  let balance = OPENING_BALANCE
  const byPlan = new Map<number, PTx>()
  const out: PTx[] = []
  timed.forEach(({ p, i, time }, n) => {
    const txId = String(48300000000 + Math.floor(rand() * 99999999))
    let name: string
    let phone: string | null
    let amount: number
    let reference: string | null = null
    let reversedTxId: string | undefined
    if (p.kind === 'merchant' || p.kind === 'bill') {
      name = p.shop
      phone = null
      amount = p.amount
      reference = p.ref ?? null
    } else if (p.kind === 'airtime') {
      name = p.data ? 'Data bundle' : 'Airtime'
      phone = P.me[1]
      amount = p.amount
      reference = p.data ? 'data' : null
    } else if (p.kind === 'reversal') {
      const orig = byPlan.get(p.of)!
      name = orig.name
      phone = orig.phone
      amount = orig.amount
      reversedTxId = orig.txId
    } else if ('who' in p) {
      ;[name, phone] = P[p.who]
      amount = p.amount
      reference = p.ref === '-' ? null : (p.ref ?? null)
    } else throw new Error('unreachable')
    const fee = feeFor(p.kind, amount)
    const direction = KIND_DIRECTION[p.kind]
    balance = Math.round((direction === 'in' ? balance + amount : balance - amount - fee) * 100) / 100
    const base = {
      id: `p${n + 1}`,
      kind: p.kind,
      direction,
      amount,
      fee,
      balance,
      name,
      phone,
      // Own airtime and data top-ups are one "person", not the user's own number.
      personKey: p.kind === 'airtime' ? 'm:airtime' : personKeyOf(phone, name),
      reference: p.kind === 'airtime' ? null : reference,
      date: addDays(START, p.day),
      time,
      txId,
    }
    const tx: PTx = { ...base, raw: rawSms({ ...base, reference }, reversedTxId), categoryId: null, catSource: null }
    byPlan.set(i, tx)
    out.push(tx)
  })
  return out
}

/** As if the user had already confirmed a few rules in an earlier month. */
export const SEED_RULES: CategoryRule[] = [
  { id: 'r-ama', kind: 'person', value: personKeyOf(P.ama[1], P.ama[0]), label: P.ama[0], categoryId: 'family' },
  { id: 'r-fresh', kind: 'word', value: 'fresh mart', label: 'fresh mart', categoryId: 'food' },
  { id: 'r-fuel', kind: 'word', value: 'fuel', label: 'fuel', categoryId: 'transport' },
  { id: 'r-goods', kind: 'word', value: 'goods', label: 'goods', categoryId: 'business' },
]
