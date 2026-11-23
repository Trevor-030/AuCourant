/**
 * Checks the report builders (src/lib/report.ts, xlsx.ts) with plain Node.
 * The .xlsx is unzipped here by hand: every entry's checksum, offsets and XML are checked.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(outputText, filename)
}

const lib = (f) => require(path.join(__dirname, '..', 'src', 'lib', f))
const { buildCsv, buildPdf, buildXlsx } = lib('report.ts')
const { tableXlsx } = lib('xlsx.ts')

let passed = 0
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`)
}

/** Reads a zip through its central directory, the way Excel does. */
function unzip(buf) {
  const end = buf.length - 22
  if (buf.readUInt32LE(end) !== 0x06054b50) throw new Error('no end record')
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  check('zip: directory size', buf.readUInt32LE(end + 12), end - at)
  const files = {}
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('bad directory entry')
    const crc = buf.readUInt32LE(at + 16)
    const size = buf.readUInt32LE(at + 24)
    const nameLen = buf.readUInt16LE(at + 28)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('latin1', at + 46, at + 46 + nameLen)
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('bad local header for ' + name)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + size)
    check(`zip: checksum of ${name}`, zlib.crc32(data), crc)
    check(`zip: local checksum of ${name}`, buf.readUInt32LE(local + 14), crc)
    files[name] = data.toString('utf8')
    at += 46 + nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32)
  }
  return files
}
const open = (b64) => unzip(Buffer.from(b64, 'base64'))

const tx = (o) => ({ id: 't:1', sender: 'Esi Addo', phone: '024 555 0108', amount: 1250.5, fee: 0, groupId: 'g1', reference: 'offering', date: '2026-10-25', time: '09:05', txId: '48200000001', ...o })
const ctx = {
  title: 'Sunday service',
  dateLabel: 'Sunday, 25 Oct 2026',
  txs: [tx({}), tx({ id: 't:2', sender: 'Kofi & Sons <Ltd>', amount: 20, reference: '=1+1', txId: '048200000002' }), tx({ id: 't:3', sender: 'Abla D\u025b\u0301 \ud83d\ude4f', amount: 5, groupId: 'g2', reference: null })],
  fields: ['Group', 'Date', 'Amount', 'Reference', 'Transaction ID', 'Sender name'],
  groupName: (id) => ({ g1: 'Offering', g2: 'No reference' })[id],
}

const files = open(buildXlsx(ctx))
check('xlsx: parts', Object.keys(files).sort(), [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
  'xl/workbook.xml',
  'xl/worksheets/sheet1.xml',
  'xl/worksheets/sheet2.xml',
])
const sheet = files['xl/worksheets/sheet1.xml']
const text = (ref, value, style = '') => `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`
check('xlsx: header row', sheet.includes(text('A1', 'Group', ' s="1"')), true)
check('xlsx: amounts are numbers', sheet.includes('<c r="C2" s="2"><v>1250.5</v></c>'), true)
check('xlsx: a long transaction ID stays text, with its leading zero', sheet.includes(text('E3', '048200000002')), true)
check('xlsx: text that looks like a formula stays text', sheet.includes(text('D3', '=1+1')), true)
check('xlsx: no formulas', /<f[ >]/.test(sheet), false)
check('xlsx: special characters are escaped', sheet.includes('Kofi &amp; Sons &lt;Ltd&gt;'), true)
check('xlsx: letters outside ASCII and emoji survive', sheet.includes('Abla D\u025b\u0301 \ud83d\ude4f'), true)
check('xlsx: an empty reference is an empty cell', sheet.includes('r="D4"'), false)
check('xlsx: header stays on screen', sheet.includes('state="frozen"'), true)
check('xlsx: filter covers the table', sheet.includes('<autoFilter ref="A1:F4"/>'), true)
check('xlsx: sheet names', [...files['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]), ['Payments', 'Summary'])
const summary = files['xl/worksheets/sheet2.xml']
check('xlsx: summary has the group count and total as numbers', /Offering<\/t><\/is><\/c><c r="B\d+"><v>2<\/v><\/c><c r="C\d+" s="2"><v>1270.5<\/v><\/c>/.test(summary), true)
check('xlsx: summary starts with the report title', summary.includes(text('A1', 'AuCourant report', ' s="1"')), true)

const odd = open(tableXlsx({ summary: [], columns: [{ name: 'A', width: 5 }], rows: [['x\u0000\u0007y\ud800z']] }))
check('xlsx: characters XML cannot hold are dropped or replaced', odd['xl/worksheets/sheet1.xml'].includes('>xy\ufffdz<'), true)
const wide = open(tableXlsx({ summary: [], columns: Array.from({ length: 28 }, (_, i) => ({ name: 'c' + i, width: 5 })), rows: [] }))
check('xlsx: columns past Z', wide['xl/worksheets/sheet1.xml'].includes('r="AB1"'), true)
const mixed = open(tableXlsx({ summary: [], columns: [{ name: 'Amount', width: 5, right: true }], rows: [['n/a']] }))
check('xlsx: a number column with text in it stays text', mixed['xl/worksheets/sheet1.xml'].includes('>n/a<'), true)

// The other formats are unchanged.
check('csv: rows', buildCsv(ctx).split('\r\n')[1], 'Offering,25 Oct 2026,1250.50,offering,48200000001,Esi Addo')
const pdf = buildPdf(ctx)
check('pdf: totals line', pdf.includes('(3 payments, GHS 1,275.50) Tj'), true)
check('pdf: group heading', pdf.includes('(By group) Tj'), true)
check('pdf: group line', pdf.includes('(  Offering                   2 payments     GHS 1,270.50) Tj'), true)

for (const f of failures) console.error('FAIL ' + f)
console.log(`${passed} passed, ${failures.length} failed`)
if (failures.length) process.exitCode = 1
