/**
 * Checks src/lib/persist.ts (the save queue between the screens and Room) with plain Node.
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

const { diffRows, createSaveQueue, mergeScan, settleNew, countManualFixes, launchPhase, undoNaming } = require(path.join(__dirname, '..', 'src', 'lib', 'persist.ts'))

let passed = 0
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`)
}

const tick = () => new Promise((r) => setTimeout(r, 0))

async function main() {
  // ---- diffRows ----------------------------------------------------------------------
  const a = { id: 't:1', groupId: 'g1', date: '2026-10-28', time: '09:00' }
  const b = { id: 't:2', groupId: 'g1', date: '2026-10-27', time: '09:00' }
  check('diff: unchanged object is not saved', diffRows([a], [a]).upsert.length, 0)
  check('diff: an equal copy is not saved', diffRows([a], [{ ...a }]).upsert.length, 0)
  check('diff: edited row is saved', diffRows([a], [{ ...a, groupId: 'g2' }]).upsert.map((r) => r.id), ['t:1'])
  check('diff: new row is saved', diffRows([a], [a, b]).upsert.map((r) => r.id), ['t:2'])
  check('diff: removed row', diffRows([a, b], [a]).remove, ['t:2'])

  // ---- Save queue ----------------------------------------------------------------------
  const sent = []
  let fail = false
  const q = createSaveQueue(async (changes) => {
    if (fail) throw new Error('disk full')
    sent.push(...changes)
  })
  q.markSaved('church_tx', [a, b], { replace: true })
  q.sync('church_tx', [a, b])
  await q.flush()
  check('queue: nothing to save after load', sent.length, 0)

  q.sync('church_tx', [{ ...a, groupId: 'g2' }, b])
  q.sync('church_group', [{ id: 'g2', name: 'Welfare' }], { ordered: true })
  const ok = await q.flush()
  check('queue: sends in order', sent.map((c) => c.table), ['church_tx', 'church_group'])
  check('queue: only the edited row', sent[0].upsert.map((r) => r.id), ['t:1'])
  check('queue: the row goes as JSON text', JSON.parse(sent[0].upsert[0].json).groupId, 'g2')
  check('queue: flush reports success', ok, true)

  sent.length = 0
  const g1 = { id: 'g1', name: 'Offering' }
  const g2 = { id: 'g2', name: 'Welfare' }
  q.markSaved('category', [g1, g2], { replace: true })
  q.sync('category', [g2, g1], { ordered: true })
  await q.flush()
  check('queue: a new order saves every position', sent[0].upsert.map((r) => [r.id, r.position]), [['g2', 0], ['g1', 1]])

  sent.length = 0
  fail = true
  q.sync('church_tx', [{ ...a, groupId: 'g3' }, b])
  check('queue: a failed save is reported', await q.flush(), false)
  check('queue: failed flag is set', q.failed(), true)
  fail = false
  check('queue: a failed save is retried on the next flush', await q.flush(), true)
  check('queue: the retried row arrives', sent.map((c) => c.upsert.map((r) => r.id)).flat(), ['t:1'])
  check('queue: failed flag clears', q.failed(), false)

  const stop = q.track()
  q.sync('church_tx', [{ ...a, groupId: 'g4' }, b])
  check('queue: tracks rows pushed since', [...stop().edited], ['t:1'])
  await q.flush()

  sent.length = 0
  q.sync('church_tx', [{ ...a, groupId: 'g4' }, b])
  q.markSaved('church_tx', [{ ...b, groupId: 'g9' }])
  q.sync('church_tx', [{ ...a, groupId: 'g4' }, { ...b, groupId: 'g9' }])
  await q.flush()
  check('queue: rows Java saved are not sent back', sent.length, 0)

  // ---- An edit while a scan runs (final review, Important 1) ------------------------
  {
    const out = []
    const q2 = createSaveQueue(async (c) => out.push(...c))
    const off = { id: 'm:offertory', txIds: ['t:1'] }
    const hv = { id: 'm:havest', txIds: [] }
    const old = { id: 'm:old', txIds: [] }
    q2.markSaved('merge_record', [off, old], { replace: true })
    const stop2 = q2.track()
    // The treasurer confirms a merge (new row first) and undoes another (removed) while Java adds t:2 to Offertory.
    q2.sync('merge_record', [hv, off], { ordered: true })
    const t2 = stop2()
    check('track: a reordered row counts as sent', t2.sent.has('m:offertory'), true)
    check('track: a reordered row is not an edit', t2.edited.has('m:offertory'), false)
    check('track: a removed row counts as an edit', t2.edited.has('m:old'), true)
    await q2.flush()
    const javaOff = { id: 'm:offertory', txIds: ['t:1', 't:2'] }
    const javaOld = { id: 'm:old', txIds: ['t:3'] }
    const screen = mergeScan([hv, off], [javaOff, javaOld], t2.edited, 'end')
    check('mergeScan: a row removed on screen during the scan is not added back', screen.map((m) => m.id), ['m:havest', 'm:offertory'])
    check('mergeScan: an untouched row takes the scan version', screen[1].txIds, ['t:1', 't:2'])
    // Rows the queue sent during the scan are not marked saved, so the screen version is sent again.
    q2.markSaved('merge_record', [javaOff, javaOld].filter((r) => !t2.sent.has(r.id)))
    out.length = 0
    q2.sync('merge_record', screen, { ordered: true })
    await q2.flush()
    const last = out.flatMap((c) => c.upsert).find((r) => r.id === 'm:offertory')
    check('queue: the grown merge is saved after a stale re-save', last && JSON.parse(last.json).txIds, ['t:1', 't:2'])
  }

  // ---- Where the app opens (final review, Important 2) -------------------------------
  check('launch: new install', launchPhase({ onboarded: false, messages: false, lock: false }), { kind: 'onboarding', step: 'welcome' })
  check('launch: scan saved, first run not finished', launchPhase({ onboarded: false, messages: true, lock: false }), { kind: 'onboarding', step: 'complete' })
  check('launch: a lock always comes first, even if first run was interrupted', launchPhase({ onboarded: false, messages: true, lock: true }), { kind: 'locked', step: 'lock' })
  check('launch: finished with a lock', launchPhase({ onboarded: true, messages: true, lock: true }), { kind: 'locked', step: 'lock' })
  check('launch: finished without a lock', launchPhase({ onboarded: true, messages: true, lock: false }), { kind: 'app' })

  // ---- mergeScan ---------------------------------------------------------------------
  const moved = { id: 't:1', groupId: 'g-user' }
  const stale = { id: 't:1', groupId: 'g-old' }
  check('mergeScan: a row the user moved during the scan keeps the user version', mergeScan([moved], [stale], new Set(['t:1']))[0].groupId, 'g-user')
  check('mergeScan: a row the user did not touch takes the saved version', mergeScan([stale], [{ ...stale, groupId: 'g-new' }], new Set())[0].groupId, 'g-new')
  const older = { id: 't:1' }
  const newer = { id: 't:9' }
  check('mergeScan: new payments go first', mergeScan([older], [newer], new Set()).map((r) => r.id), ['t:9', 't:1'])
  check('mergeScan: new groups go last', mergeScan([older], [newer], new Set(), 'end').map((r) => r.id), ['t:1', 't:9'])

  // ---- settleNew ---------------------------------------------------------------------
  const groupsWithAHidden = [{ id: 'A', name: 'Harvest', hidden: true }, { id: 'B', name: 'Harvest fund' }]
  const mergeAtoB = { id: 'm1', sourceId: 'A', targetId: 'B', txIds: ['t:1'], date: '2026-10-28' }
  const txInA = { id: 't:5', groupId: 'A' }
  const settled = settleNew([txInA], groupsWithAHidden, [mergeAtoB])
  check('settleNew: follows the on-screen merge', settled.txs[0].groupId, 'B')
  check('settleNew: the merge records the payment', settled.merges[0].txIds, ['t:1', 't:5'])
  check('settleNew: a payment in an open group stays', settleNew([{ id: 't:6', groupId: 'B' }], groupsWithAHidden, [mergeAtoB]).txs[0].groupId, 'B')
  check('settleNew: merges it did not touch are the same objects', settleNew([{ id: 't:6', groupId: 'B' }], groupsWithAHidden, [mergeAtoB]).merges[0] === mergeAtoB, true)

  // ---- Manual fixes ------------------------------------------------------------------
  const move = { id: 'c1', txId: 't:1', fromGroupId: 'g1', toGroupId: 'g2', at: 1, kind: 'manual', undoes: null }
  const undo = { id: 'c2', txId: 't:1', fromGroupId: 'g2', toGroupId: 'g1', at: 2, kind: 'undo', undoes: 'c1' }
  const confirmed = { id: 'c3', txId: 't:2', fromGroupId: 'g3', toGroupId: 'g4', at: 3, kind: 'confirmed', undoes: null }
  check('fixes: a move counts', countManualFixes([move]), 1)
  check('fixes: a move and its Undo cancel out', countManualFixes([move, undo]), 0)
  check('fixes: a confirmed merge does not count', countManualFixes([confirmed]), 0)
  // Splitting a merge and taking the split back leaves the merge in effect, so the fix counts again.
  const hand = { id: 'c:m1', txId: '', fromGroupId: 'g1', toGroupId: 'g2', at: 1, kind: 'manual', undoes: null }
  const split = { id: 'c5', txId: '', fromGroupId: 'g2', toGroupId: 'g1', at: 2, kind: 'undo', undoes: 'c:m1' }
  const unsplit = { id: 'c6', txId: '', fromGroupId: 'g1', toGroupId: 'g2', at: 3, kind: 'undo', undoes: 'c5' }
  const again = { id: 'c7', txId: '', fromGroupId: 'g2', toGroupId: 'g1', at: 4, kind: 'undo', undoes: 'c:m1' }
  check('fixes: an Undo that was undone no longer cancels', countManualFixes([hand, split, unsplit]), 1)
  check('fixes: splitting it again cancels it', countManualFixes([hand, split, unsplit, again]), 0)

  // ---- Undo of naming a code, with payments a check added meanwhile ---------------------
  const named = [
    { id: 't:1', groupId: 'g-new', reference: '5' },
    { id: 't:2', groupId: 'g-new', reference: '5' },
    { id: 't:3', groupId: 'g-new', reference: 'Welfare' },
    { id: 't:4', groupId: 'g-other', reference: '5' },
  ]
  const undone = undoNaming(named, { code: '5', to: 'g-new', moved: [{ id: 't:1', from: 'noref' }], lateTo: 'code-5', before: new Set(['t:1', 't:3']) })
  check('undoNaming: what naming moved goes back', undone.find((t) => t.id === 't:1').groupId, 'noref')
  check('undoNaming: a payment that came in meanwhile goes to the late group', undone.find((t) => t.id === 't:2').groupId, 'code-5')
  check('undoNaming: a payment with another reference stays', undone.find((t) => t.id === 't:3').groupId, 'g-new')
  check('undoNaming: a payment in another group stays', undone.find((t) => t.id === 't:4').groupId, 'g-other')
  const there = [{ id: 't:7', groupId: 'g-new', reference: '5' }]
  check('undoNaming: a payment already there before naming stays', undoNaming(there, { code: '5', to: 'g-new', moved: [], lateTo: 'code-5', before: new Set(['t:7']) })[0].groupId, 'g-new')
  const zero = [{ id: 't:8', groupId: 'g-new', reference: ' 5 ' }]
  check('undoNaming: spaces around the code do not matter', undoNaming(zero, { code: '5', to: 'g-new', moved: [], lateTo: 'code-5', before: new Set() })[0].groupId, 'code-5')
}

main()
  .catch((e) => failures.push('crashed: ' + (e && e.stack)))
  .finally(() => {
    for (const f of failures) console.error('FAIL ' + f)
    console.log(`${passed} passed, ${failures.length} failed`)
    if (failures.length) process.exitCode = 1
  })
