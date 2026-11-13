import { amount2, fromMin, toMin } from './format'

/** `code` marks a holding group for an unnamed number reference, like Code 5. */
export type Group = { id: string; name: string; system?: boolean; hidden?: boolean; code?: string }

export type Tx = {
  id: string
  sender: string
  phone: string
  amount: number
  fee: number
  groupId: string
  reference: string | null
  date: string
  time: string
  txId: string
  raw: string
}

export type Special = { id: string; name: string; date: string; start: string; end: string }
export type Weekly = { day: number; start: string; end: string }

export type Merge = {
  id: string
  sourceId: string
  targetId: string
  txIds: string[]
  date: string
  builtIn?: boolean
  /** Set when an unnamed number code was named into the target group. */
  code?: string
  /** A group made just for this naming, removed again on undo. */
  createdGroupId?: string
}

export type Suggestion = { id: string; keepId: string; mergeId: string }
export type Unread = { id: string; raw: string; date: string; time: string }

// Fake people and numbers only (055 555 01xx style reserved-looking numbers).
const SENDERS: [string, string][] = [
  ['Akosua Mensah', '024 555 0134'],
  ['Kofi Boateng', '054 555 0172'],
  ['Ama Owusu', '020 555 0118'],
  ['Yaw Darko', '024 555 0190'],
  ['Efua Quaye', '055 555 0146'],
  ['Kwame Asante', '027 555 0163'],
  ['Abena Sarpong', '024 555 0127'],
  ['Kojo Antwi', '059 555 0181'],
  ['Adwoa Frimpong', '050 555 0155'],
  ['Nana Yeboah', '026 555 0139'],
  ['Esi Addo', '054 555 0108'],
  ['Kwabena Ofori', '024 555 0177'],
  ['Afua Agyeman', '020 555 0152'],
]
const LONG_SENDER: [string, string] = ['Nana Akua Adomaa Oforiwaa-Boatemaa Asantewaa', '024 555 0199']

const REFS: Record<string, (string | null)[]> = {
  offering: ['Offering', 'offering', '1', 'OFFERING', 'Offertory', 'Offering', '1'],
  tithe: ['Tithe', '2', 'Tithes'],
  harvest: ['Harvest', '3'],
  thanksgiving: ['Thanksgiving', 'thanksgiving'],
  welfare: ['Welfare', 'welfare'],
  noref: [null],
  'thanks-giving': ['Thanks giving'],
  havest: ['Havest'],
  building: ['Building fund'],
  'code-5': ['5'],
}

export const SEED_GROUPS: Group[] = [
  { id: 'noref', name: 'No reference', system: true },
  { id: 'offering', name: 'Offering' },
  { id: 'tithe', name: 'Tithe' },
  { id: 'harvest', name: 'Harvest' },
  { id: 'thanksgiving', name: 'Thanksgiving' },
  { id: 'welfare', name: 'Welfare' },
  { id: 'thanks-giving', name: 'Thanks giving' },
  { id: 'havest', name: 'Havest' },
  { id: 'building', name: 'Building fund' },
  { id: 'code-5', name: 'Code 5', code: '5' },
  // Built-in wordings, already merged.
  { id: 'offertory', name: 'Offertory', hidden: true },
  { id: 'tithes', name: 'Tithes', hidden: true },
]

type Plan = { date: string; start: string; end: string; specs: [string, number[]][] }

