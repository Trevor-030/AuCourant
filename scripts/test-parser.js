/**
 * Compiles and runs the plain-Java parser, sorting, lock and crash checks with only the JDK (no Gradle, no Android).
 * Uses JAVA_HOME, then Android Studio's bundled JBR on Windows, then java on PATH.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const candidates = [process.env.JAVA_HOME, 'C:\\Program Files\\Android\\Android Studio\\jbr'].filter(Boolean)
const home = candidates.find((h) => fs.existsSync(path.join(h, 'bin')))
const bin = (tool) => (home ? path.join(home, 'bin', tool) : tool)

const list = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(path.join(dir, e.name)) : e.name.endsWith('.java') ? [path.join(dir, e.name)] : []))

const sources = [
  ...list(path.join(root, 'native/android/java/com/aucourant/parser')),
  ...list(path.join(root, 'native/android/java/com/aucourant/sorting')),
  ...list(path.join(root, 'native/android/java/com/aucourant/lock')),
  ...list(path.join(root, 'native/android/java/com/aucourant/crash')),
  ...list(path.join(root, 'native/android/test')),
]
// Android's regex engine rejects some flags the desktop JDK accepts, so the JDK checks below cannot catch them.
// A static Pattern with one of them kills the app on first use (this crashed the first scan on a phone).
const androidRejects = /UNICODE_CHARACTER_CLASS|CANON_EQ|\(\?[a-zA-Z]*U[a-zA-Z]*[):]/
const unsupported = list(path.join(root, 'native/android/java')).flatMap((file) =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, i) => (androidRejects.test(line) ? [path.relative(root, file) + ':' + (i + 1) + ': ' + line.trim()] : [])),
)
if (unsupported.length) {
  console.error('Regex flags Android does not support:\n' + unsupported.join('\n'))
  process.exitCode = 1
} else {
  console.log('android regex flags: ok')
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aucourant-parser-'))
try {
  execFileSync(bin('javac'), ['-d', out, '-Xlint:all', ...sources], { stdio: 'inherit' })
  for (const suite of ['parser.ParserCheck', 'sorting.SortCheck', 'lock.LockCheck', 'crash.CrashCheck']) {
    try {
      execFileSync(bin('java'), ['-cp', out, 'com.aucourant.' + suite], { stdio: 'inherit' })
    } catch {
      process.exitCode = 1
    }
  }
} catch (e) {
  process.exitCode = 1
} finally {
  fs.rmSync(out, { recursive: true, force: true })
}
