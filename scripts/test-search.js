/**
 * Checks src/lib/search.ts (what the search boxes match) with plain Node.
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

const { matches, pTxMatches } = require(path.join(__dirname, '..', 'src', 'lib', 'search.ts'))

let passed = 0
const failures = []
function check(name, actual, expected) {
  if (actual === expected) passed++
  else failures.push(`${name}\n    expected ${expected}\n    actual   ${actual}`)
}

// A payment as a real scan gives it: the SMS text holds the words every MoMo message has.
const rent = {
  id: 'p:1',
  kind: 'sent',
  direction: 'out',
  amount: 800,
  fee: 0,
  name: 'Ama Owusu',
  phone: '020 555 0118',
  personKey: '0205550118',
  reference: 'rent',
  date: '2026-11-20',
  time: '10:15',
  txId: '48200000002',
  raw: 'Payment made for GHS 800.00 to AMA OWUSU 0205550118. Current Balance: GHS 1,880.00. Reference: rent. Fee charged: GHS 0.00. Transaction ID: 48200000002.',
  categoryId: 'home',
  catSource: 'user',
}
const food = {
  ...rent,
  id: 'p:2',
  amount: 45.5,
  name: 'Kasoa Fresh Mart',
  phone: null,
  personKey: 'm:kasoa fresh mart',
  reference: null,
  txId: '48200000003',
  raw: 'Payment of GHS 45.50 to merchant KASOA FRESH MART has been completed. Current Balance: GHS 1,834.50. Fee charged: GHS 0.00. Transaction ID: 48200000003.',
  categoryId: 'food',
}
const search = (q) => [rent, food].filter((t) => pTxMatches(t, q, undefined, t.categoryId === 'food' ? 'Food' : 'Home')).map((t) => t.id).join(',')

check('empty query keeps all', search(''), 'p:1,p:2')
check('reference finds only its payment, not "Current Balance"', search('rent'), 'p:1')
check('fee is not in every payment', search('fee'), '')
check('name', search('fresh mart'), 'p:2')
check('nickname', [rent].filter((t) => pTxMatches(t, 'landlady', 'Landlady', 'Home')).length, 1)
check('phone typed without spaces', search('0205550118'), 'p:1')
check('phone typed as shown', search('020 555'), 'p:1')
check('amount', search('45.50'), 'p:2')
check('category', search('food'), 'p:2')
check('case and spacing ignored', search('  RENT '), 'p:1')
check('matches: empty field skipped', matches('a', null, undefined, ''), false)

console.log(`${passed} passed, ${failures.length} failed`)
for (const f of failures) console.log('FAIL ' + f)
if (failures.length) process.exitCode = 1
