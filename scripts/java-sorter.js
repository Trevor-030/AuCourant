/**
 * The Java sorter (native/android/java/com/aucourant/sorting) called from Node, with the same
 * signatures the TypeScript sorter had, so scripts/test-inbox.js checks the code the phone runs.
 * Compiles once with only the JDK, then runs SortDump once per call over a JSON file.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const candidates = [process.env.JAVA_HOME, 'C:\\Program Files\\Android\\Android Studio\\jbr'].filter(Boolean)
const home = candidates.find((h) => fs.existsSync(path.join(h, 'bin')))
const bin = (tool) => (home ? path.join(home, 'bin', tool) : tool)
const javaFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? javaFiles(path.join(dir, e.name)) : e.name.endsWith('.java') ? [path.join(dir, e.name)] : []))

let tmp = null
function classes() {
  if (tmp) return tmp
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aucourant-sorter-'))
  const sources = [
    ...javaFiles(path.join(root, 'native/android/java/com/aucourant/parser')),
    ...javaFiles(path.join(root, 'native/android/java/com/aucourant/sorting')),
    path.join(root, 'native/android/test/com/aucourant/sorting/SortDump.java'),
  ]
  execFileSync(bin('javac'), ['-d', tmp, ...sources], { stdio: 'inherit' })
  process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }))
  return tmp
}

function run(op, args) {
  const dir = classes()
  const file = path.join(dir, 'in.json')
  fs.writeFileSync(file, JSON.stringify({ op, ...args }), 'utf8')
  return JSON.parse(execFileSync(bin('java'), ['-cp', dir, 'com.aucourant.sorting.SortDump', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
}

module.exports = {
  emptyChurch: (codeNames = []) => run('emptyChurch', { codeNames }),
  addChurchRows: (prev, rows, opts) => run('addChurchRows', { prev, rows, builtInPairs: opts.builtInPairs }),
  toPersonalTxs: (rows, known = []) => run('toPersonalTxs', { rows, known }),
  categoriseAll: (list, rules) => run('categoriseAll', { list, rules }),
}
