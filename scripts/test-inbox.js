/**
 * Checks the real-message path end to end without a phone or Gradle:
 *
 *   sample payments -> their raw SMS text -> the Java MTN parser (plain JDK) -> src/lib/inbox.ts
 *
 * and expects the same payments, groups, suggestions and categories the sample data has.
 * The TypeScript is run straight from src/ with the project's own typescript package.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(outputText, filename)
}

const root = path.join(__dirname, '..')
const lib = (name) => require(path.join(root, 'src', 'lib', name + '.ts'))
const { seedTransactions, SEED_GROUPS, SEED_CODES } = lib('data')
const { seedPersonalTxs, SEED_RULES } = lib('personal-data')
const { categoriseAll } = lib('categorise')
const { addChurchRows, emptyChurch, toPersonalTxs, matchKey, similarNames, titleCase, formatPhone } = lib('inbox')

// ---- Java parser over raw text ----------------------------------------------------

const candidates = [process.env.JAVA_HOME, 'C:\\Program Files\\Android\\Android Studio\\jbr'].filter(Boolean)
const home = candidates.find((h) => fs.existsSync(path.join(h, 'bin')))
const bin = (tool) => (home ? path.join(home, 'bin', tool) : tool)
const javaFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? javaFiles(path.join(dir, e.name)) : e.name.endsWith('.java') ? [path.join(dir, e.name)] : []))

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aucourant-inbox-'))
let compiled = false
function parseAll(bodies) {
  if (!compiled) {
    const sources = [...javaFiles(path.join(root, 'native/android/java/com/aucourant/parser')), path.join(root, 'native/android/test/com/aucourant/parser/ParseDump.java')]
    execFileSync(bin('javac'), ['-d', tmp, ...sources], { stdio: 'inherit' })
    compiled = true
  }
  const file = path.join(tmp, 'bodies.txt')
  fs.writeFileSync(file, bodies.map((b) => b.replace(/\r?\n/g, ' ')).join('\n'), 'utf8')
  return JSON.parse(execFileSync(bin('java'), ['-cp', tmp, 'com.aucourant.parser.ParseDump', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
}

const millis = (date, time) => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}

let smsId = 0
/** What the phone would hand over: SmsNative.readInbox rows joined with SmsNative.parse results. */
function rowsOf(messages) {
  const parsed = parseAll(messages.map((m) => m.raw))
  return messages.map((m, i) => ({ sms: { id: String(++smsId), address: 'MobileMoney', body: m.raw, date: millis(m.date, m.time) }, parsed: parsed[i] }))
}

// ---- Tiny assert kit --------------------------------------------------------------

