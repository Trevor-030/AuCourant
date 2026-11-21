import type { InboxRow } from '../lib/inbox'
import { SmsNative } from './index'

/** Messages handed to the Java parser at a time, so progress can be shown on a large inbox. */
const PARSE_BATCH = 100

/**
 * Reads this phone's MoMo messages from `sinceMillis` on and parses them with the Java
 * templates. Nothing is stored. Throws when message access is off or the module is missing.
 *
 * @returns the rows, or null when `alive()` turned false part way (the caller went away)
 */
export async function readMessages(
  sinceMillis = 0,
  opts: { onProgress?: (read: number, total: number) => void; alive?: () => boolean } = {},
): Promise<InboxRow[] | null> {
  const alive = opts.alive ?? (() => true)
  const inbox = await SmsNative.readInbox(sinceMillis)
  if (!alive()) return null
  opts.onProgress?.(0, inbox.length)
  const rows: InboxRow[] = []
  for (let i = 0; i < inbox.length; i += PARSE_BATCH) {
    const batch = inbox.slice(i, i + PARSE_BATCH)
    const parsed = await SmsNative.parse(batch.map((m) => m.body))
    if (!alive()) return null
    batch.forEach((sms, k) => rows.push({ sms, parsed: parsed[k] }))
    opts.onProgress?.(rows.length, inbox.length)
  }
  return rows
}
