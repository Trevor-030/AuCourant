/** Checks how JavaScript errors are written into a problem report (src/lib/crash.ts) with plain Node. */
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
const { describeError } = require(path.join(__dirname, '..', 'src', 'lib', 'crash.ts'))

let passed = 0
const failures = []
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++
  else failures.push(`${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`)
}

const e = new TypeError('undefined is not a function')
e.stack = 'TypeError: undefined is not a function\n    at ScanComplete (index.android.bundle:1:1234567)'
check('error: name and message first', describeError(e).split('\n')[0], 'TypeError: undefined is not a function')
check('error: the message is not repeated', describeError(e).match(/undefined is not a function/g).length, 1)
check('error: the place', describeError(e).includes('ScanComplete (index.android.bundle:1:1234567)'), true)
const hermes = new Error('boom')
hermes.stack = 'render@1:99\nbeginWork@1:100'
check('error: a stack without the message keeps both', describeError(hermes), 'Error: boom\nrender@1:99\nbeginWork@1:100')
check('error: screens', describeError(hermes, '\n    in ScanComplete\n    in AppShell').endsWith('Screens:\n    in ScanComplete\n    in AppShell'), true)
const cause = new Error('outer')
cause.stack = 'a@1:1'
cause.cause = hermes
check('error: cause', describeError(cause), 'Error: outer\na@1:1\nCaused by: Error: boom\nrender@1:99\nbeginWork@1:100')
const loop = new Error('loop')
loop.stack = 'x@1:1'
loop.cause = loop
check('error: a cause that loops ends', describeError(loop).length < 500, true)
check('thrown text', describeError('just text'), 'Thrown: just text')
check('thrown null', describeError(null), 'Thrown: null')
check('thrown object', describeError({ a: 1 }), 'Thrown: [object Object]')
const nasty = { get message() { throw new Error('no') } }
check('an error that cannot be read does not throw', typeof describeError(nasty), 'string')

for (const f of failures) console.error('FAIL ' + f)
console.log(`${passed} passed, ${failures.length} failed`)
if (failures.length) process.exitCode = 1
