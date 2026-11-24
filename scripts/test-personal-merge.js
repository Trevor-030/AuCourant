/**
 * Checks src/lib/personal-merge.ts (Personal merges and refunds) with plain Node.
 * The TypeScript is run straight from src/ with the project's own typescript package.
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(outputText, filename)
}

const M = require(path.join(__dirname, '..', 'src', 'lib', 'personal-merge.ts'))

let passed = 0
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`)
}

let n = 0
/** A payment with only what a check needs; the rest as a scan gives it. */
function tx(over) {
  n++
  const phone = over.phone === undefined ? '054 555 01' + String(n).padStart(2, '0') : over.phone
  const name = over.name ?? 'Person ' + n
  return {
    id: 'p' + n,
    kind: over.direction === 'in' ? 'received' : 'sent',
    direction: 'out',
    amount: 100,
    fee: 0,
    balance: null,
    name,
    phone,
    personKey: phone ? phone.replace(/\D/g, '') : 'm:' + name.toLowerCase(),
    reference: null,
    date: '2026-11-10',
    time: '10:00',
    txId: String(48200000000 + n),
    raw: '',
    categoryId: null,
    catSource: null,
    refundOf: null,
    ...over,
  }
}

// ---- Refunds and totals ---------------------------------------------------------------

function refunds() {
  const paid = tx({ amount: 100 })
  const back = (amount, over = {}) => tx({ direction: 'in', amount, refundOf: paid.id, ...over })
  const totals = (list, all = list) => {
    const t = M.totalsOf(list, M.refundsByPayment(all))
    return { in: t.moneyIn, out: t.moneyOut, fees: t.fees }
  }

  check('refund not money in', totals([back(40)]).in, 0)
  check('full refund', totals([paid, back(100)]).out, 0)
  check('partial refund', totals([paid, back(40)]).out, 60)
  check('two refunds add up', totals([paid, back(30), back(10)]).out, 60)
  check('refund larger than payment', totals([paid, back(150)]).out, 0)
  const later = back(40, { date: '2026-12-02' })
  check('refund in a later month', totals([paid], [paid, later]).out, 60)
  check('fees still count', totals([{ ...paid, fee: 1 }, back(100)]).fees, 1)
  const orphan = tx({ direction: 'in', amount: 25, refundOf: 'gone' })
  check('refund of a missing payment', totals([orphan]), { in: 0, out: 0, fees: 0 })
  check('refund of a missing payment adds nothing', M.refundsByPayment([orphan]).size, 0)
  const plain = tx({ direction: 'in', amount: 70 })
  check('no refunds unchanged', totals([paid, plain]), { in: 70, out: 100, fees: 0 })
  check('totals without refunds map', M.totalsOf([paid, plain]).moneyOut, 100)
  check('old saved payment without the field', totals([{ ...paid, refundOf: undefined }]).out, 100)
}

refunds()

// ---- People -----------------------------------------------------------------------------

