import type { ExportField, Tx } from './data'
import { money, shortDate } from './format'

/**
 * Builds report contents as plain strings. Writing the file and sharing it is done
 * by the Java ExportModule (see src/native/export.ts).
 */
type Ctx = {
  title: string
  dateLabel: string
  txs: Tx[]
  fields: ExportField[]
  groupName: (id: string) => string
}

function cell(t: Tx, f: ExportField, groupName: (id: string) => string) {
  switch (f) {
    case 'Group':
      return groupName(t.groupId)
    case 'Date':
      return shortDate(t.date)
    case 'Time':
      return t.time
    case 'Amount':
      return t.amount.toFixed(2)
    case 'Reference':
      // Exports show the original text: "1" stays "1", the Group column says what it means.
      return t.reference ?? ''
    case 'Transaction ID':
      return t.txId
    case 'Sender name':
      return t.sender
    case 'Sender number':
      return t.phone
  }
}

const WIDTH: Record<ExportField, number> = {
  Group: 16,
  Date: 12,
  Time: 6,
  Amount: 11,
  Reference: 15,
  'Transaction ID': 12,
  'Sender name': 26,
  'Sender number': 13,
}

function churchTable(c: Ctx): Table {
  const totals = new Map<string, { n: number; sum: number }>()
  for (const t of c.txs) {
    const g = c.groupName(t.groupId)
    const cur = totals.get(g) ?? { n: 0, sum: 0 }
    totals.set(g, { n: cur.n + 1, sum: cur.sum + t.amount })
  }
  const sum = c.txs.reduce((s, t) => s + t.amount, 0)
  return {
    summary: [
      'AuCourant report',
      `${c.title}, ${c.dateLabel}`,
      `${c.txs.length} payments, ${money(sum)}`,
      '',
      'By group',
      ...[...totals.entries()]
        .sort((a, b) => b[1].sum - a[1].sum)
        .map(([g, v]) => `  ${fit(g, 24)}${String(v.n).padStart(4)} payments ${money(v.sum).padStart(16)}`),
    ],
    columns: c.fields.map((f) => ({ name: f, width: WIDTH[f], right: f === 'Amount' })),
    rows: c.txs.map((t) => c.fields.map((f) => cell(t, f, c.groupName))),
  }
}

export const buildCsv = (c: Ctx) => tableCsv(churchTable(c))
export const buildPdf = (c: Ctx) => tablePdf(churchTable(c))

export function fileBase(c: Pick<Ctx, 'title' | 'dateLabel'>) {
  return `AuCourant ${c.title} ${c.dateLabel}`.replace(/[,]/g, '').replace(/\s+/g, '-')
}

/** A report as columns and rows. Church and Personal both build one, then write CSV or PDF. */
export type Table = {
  /** Lines printed above the table in the PDF (title, totals, breakdown). */
  summary: string[]
  columns: { name: string; width: number; right?: boolean }[]
  rows: string[][]
}

/** UTF-8 CSV with a BOM so Excel detects the encoding. */
export function tableCsv(t: Table) {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = [t.columns.map((c) => q(c.name)).join(','), ...t.rows.map((r) => r.map(q).join(','))]
  return '﻿' + rows.join('\r\n')
}

export const fit = (s: string, w: number) => (s.length > w - 1 ? s.slice(0, w - 2) + '~' : s).padEnd(w)

/**
 * A small hand-written PDF (Courier, landscape A4), ASCII only.
 * Interim: architecture.md plans Android PdfDocument in Java for the real layout.
 */
export function tablePdf(t: Table) {
  const row = (vals: string[]) => vals.map((v, i) => (t.columns[i].right ? v.padStart(t.columns[i].width - 1) + ' ' : fit(v, t.columns[i].width))).join('')
  const lines = [...t.summary, '', row(t.columns.map((c) => c.name)), '-'.repeat(t.columns.reduce((s, c) => s + c.width, 0)), ...t.rows.map(row)]
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const perPage = 34
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage))

  const objs: string[] = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'
  const kids: string[] = []
  pages.forEach((pl, i) => {
    const pageId = 4 + i * 2
    const contentId = pageId + 1
    kids.push(`${pageId} 0 R`)
    const stream = `BT /F1 9 Tf 14 TL 40 555 Td ${pl.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    objs[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`
  }
  const xref = out.length
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return out
}
