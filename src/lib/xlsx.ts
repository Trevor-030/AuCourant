import type { Table } from './report'

/**
 * A real Excel file from a report table, with no library: an .xlsx is a zip of small XML files.
 * Nothing is compressed, which keeps this short; a report is a few hundred kilobytes at most.
 *
 * Two sheets: Payments (the table) and Summary (totals). Amounts are numbers so Excel can add them
 * up. Everything else is text, so transaction IDs keep every digit and a reference such as "=1+1"
 * is never run as a formula.
 *
 * Pure: no React Native imports, so `npm run test:report` runs it under plain Node.
 */

/** @returns the file as Base64, for ExportModule.writeReport */
export function tableXlsx(t: Table): string {
  return base64(
    zip([
      ['[Content_Types].xml', CONTENT_TYPES],
      ['_rels/.rels', RELS],
      ['xl/workbook.xml', WORKBOOK],
      ['xl/_rels/workbook.xml.rels', WORKBOOK_RELS],
      ['xl/styles.xml', STYLES],
      ['xl/worksheets/sheet1.xml', paymentsSheet(t)],
      ['xl/worksheets/sheet2.xml', summarySheet(t)],
    ]),
  )
}

// ---- Sheets ----------------------------------------------------------------------

/** Cell styles in STYLES, by index. */
const BOLD = 1
const AMOUNT = 2

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006'

/** 0 is A, 25 is Z, 26 is AA. */
function column(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : column(Math.floor(i / 26) - 1) + column(i % 26)
}

/** Characters XML 1.0 cannot hold are dropped; halves of an emoji become the replacement mark. */
function escapeXml(s: string) {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 0xfffe || c === 0xffff) continue
    if (c >= 0xd800 && c <= 0xdfff) out += '�'
    else out += ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch
  }
  return out
}

function textCell(ref: string, value: string, style = 0) {
  if (!value) return ''
  return `<c r="${ref}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}
const numberCell = (ref: string, value: number, style = 0) => `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${value}</v></c>`
const row = (n: number, cells: string) => `<row r="${n}">${cells}</row>`
const isNumber = (v: string) => /^-?\d+(\.\d+)?$/.test(v)

function sheet(o: { widths: number[]; rows: string; freeze?: boolean; filter?: string }) {
  const view = o.freeze
    ? '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>'
    : '<sheetView workbookViewId="0"/>'
  const cols = o.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  return (
    `${XML}<worksheet xmlns="${MAIN}"><sheetViews>${view}</sheetViews>${cols ? `<cols>${cols}</cols>` : ''}` +
    `<sheetData>${o.rows}</sheetData>${o.filter ? `<autoFilter ref="${o.filter}"/>` : ''}</worksheet>`
  )
}

function paymentsSheet(t: Table) {
  const header = row(1, t.columns.map((c, i) => textCell(column(i) + 1, c.name, BOLD)).join(''))
  const body = t.rows.map((r, y) => {
    const n = y + 2
    return row(n, r.map((v, i) => (t.columns[i].right && isNumber(v) ? numberCell(column(i) + n, Number(v), AMOUNT) : textCell(column(i) + n, v))).join(''))
  })
  const last = column(Math.max(0, t.columns.length - 1)) + (t.rows.length + 1)
  return sheet({ widths: t.columns.map((c) => c.width + 2), rows: header + body.join(''), freeze: true, filter: `A1:${last}` })
}

function summarySheet(t: Table) {
  const rows: string[] = []
  t.summary.forEach((line, i) => rows.push(row(rows.length + 1, textCell('A' + (rows.length + 1), line, i === 0 ? BOLD : 0))))
  if (t.breakdown) {
    rows.push(row(rows.length + 1, ''))
    const h = rows.length + 1
    rows.push(row(h, textCell('A' + h, t.breakdown.title, BOLD) + textCell('B' + h, 'Payments', BOLD) + textCell('C' + h, 'Total (GHS)', BOLD)))
    for (const b of t.breakdown.rows) {
      const n = rows.length + 1
      rows.push(row(n, textCell('A' + n, b.name) + numberCell('B' + n, b.n) + numberCell('C' + n, Math.round(b.sum * 100) / 100, AMOUNT)))
    }
  }
  return sheet({ widths: [32, 12, 16], rows: rows.join('') })
}

// ---- The fixed parts -------------------------------------------------------------

const TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml'
const CONTENT_TYPES =
  `${XML}<Types xmlns="${PKG}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  `<Override PartName="/xl/workbook.xml" ContentType="${TYPE}.sheet.main+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="${TYPE}.styles+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TYPE}.worksheet+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="${TYPE}.worksheet+xml"/></Types>`
const RELS = `${XML}<Relationships xmlns="${PKG}/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
const WORKBOOK =
  `${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>` +
  '<sheet name="Payments" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets></workbook>'
const WORKBOOK_RELS =
  `${XML}<Relationships xmlns="${PKG}/relationships">` +
  `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/>` +
  `<Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/></Relationships>`
// Number format 4 is Excel's built-in "#,##0.00".
const STYLES =
  `${XML}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

// ---- Zip, stored (no compression) ------------------------------------------------

function utf8(s: string): number[] {
  const out: number[] = []
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return out
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes: number[]) {
  let c = 0xffffffff
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const u16 = (n: number) => [n & 255, (n >> 8) & 255]
const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]
/** 1 Jan 1980, the earliest date a zip can hold: the same report always gives the same file. */
const NO_TIME = [0, 0, 0x21, 0]

function zip(files: [name: string, content: string][]): Uint8Array {
  const parts: number[][] = []
  const directory: number[][] = []
  let offset = 0
  for (const [name, content] of files) {
    const nameBytes = utf8(name)
    const data = utf8(content)
    // Version 2.0, no flags, stored, time, checksum, size twice, name length, no extra field.
    const common = [...u16(20), ...u16(0), ...u16(0), ...NO_TIME, ...u32(crc32(data)), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)]
    const local = [...u32(0x04034b50), ...common, ...nameBytes]
    parts.push(local, data)
    directory.push([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes])
    offset += local.length + data.length
  }
  const size = directory.reduce((n, d) => n + d.length, 0)
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(size), ...u32(offset), ...u16(0)]
  const out = new Uint8Array(offset + size + end.length)
  let at = 0
  for (const p of [...parts, ...directory, end]) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes: Uint8Array): string {
  const out: string[] = []
  for (let i = 0; i < bytes.length; i += 3) {
    const left = bytes.length - i
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out.push(B64[n >> 18] + B64[(n >> 12) & 63] + (left > 1 ? B64[(n >> 6) & 63] : '=') + (left > 2 ? B64[n & 63] : '='))
  }
  return out.join('')
}