function people() {
  const A = '0545550201'
  const B = '0205550302'
  const a1 = tx({ phone: '054 555 0201', name: 'Kofi Boateng', date: '2026-11-12' })
  const b1 = tx({ phone: '020 555 0302', name: 'Kofi B', date: '2026-11-01' })
  const b2 = tx({ phone: '020 555 0302', name: 'Kofi B', date: '2026-11-02', direction: 'in' })
  const ruleB = { id: 'r1', kind: 'person', value: B, label: 'Kofi B', categoryId: 'family' }
  const ruleA = { id: 'r2', kind: 'person', value: A, label: 'Kofi Boateng', categoryId: 'work' }
  const base = { txs: [a1, b1, b2], rules: [ruleB], nicknames: {} }
  const merge = (s, keepName = 'Kofi Boateng') => M.mergePeople(s, { id: 'pm1', fromKey: B, toKey: A, keepName, date: '2026-11-24' })

  const m = merge(base)
  check('merge moves payments', m.txs.map((t) => t.personKey), [A, A, A])
  check('merge moves rules', m.rules.map((r) => r.value), [A])
  check('merge record', { ...m.record }, { id: 'pm1', fromKey: B, toKey: A, txIds: [b1.id, b2.id], nicknameBefore: null, fromNickname: null, date: '2026-11-24' })
  check('merge leaves the input alone', base.txs[1].personKey, B)
  check('kept rule wins', merge({ ...base, rules: [ruleB, ruleA] }).rules.map((r) => r.id), ['r2'])
  check('keep own name, no nickname', m.nicknames, {})
  check('keep other name becomes nickname', merge(base, 'Kofi B').nicknames, { [A]: 'Kofi B' })
  check('nickname moves when kept has none', merge({ ...base, nicknames: { [B]: 'Uncle' } }).nicknames, { [A]: 'Uncle' })
  check('kept nickname stays', merge({ ...base, nicknames: { [A]: 'Boss', [B]: 'Uncle' } }).nicknames, { [A]: 'Boss' })

  const s = M.separatePeople(m, m.record)
  check('separate restores', s.txs.map((t) => t.personKey), [A, B, B])
  const b3 = tx({ phone: '020 555 0302', name: 'Kofi B', personKey: A })
  check('separate takes later payments', M.separatePeople({ ...m, txs: [...m.txs, b3] }, m.record).txs.map((t) => t.personKey), [A, B, B, B])
  const nick = merge({ ...base, nicknames: { [A]: 'Boss', [B]: 'Uncle' } }, 'Kofi B')
  check('separate restores nicknames', M.separatePeople(nick, nick.record).nicknames, { [A]: 'Boss', [B]: 'Uncle' })
  check('separate leaves rules', s.rules.map((r) => r.value), [A])

  const older = { id: 'pm1', fromKey: B, toKey: A, txIds: [], nicknameBefore: null, fromNickname: null, date: '2026-11-20' }
  const newer = { id: 'pm2', fromKey: A, toKey: 'C', txIds: [], nicknameBefore: null, fromNickname: null, date: '2026-11-24' }
  check('chain resolves to last', M.resolveKey(B, [newer, older]), 'C')
  check('resolve unknown key unchanged', M.resolveKey('X', [newer, older]), 'X')
  check('resolve stops on a loop', M.resolveKey(A, [{ ...older, fromKey: 'C', toKey: B }, newer, older]), B)
}

people()

// ---- Categories -------------------------------------------------------------------------

function categories() {
  const cats = [
    { id: 'food', name: 'Food' },
    { id: 'eating', name: 'Eating out' },
    { id: 'airtime', name: 'Airtime', builtIn: true },
  ]
  const t1 = tx({ categoryId: 'eating', catSource: 'manual' })
  const t2 = tx({ categoryId: 'food', catSource: 'word' })
  const rule = { id: 'r9', kind: 'word', value: 'kfc', label: 'kfc', categoryId: 'eating' }
  const s = { txs: [t1, t2], rules: [rule], categories: cats }

  const m = M.mergeCategories(s, 'eating', 'food')
  check('payments move, catSource kept', m.txs.map((t) => [t.categoryId, t.catSource]), [['food', 'manual'], ['food', 'word']])
  check('rules move', m.rules.map((r) => r.categoryId), ['food'])
  check('category removed', m.categories.map((c) => c.id), ['food', 'airtime'])
  check('built-in can receive', M.mergeCategories(s, 'eating', 'airtime').categories.map((c) => c.id), ['food', 'airtime'])
  check('built-in cannot be merged away', M.mergeCategories(s, 'airtime', 'food'), null)
  check('same category', M.mergeCategories(s, 'food', 'food'), null)
  check('missing category', M.mergeCategories(s, 'nope', 'food'), null)
  check('missing target', M.mergeCategories(s, 'eating', 'nope'), null)
}

categories()

console.log(`${passed} passed, ${failures.length} failed`)
for (const f of failures) console.log('FAIL ' + f)
if (failures.length) process.exitCode = 1