const PLANS: Plan[] = [
  {
    // Sunday service. 38 payments, GHS 4,310.00.
    date: '2026-10-25',
    start: '07:00',
    end: '13:00',
    specs: [
      ['offering', [200, 150, 100, 250, 50, 100, 300, 120, 80, 200, 150, 100, 150, 100]],
      ['tithe', [200, 150, 100, 180, 120, 80]],
      ['harvest', [150, 100, 120, 50]],
      ['thanksgiving', [100, 50, 150, 80, 120, 60, 70, 60]],
      ['welfare', [100, 50, 50]],
      ['noref', [50, 40, 30]],
    ],
  },
  {
    // Special session the evening before.
    date: '2026-10-24',
    start: '16:00',
    end: '19:00',
    specs: [['building', [12500, 300]]],
  },
  {
    date: '2026-10-18',
    start: '07:00',
    end: '13:00',
    specs: [
      ['offering', [50, 50, 60, 40, 50, 70, 30, 50]],
      ['tithe', [50, 60, 40]],
      ['thanksgiving', [40, 30, 50, 30]],
      ['thanks-giving', [40, 50, 30]],
      ['havest', [50]],
      ['code-5', [60, 40]],
    ],
  },
]

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rawSms(tx: Omit<Tx, 'raw'>) {
  const amt = amount2(tx.amount)
  const ref = tx.reference ?? ''
  return `Payment received for GHS ${amt} from ${tx.sender.toUpperCase()} ${tx.phone.replace(/\s/g, '')}. Reference: ${ref}. Transaction ID: ${tx.txId}. Fee charged: GHS 0.00. TAX charged: GHS 0.00.`
}

export function seedTransactions(): Tx[] {
  const rand = rng(2610)
  const out: Tx[] = []
  let senderIdx = 0
  let n = 0
  for (const plan of PLANS) {
    const entries = plan.specs.flatMap(([g, amounts]) => amounts.map((a, i) => ({ g, a, i })))
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[entries[i], entries[j]] = [entries[j], entries[i]]
    }
    const s = toMin(plan.start) + 15
    const span = toMin(plan.end) - 15 - s
    entries.forEach((e, k) => {
      const time = fromMin(s + Math.floor((span * k) / entries.length) + Math.floor(rand() * 4))
      const [sender, phone] = e.a >= 10000 ? LONG_SENDER : SENDERS[senderIdx++ % SENDERS.length]
      const refs = REFS[e.g]
      const reference = refs[e.i % refs.length]
      const base = {
        id: `t${++n}`,
        sender,
        phone,
        amount: e.a,
        fee: 0,
        groupId: e.g,
        reference,
        date: plan.date,
        time,
        txId: String(48200000000 + Math.floor(rand() * 99999999)),
      }
      out.push({ ...base, raw: rawSms(base) })
    })
  }
  return out
}

export function seedMerges(txs: Tx[]): Merge[] {
  return [
    {
      id: 'm-offertory',
      sourceId: 'offertory',
      targetId: 'offering',
      txIds: txs.filter((t) => t.reference === 'Offertory').map((t) => t.id),
      date: '',
      builtIn: true,
    },
    {
      id: 'm-tithes',
      sourceId: 'tithes',
      targetId: 'tithe',
      txIds: txs.filter((t) => t.reference === 'Tithes').map((t) => t.id),
      date: '',
      builtIn: true,
    },
  ]
}

export const SEED_SUGGESTIONS: Suggestion[] = [
  { id: 's-thanks', keepId: 'thanksgiving', mergeId: 'thanks-giving' },
  { id: 's-harvest', keepId: 'harvest', mergeId: 'havest' },
]

export const SEED_UNREAD: Unread[] = [
  {
    id: 'u1',
    date: '2026-10-25',
    time: '11:52',
    raw: 'Y\'ello. Cash In of GHS50.00 recd frm 0275550163 Ref Welfare. Trxn 7741-0293-88 Bal GHS4,360.00. Thank you for using MTN MoMo.',
  },
]

/** Per-church meaning of number references. Same in every service. */
export const SEED_CODES: Record<string, string> = { '1': 'offering', '2': 'tithe', '3': 'harvest' }

export const isCode = (ref: string | null | undefined) => !!ref && /^\d{1,3}$/.test(ref.trim())

export const SEED_SPECIALS: Special[] = [
  { id: 'building-appeal', name: 'Building fund appeal', date: '2026-10-24', start: '16:00', end: '19:00' },
]

export const SEED_WEEKLY: Weekly = { day: 0, start: '07:00', end: '13:00' }

export const FIRST_RECOVERY_CODE = 'K7M2-9QXA-4TNR'

export function makeRecoveryCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${part()}-${part()}-${part()}`
}

export const EXPORT_FIELDS = [
  'Group',
  'Date',
  'Time',
  'Amount',
  'Reference',
  'Transaction ID',
  'Sender name',
  'Sender number',
] as const
export type ExportField = (typeof EXPORT_FIELDS)[number]