let passed = 0
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`)
}

try {
  // ---- Helpers --------------------------------------------------------------------
  check('titleCase capitals', titleCase('KOFI BOATENG'), 'Kofi Boateng')
  check('titleCase hyphen', titleCase('NANA OFORIWAA-BOATEMAA'), 'Nana Oforiwaa-Boatemaa')
  check('titleCase leaves mixed case', titleCase('Kasoa Fresh Mart'), 'Kasoa Fresh Mart')
  check('formatPhone local', formatPhone('0241234567'), '024 123 4567')
  check('formatPhone 233', formatPhone('233241234567'), '024 123 4567')
  check('formatPhone +233', formatPhone('+233241234567'), '024 123 4567')
  check('matchKey case and full stop', matchKey('OFFERING.'), 'offering')
  check('matchKey spaces', matchKey('  Building   fund '), 'building fund')
  check('similar spacing', similarNames('Thanksgiving', 'Thanks giving'), true)
  check('similar spelling', similarNames('Harvest', 'Havest'), true)
  check('not similar', similarNames('Offering', 'Welfare'), false)
  check('short words are not suggested', similarNames('Dues', 'Due'), false)

  // ---- Church: the sample service comes back as the same groups -------------------
  const seed = seedTransactions()
  const churchRows = rowsOf(seed)
  const seedName = (id) => SEED_GROUPS.find((g) => g.id === id).name
  const codeNames = Object.entries(SEED_CODES).map(([code, id]) => ({ code, name: seedName(id) }))
  const church = addChurchRows(emptyChurch(codeNames), churchRows, { builtInPairs: true })
  const nameOf = (data, id) => data.groups.find((g) => g.id === id)?.name ?? '(missing group ' + id + ')'

  check('church: every payment read', church.txs.length, seed.length)
  check('church: added count', church.added, seed.length)
  check('church: nothing left unread', church.unread.length, 0)
  for (const s of seed) {
    const t = church.txs.find((x) => x.txId === s.txId)
    if (!t) {
      failures.push(`church: payment ${s.txId} (${s.reference}) is missing`)
      continue
    }
    check(
      `church payment ${s.txId} (${s.reference})`,
      { sender: t.sender, phone: t.phone, amount: t.amount, fee: t.fee, reference: t.reference, date: t.date, time: t.time, group: matchKey(nameOf(church, t.groupId)) },
      { sender: s.sender, phone: s.phone, amount: s.amount, fee: s.fee, reference: s.reference, date: s.date, time: s.time, group: matchKey(seedName(s.groupId)) },
    )
  }
  check(
    'church: visible groups',
    church.groups.filter((g) => !g.hidden).map((g) => matchKey(g.name)).sort(),
    SEED_GROUPS.filter((g) => !g.hidden).map((g) => matchKey(g.name)).sort(),
  )
  check(
    'church: built-in joins',
    church.merges.map((m) => `${matchKey(nameOf(church, m.sourceId))}>${matchKey(nameOf(church, m.targetId))}:${m.txIds.length}:${!!m.builtIn}`).sort(),
    [`offertory>offering:${seed.filter((t) => t.reference === 'Offertory').length}:true`, `tithes>tithe:${seed.filter((t) => t.reference === 'Tithes').length}:true`],
  )
  check(
    'church: merge suggestions',
    church.suggestions.map((s) => `${matchKey(nameOf(church, s.keepId))}<${matchKey(nameOf(church, s.mergeId))}`).sort(),
    ['harvest<havest', 'thanksgiving<thanks giving'],
  )
  check('church: code book', Object.fromEntries(Object.entries(church.codes).map(([c, id]) => [c, matchKey(nameOf(church, id))])), { 1: 'offering', 2: 'tithe', 3: 'harvest' })
  check('church: unnamed code waits in its own group', church.groups.find((g) => g.code === '5')?.name, 'Code 5')

  // ---- Church: scanning again adds only what is new -------------------------------
  const again = addChurchRows(church, churchRows, { builtInPairs: true })
  check('rescan: no duplicates', [again.txs.length, again.added, again.suggestions.length, again.merges.length], [seed.length, 0, 2, 2])

  const extra = (reference, txId, amount = 20) => ({
    raw: `Payment received for GHS ${amount}.00 from ESI ADDO 0545550108. Reference: ${reference}. Transaction ID: ${txId}. Fee charged: GHS 0.00. TAX charged: GHS 0.00.`,
    date: '2026-10-28',
    time: '09:00',
  })
  // Reads as an airtime message with no amount (partial), and as nothing at all: both are kept.
  const partial = { raw: 'Y\'ello! Get 50% bonus on every MoMo airtime purchase this weekend.', date: '2026-10-28', time: '09:05' }
  const promo = { raw: 'Keep your MoMo PIN secret. MTN will never ask you for it.', date: '2026-10-28', time: '09:06' }
  const newRows = rowsOf([extra('Offertory', '49000000001'), extra('01', '49000000002'), extra('7', '49000000003'), extra('Youth week', '49000000004'), extra('', '49000000005'), partial, promo])
  const more = addChurchRows(church, [...churchRows, ...newRows], { builtInPairs: true })
  const groupOf = (data, txId) => matchKey(nameOf(data, data.txs.find((t) => t.txId === txId).groupId))
  check('rescan: five new payments', more.added, 5)
  check('rescan: built-in wording joins', groupOf(more, '49000000001'), 'offering')
  check('rescan: built-in join remembers the payment', more.merges.find((m) => m.id === 'm:offertory').txIds.includes('t:49000000001'), true)
  check('rescan: code with a leading zero', groupOf(more, '49000000002'), 'offering')
  check('rescan: new unnamed code', groupOf(more, '49000000003'), 'code 7')
  check('rescan: new typed reference', groupOf(more, '49000000004'), 'youth week')
  check('rescan: blank reference', groupOf(more, '49000000005'), 'no reference')
  check('rescan: messages that cannot be read are kept, newest first', more.unread.map((u) => u.raw), [promo.raw, partial.raw])
  check('rescan: unread messages are not added twice', addChurchRows(more, newRows, { builtInPairs: true }).unread.length, 2)
  check('rescan: newest payment first', more.txs[0].date, '2026-10-28')

  // A group the treasurer merged keeps passing new payments on, and Undo can still split them.
  const thanks = church.groups.find((g) => matchKey(g.name) === 'thanksgiving')
  const spaced = church.groups.find((g) => matchKey(g.name) === 'thanks giving')
  const merged = {
    ...church,
    groups: church.groups.map((g) => (g.id === spaced.id ? { ...g, hidden: true } : g)),
    txs: church.txs.map((t) => (t.groupId === spaced.id ? { ...t, groupId: thanks.id } : t)),
    merges: [{ id: 'm1', sourceId: spaced.id, targetId: thanks.id, txIds: church.txs.filter((t) => t.groupId === spaced.id).map((t) => t.id), date: '2026-10-28' }, ...church.merges],
    suggestions: church.suggestions.filter((s) => s.mergeId !== spaced.id),
  }
  const afterMerge = addChurchRows(merged, rowsOf([extra('thanks giving', '49000000006')]), { builtInPairs: true })
  check('merged group: new payment follows the merge', groupOf(afterMerge, '49000000006'), 'thanksgiving')
  check('merged group: merge remembers it', afterMerge.merges.find((m) => m.id === 'm1').txIds.includes('t:49000000006'), true)
  check('merged group: not suggested again', afterMerge.suggestions.length, 1)

  // A group the treasurer renamed still receives its old wording.
  const renamed = { ...church, groups: church.groups.map((g) => (matchKey(g.name) === 'welfare' ? { ...g, name: 'Welfare fund' } : g)) }
  const afterRename = addChurchRows(renamed, rowsOf([extra('welfare', '49000000007')]), { builtInPairs: true })
  check('renamed group keeps its wording', groupOf(afterRename, '49000000007'), 'welfare fund')

  // Organisations have no built-in pairs: Offertory is its own group, offered as a suggestion at most.
  const org = addChurchRows(emptyChurch(), churchRows, { builtInPairs: false })
  check('organisation: no built-in joins', org.merges.length, 0)
  check('organisation: Offertory stays visible', org.groups.some((g) => !g.hidden && matchKey(g.name) === 'offertory'), true)
  check('organisation: unnamed codes wait', org.groups.filter((g) => g.code).map((g) => g.code).sort(), ['1', '2', '3', '5'])

  // ---- Personal: every message type comes back as the same payment ----------------
  const pSeed = seedPersonalTxs()
  const pRows = rowsOf(pSeed)
  const mine = toPersonalTxs(pRows)
  check('personal: every payment read', mine.length, pSeed.length)
  const shape = (t) => ({ kind: t.kind, direction: t.direction, amount: t.amount, fee: t.fee, balance: t.balance, name: t.name, phone: t.phone, personKey: t.personKey, reference: t.reference, date: t.date, time: t.time })
  for (const s of pSeed) {
    // A reversal message quotes the reversed payment's ID, not one of its own.
    const t = s.kind === 'reversal' ? mine.find((x) => x.kind === 'reversal' && x.date === s.date && x.time === s.time) : mine.find((x) => x.kind !== 'reversal' && x.txId === s.txId)
    if (!t) {
      failures.push(`personal: ${s.kind} ${s.txId} is missing`)
      continue
    }
    check(`personal ${s.kind} ${s.txId}`, shape(t), shape(s))
  }
  const want = categoriseAll(pSeed, SEED_RULES)
  const got = categoriseAll(mine, SEED_RULES)
  const tally = (list) => {
    const m = {}
    for (const t of list) m[t.categoryId ?? 'none'] = (m[t.categoryId ?? 'none'] ?? 0) + 1
    return Object.fromEntries(Object.entries(m).sort())
  }
  check('personal: same categories as the sample data', tally(got), tally(want))
  check('personal: scanning twice gives one of each', toPersonalTxs([...pRows, ...pRows]).length, pSeed.length)
  check('personal: newest first', mine[0].date >= mine[mine.length - 1].date, true)

  // Tax is part of what a payment cost.
  const taxed = rowsOf([{ raw: 'Payment made for GHS 100.00 to KOFI BOATENG 0545550172. Current Balance: GHS 50.00. Reference: -. Transaction ID: 49000000008. Fee charged: GHS 0.75. TAX charged: GHS 1.00.', date: '2026-10-28', time: '10:00' }])
  check('personal: fee includes tax', toPersonalTxs(taxed)[0].fee, 1.75)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

for (const f of failures) console.error('FAIL ' + f)
console.log(`${passed} passed, ${failures.length} failed`)
if (failures.length) process.exitCode = 1
