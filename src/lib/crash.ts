/**
 * A JavaScript error as text for the problem report. Pure: no React Native imports, so
 * `npm run test:crash` runs it under plain Node. Never throws, whatever was thrown.
 */
export function describeError(error: unknown, componentStack?: string | null): string {
  try {
    const parts: string[] = []
    const seen = new Set<unknown>()
    let e = error
    while (e instanceof Error && !seen.has(e) && seen.size < 5) {
      seen.add(e)
      const title = `${e.name}: ${e.message}`
      const stack = String(e.stack ?? '').trim()
      parts.push((parts.length ? 'Caused by: ' : '') + (stack.startsWith(title) ? stack : stack ? `${title}\n${stack}` : title))
      e = (e as { cause?: unknown }).cause
    }
    if (!parts.length) parts.push(`Thrown: ${String(error)}`)
    if (componentStack) parts.push('Screens:\n' + componentStack.replace(/^\n+/, ''))
    return parts.join('\n')
  } catch {
    return 'An error that could not be read.'
  }
}
