import type { Group, Merge, Tx } from './data'

/**
 * The save queue between the screens and Room (docs/superpowers/specs/2026-11-21-room-storage-design.md).
 *
 * Edits stay in TypeScript and change the screen at once. `sync` compares each saved list with
 * what was last saved and queues only what changed. Saves go to Java one at a time, in order, and
 * a scan waits for `flush` first, so it always sorts against the latest edits.
 *
 * Pure: no React Native imports, so `npm run test:persist` runs it under plain Node.
 */

type Item = { id: string }
/** One list's changes, as StoreModule.save takes them. Each item travels as JSON text. */
export type Change = { table: string; upsert: { id: string; position: number; json: string }[]; remove: string[] }

/** The manual-fix record (architecture.md, GroupChange). Only `manual` counts as a fix, unless undone. */
export type GroupChange = {
  id: string
  /** Empty for a change to the group itself (a rename). */
  txId: string
  fromGroupId: string
  toGroupId: string
  at: number
  kind: 'manual' | 'confirmed' | 'code' | 'undo'
  /** For an undo: the change it cancels. */
  undoes: string | null
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** What changed between two versions of a list, by id. Unchanged objects are skipped by reference first. */
export function diffRows<T extends Item>(prev: T[], next: T[]): { upsert: T[]; remove: string[] } {
  const before = new Map(prev.map((r) => [r.id, r]))
  const upsert = next.filter((r) => !same(before.get(r.id), r))
  const keep = new Set(next.map((r) => r.id))
  return { upsert, remove: prev.filter((r) => !keep.has(r.id)).map((r) => r.id) }
}

type Saved = { byId: Map<string, Item>; order: string[] }

/**
 * @param send saves one batch (StoreNative.save); throws when it could not
 */
export function createSaveQueue(send: (changes: Change[]) => Promise<void>) {
  const saved = new Map<string, Saved>()
  /** Changes not yet sent, or sent and failed, oldest first. */
  let waiting: Change[] = []
  let running: Promise<boolean> = Promise.resolve(true)
  let lastFailed = false
  /** Ids queued while a scan runs: `edited` changed or removed by the user, `sent` everything sent (also order-only re-saves). */
  const trackers = new Set<{ edited: Set<string>; sent: Set<string> }>()

  const snapshot = (table: string): Saved => {
    let s = saved.get(table)
    if (!s) saved.set(table, (s = { byId: new Map(), order: [] }))
    return s
  }

  const pump = (): Promise<boolean> => {
    running = running.then(async () => {
      while (waiting.length) {
        const batch = waiting
        waiting = []
        try {
          await send(batch)
        } catch {
          // Keep them for the next try, ahead of anything newer.
          waiting = [...batch, ...waiting]
          lastFailed = true
          return false
        }
      }
      lastFailed = false
      return true
    })
    return running
  }

  return {
    /** Queues what changed in `next` since it was last saved. `ordered` lists also save their order. */
    sync<T extends Item>(table: string, next: T[], opts: { ordered?: boolean } = {}) {
      const s = snapshot(table)
      const prev = s.order.map((id) => s.byId.get(id)!).filter(Boolean)
      const { upsert, remove } = diffRows(prev, next)
      const ids = next.map((r) => r.id)
      const reordered = !!opts.ordered && (ids.length !== s.order.length || ids.some((id, i) => id !== s.order[i]))
      const rows = reordered ? next : upsert
      s.byId = new Map(next.map((r) => [r.id, r]))
      s.order = ids
      if (!rows.length && !remove.length) return
      const position = new Map(ids.map((id, i) => [id, i]))
      waiting.push({ table, upsert: rows.map((r) => ({ id: r.id, position: opts.ordered ? position.get(r.id)! : 0, json: JSON.stringify(r) })), remove })
      for (const t of trackers) {
        for (const r of upsert) t.edited.add(r.id)
        for (const id of remove) t.edited.add(id)
        for (const r of rows) t.sent.add(r.id)
        for (const id of remove) t.sent.add(id)
      }
      void pump()
    },
    /** Rows that are already saved (loaded, or written by a scan), so `sync` does not send them back. */
    markSaved<T extends Item>(table: string, rows: T[], opts: { replace?: boolean } = {}) {
      const s = snapshot(table)
      if (opts.replace) {
        s.byId = new Map(rows.map((r) => [r.id, r]))
        s.order = rows.map((r) => r.id)
        return
      }
      for (const r of rows) {
        if (!s.byId.has(r.id)) s.order.push(r.id)
        s.byId.set(r.id, r)
      }
    },
    /** Resolves true once everything queued is saved; false if a save failed (it is kept for the next try). */
    flush: (): Promise<boolean> => (waiting.length ? pump() : running.then(() => !lastFailed && waiting.length === 0)),
    failed: () => lastFailed,
    /**
     * Starts collecting the ids queued from now on; call the result to stop and read them.
     * `edited`: the user changed or removed the row, so the screen version wins over a scan's.
     * `sent`: any row sent, including order-only re-saves of an older copy. Do not mark these
     * saved from a scan result: the next `sync` must send the screen version again.
     */
    track() {
      const t = { edited: new Set<string>(), sent: new Set<string>() }
      trackers.add(t)
      return () => {
        trackers.delete(t)
        return t
      }
    },
  }
}

export type SaveQueue = ReturnType<typeof createSaveQueue>

/**
 * Puts the rows a scan added or changed into what the screen shows. A row the user changed while
 * the scan ran keeps the user's version, and a row the user removed is not added back.
 * New rows go first (payments, newest first) or last (groups).
 */
export function mergeScan<T extends Item>(local: T[], changed: T[], touchedLocally: Set<string>, where: 'start' | 'end' = 'start'): T[] {
  if (!changed.length) return local
  const fromScan = new Map(changed.map((r) => [r.id, r]))
  const have = new Set(local.map((r) => r.id))
  const updated = local.map((r) => (fromScan.has(r.id) && !touchedLocally.has(r.id) ? fromScan.get(r.id)! : r))
  const added = changed.filter((r) => !have.has(r.id) && !touchedLocally.has(r.id))
  return where === 'start' ? [...added, ...updated] : [...updated, ...added]
}

/**
 * New payments the scan put in a group that is hidden on screen (merged while the scan ran) follow
 * the merges on screen, like the Java sorter's settle, and each merge remembers them for Undo.
 */
export function settleNew(newTxs: Tx[], groups: Group[], merges: Merge[]): { txs: Tx[]; merges: Merge[] } {
  const hidden = new Set(groups.filter((g) => g.hidden).map((g) => g.id))
  const exists = new Set(groups.map((g) => g.id))
  const extra = new Map<string, string[]>()
  const txs = newTxs.map((t) => {
    let at = t.groupId
    for (let hops = 0; hidden.has(at) && hops < 10; hops++) {
      const m = merges.find((x) => x.sourceId === at)
      if (!m || !exists.has(m.targetId)) break
      extra.set(m.id, [...(extra.get(m.id) ?? []), t.id])
      at = m.targetId
    }
    return at === t.groupId ? t : { ...t, groupId: at }
  })
  return { txs, merges: merges.map((m) => (extra.has(m.id) ? { ...m, txIds: [...m.txIds, ...extra.get(m.id)!] } : m)) }
}

/**
 * The pilot measure: manual fixes not cancelled by an Undo. Merges and named codes do not count.
 * An Undo can itself be undone (a merge split, then joined again); then the fix counts again.
 */
export function countManualFixes(changes: GroupChange[]): number {
  const undone = new Set<string>()
  // An Undo is always recorded after what it cancels, so the newest ones are settled first.
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i]
    if (c.kind === 'undo' && c.undoes && !undone.has(c.id)) undone.add(c.undoes)
  }
  return changes.filter((c) => c.kind === 'manual' && !undone.has(c.id)).length
}

