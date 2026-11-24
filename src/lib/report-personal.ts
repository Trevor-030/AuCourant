import { money, shortDate } from './format'
import { totalsOf, type PExportField } from './personal'
import { KIND_LABEL, type PTx } from './personal-data'
import { largestFirst, type Table } from './report'

type Ctx = {
  title: string
  dateLabel: string
  txs: PTx[]
  fields: PExportField[]
  categoryName: (id: string | null) => string
  personName: (key: string) => string
  /** What was given back on each payment (refundsByPayment over all payments). */
  refunds?: Map<string, number>
}

const WIDTH: Record<PExportField, number> = {
  Date: 12,
  Time: 6,
  Direction: 5,
  Type: 16,
  Amount: 11,
  Fee: 7,
  Category: 18,
  Person: 22,
  Number: 13,
  Note: 14,
  'Transaction ID': 12,
}

function cell(t: PTx, f: PExportField, c: Ctx) {
  switch (f) {
    case 'Date':
      return shortDate(t.date)
    case 'Time':
      return t.time
    case 'Direction':
      return t.direction === 'in' ? 'In' : 'Out'
    case 'Type':
      return KIND_LABEL[t.kind]
    case 'Amount':
      return t.amount.toFixed(2)
    case 'Fee':
      return t.fee.toFixed(2)
    case 'Category':
      return c.categoryName(t.categoryId)
    case 'Person':
      return c.personName(t.personKey)
    case 'Number':
      return t.phone ?? ''
    case 'Note':
      return t.reference ?? ''
    case 'Transaction ID':
      return t.txId
  }
}

/** Personal report: totals for the period (no balance), spending by category, then every payment. */
export function personalTable(c: Ctx): Table {
  const refunds = c.refunds ?? new Map<string, number>()
  const tot = totalsOf(c.txs, refunds)
  const byCat = new Map<string, { n: number; sum: number }>()
  for (const t of c.txs) {
    // Spending is what was not given back, as in the totals.
    const spent = t.direction === 'out' ? Math.max(0, t.amount - (refunds.get(t.id) ?? 0)) : 0
    if (t.direction !== 'out' || spent === 0) continue
    const name = c.categoryName(t.categoryId)
    const cur = byCat.get(name) ?? { n: 0, sum: 0 }
    byCat.set(name, { n: cur.n + 1, sum: cur.sum + spent })
  }
  return {
    summary: [
      'AuCourant report',
      `${c.title}, ${c.dateLabel}`,
      `${c.txs.length} payments. Money in ${money(tot.moneyIn)}. Money out ${money(tot.moneyOut)}. Fees paid ${money(tot.fees)}.`,
    ],
    breakdown: { title: 'Spending by category', rows: largestFirst(byCat) },
    columns: c.fields.map((f) => ({ name: f, width: WIDTH[f], right: f === 'Amount' || f === 'Fee' })),
    rows: c.txs.map((t) => c.fields.map((f) => cell(t, f, c))),
  }
}
