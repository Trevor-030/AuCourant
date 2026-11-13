/**
 * Compiles and runs the plain-Java parser checks with only the JDK (no Gradle, no Android).
 * Uses JAVA_HOME, then Android Studio's bundled JBR on Windows, then java on PATH.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const candidates = [process.env.JAVA_HOME, 'C:\Program Files\Android\Android Studio\jbr'].filter(Boolean)
const home = candidates.find((h) => fs.existsSync(path.join(h, 'bin')))
const bin = (tool) => (home ? path.join(home, 'bin', tool) : tool)

const list = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(path.join(dir, e.name)) : e.name.endsWith('.java') ? [path.join(dir, e.name)] : []))

const sources = [...list(path.join(root, 'native/android/java/com/aucourant/parser')), ...list(path.join(root, 'native/android/test'))]
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aucourant-parser-'))
try {
  execFileSync(bin('javac'), ['-d', out, '-Xlint:all', ...sources], { stdio: 'inherit' })
  execFileSync(bin('java'), ['-cp', out, 'com.aucourant.parser.ParserCheck'], { stdio: 'inherit' })
} catch (e) {
  process.exitCode = 1
} finally {
  fs.rmSync(out, { recursive: true, force: true })
}