/**
 * Takes back naming a code that had no waiting group. What naming moved goes back where it was.
 * Payments a check added through that code since then (not in `before`) go to `lateTo`.
 */
export function undoNaming<T extends { id: string; groupId: string; reference: string | null }>(
  txs: T[],
  o: { code: string; to: string; moved: { id: string; from: string }[]; lateTo: string; before: Set<string> },
): T[] {
  const from = new Map(o.moved.map((m) => [m.id, m.from]))
  return txs.map((t) => {
    const back = from.get(t.id) ?? (!o.before.has(t.id) && t.groupId === o.to && t.reference?.trim() === o.code ? o.lateTo : t.groupId)
    return back === t.groupId ? t : { ...t, groupId: back }
  })
}

type LaunchPhase = { kind: 'onboarding'; step: 'welcome' | 'complete' } | { kind: 'locked'; step: 'lock' } | { kind: 'app' }

/**
 * Where the app opens. A saved lock always comes first, even when first run was interrupted after
 * the lock was set; otherwise a saved scan resumes after the scan, not at the welcome screen.
 */
export function launchPhase(s: { onboarded: boolean; messages: boolean; lock: boolean }): LaunchPhase {
  if (s.lock) return { kind: 'locked', step: 'lock' }
  if (s.onboarded) return { kind: 'app' }
  return { kind: 'onboarding', step: s.messages ? 'complete' : 'welcome' }
}
