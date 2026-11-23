import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, useColorScheme } from 'react-native'
import {
  EXPORT_FIELDS,
  SEED_CODES,
  SEED_GROUPS,
  SEED_SPECIALS,
  SEED_SUGGESTIONS,
  SEED_UNREAD,
  SEED_WEEKLY,
  seedMerges,
  seedTransactions,
  makeRecoveryCode,
  type ExportField,
  type Group,
  type Merge,
  type Special,
  type Suggestion,
  type Tx,
  type Unread,
  type Weekly,
} from './data'
import { DAYS, TODAY, addDays, inWindow, latestWeekday, longDate, normalize, phoneToday, shortDate, toMin, weekdayOf } from './format'
import { codeDoubt, NO_REFERENCE, type CodeName } from './inbox'
import { createSaveQueue, launchPhase, mergeScan, settleNew, undoNaming, type GroupChange } from './persist'
import { usePersonalState, type PExportPrefs } from './personal'
import { DEFAULT_CATEGORIES, type Category, type CategoryRule, type PTx } from './personal-data'
import type { PeriodId } from './periods'
import type { ReportFormat } from './report'
import { StoreNative, type LockCheck, type NativeScanResult, type Snapshot } from '../native/store'
import { FingerprintNative, hasNative, LockNative, type FingerprintResult, type FingerprintStatus } from '../native'

export type ThemePref = 'dark' | 'light' | 'system'
export type Motion = 'full' | 'reduced'
export type Demo = 'populated' | 'loading' | 'empty' | 'error'
export type LockType = 'pin4' | 'pin6' | 'password'
/** The lock as the screens see it. The PIN or password and the recovery code stay in Java, hashed. */
export type Lock = { type: LockType; fingerprint: boolean }
export type UseType = 'church' | 'organisation' | 'personal'
export type OnbStep = 'welcome' | 'use-type' | 'ref-numbers' | 'permission' | 'denied' | 'scanning' | 'complete' | 'lock-setup' | 'recovery' | 'fingerprint'
export type Phase =
  | { kind: 'onboarding'; step: OnbStep }
  | { kind: 'locked'; step: 'lock' | 'reset' | 'new-lock' | 'new-recovery'; code?: string }
  | { kind: 'app' }
export type ReviewTab = 'merges' | 'codes' | 'unread'
export type Tab = 'home' | 'groups' | 'transactions' | 'categories' | 'export'
export type Route =
  | { name: Tab }
  | { name: 'group'; id: string }
  | { name: 'tx'; id: string }
  | { name: 'review'; tab?: ReviewTab }
  | { name: 'settings' }
  | { name: 'merge-history' }
  | { name: 'special-session' }
  | { name: 'weekly-service' }
  | { name: 'lock-change' }
  | { name: 'verify-lock' }
  | { name: 'new-recovery'; code: string }
  | { name: 'rescan' }
  | { name: 'reference-codes' }
  // Personal or business
  | { name: 'person'; id: string }
  | { name: 'category'; id: string }
  | { name: 'manage-categories' }

export type Service = {
  id: string
  kind: 'weekly' | 'special' | 'range'
  title: string
  date: string
  dateLabel: string
  start?: string
  end?: string
}
export type Snack = { id: number; message: string; action?: { label: string; run: () => void } }
export type ExportPrefs = { format: ReportFormat; hideMembers: boolean; fields: ExportField[] }
export type TxFilters = { thisService: boolean; groupId: string | null; query: string }
export type SessionDraft = { name: string; date: string; start: string; end: string }
/** Sample payments (Expo Go, or before the first scan), or payments read from this phone's messages. */
export type DataSource = 'sample' | 'messages'
export type ScanResult = { messages: number; newPayments: number }

/** A scan could not start because edits could not be saved first. */
export class SaveError extends Error {
  constructor() {
    super("Couldn't save. Try again.")
    this.name = 'SaveError'
  }
}

/** A message can reach the inbox a little after its own timestamp, so checks overlap by this much. */
const NEW_MESSAGE_OVERLAP_MS = 10 * 60 * 1000

/** Sample lock for Expo Go and the developer flows (PIN 1234). Never saved. */
export const DEMO_LOCK: Lock = { type: 'pin4', fingerprint: false }
const DEMO_SECRET = '1234'
export const DEMO_RECOVERY = 'K7M2-9QXA-4TNR'
export const DEFAULT_SERVICE = 'w:2026-10-25'

function seed() {
  const txs = seedTransactions()
  return {
    txs,
    groups: SEED_GROUPS.map((g) => ({ ...g })),
    merges: seedMerges(txs),
    suggestions: [...SEED_SUGGESTIONS],
    unread: [...SEED_UNREAD],
    specials: [...SEED_SPECIALS],
    weekly: { ...SEED_WEEKLY },
    codes: { ...SEED_CODES },
  }
}

/** Newest first by date, then time (payments, Not read). */
function newestFirst<T extends { date: string; time: string }>(list: T[]): T[] {
  return list.sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))
}

const changeId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export type Stats = { count: number; total: number }
export function statsOf(list: Tx[]): Stats {
  return { count: list.length, total: list.reduce((s, t) => s + t.amount, 0) }
}

/** Follows the phone's "Remove animations" setting. Can be overridden from the developer menu. */
function useReduceMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v))
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduced
}

function useAppState() {
  // Appearance. Dark is the default (PRD 12).
  const [themePref, setThemePref] = useState<ThemePref>('dark')
  const systemDark = useColorScheme() !== 'light'
  const theme: 'dark' | 'light' = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref
  const prefersReduced = useReduceMotion()
  const [motionOverride, setMotion] = useState<Motion | null>(null)
  const motion: Motion = motionOverride ?? (prefersReduced ? 'reduced' : 'full')
  // Screen-state preview (populated, loading, empty, error). Developer menu only, until real data lands.
  const [demo, setDemo] = useState<Demo>('populated')

  // Navigation
  const [phase, setPhase] = useState<Phase>({ kind: 'onboarding', step: 'welcome' })
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }])
  const route = stack[stack.length - 1]
  const push = useCallback((r: Route) => setStack((s) => [...s, r]), [])
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), [])
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), [])
  const setTab = useCallback((t: Tab) => setStack([{ name: t }]), [])

  // Data
  const [initial] = useState(seed)
  const [allTxs, setTxs] = useState<Tx[]>(initial.txs)
  const [allGroups, setGroups] = useState<Group[]>(initial.groups)
  const [merges, setMerges] = useState<Merge[]>(initial.merges)
  const [allSuggestions, setSuggestions] = useState<Suggestion[]>(initial.suggestions)
  const [allUnread, setUnread] = useState<Unread[]>(initial.unread)
  const [specials, setSpecials] = useState<Special[]>(initial.specials)
  const [weekly, setWeekly] = useState<Weekly>(initial.weekly)
  const [serviceId, setServiceId] = useState(DEFAULT_SERVICE)
  const [codes, setCodes] = useState<Record<string, string>>(initial.codes)
  // Real messages replace the sample data at the first scan.
  const [dataSource, setDataSource] = useState<DataSource>('sample')
  const today = dataSource === 'messages' ? phoneToday() : TODAY
  /** Numbers named at first run, kept so the first scan can file payments under them. */
  const [firstRunCodes, setFirstRunCodes] = useState<CodeName[]>([])
  /** Phone time of the newest message read so far (saved by the Java scan). Checks start a little before it. */
  const newestSms = useRef(0)

  // Saved data (Room). `ready` once what was saved is on screen; nothing is saved before that.
  const [ready, setReady] = useState(() => !StoreNative.available())
  /** Developer flows show sample data: nothing is saved or scanned until the app restarts. */
  const [sampleMode, setSampleMode] = useState(false)
  /** First run finished (the app was entered at least once). */
  const [onboarded, setOnboarded] = useState(false)
  /** The manual-fix record for the pilot (architecture.md, GroupChange). */
  const [changes, setChanges] = useState<GroupChange[]>([])
  const [saveFailed, setSaveFailed] = useState(false)
  const queue = useRef(createSaveQueue((c) => StoreNative.save(c))).current
  const canSave = ready && !sampleMode && StoreNative.available()
  const canScan = !sampleMode && StoreNative.available()

  const [lock, setLock] = useState<Lock | null>(null)
  const [useType, setUseType] = useState<UseType>('church')
  const [coachStep, setCoachStep] = useState<number | null>(null)
  const [snack, setSnack] = useState<Snack | null>(null)
  const [exportPrefs, setExportPrefs] = useState<ExportPrefs>({ format: 'pdf', hideMembers: false, fields: [...EXPORT_FIELDS] })
  const [txFilters, setTxFilters] = useState<TxFilters>({ thisService: true, groupId: null, query: '' })
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)

  const notify = useCallback((message: string, action?: Snack['action']) => {
    setSnack({ id: Date.now() + Math.random(), message, action })
  }, [])

  const empty = demo === 'empty'
  const personal = usePersonalState({ notify, empty, today })

  /** The latest lists, for work that finishes after an await (scans) or later (Undo). */
  const latest = useRef({ allTxs, allGroups, merges })
  latest.current = { allTxs, allGroups, merges }

  // Each saved list goes to Room through the queue: only what changed is sent. Sample data is never saved.
  const saveLists = canSave && dataSource === 'messages'
  const useSaved = <T extends { id: string }>(table: string, list: T[], ordered = false) =>
    useEffect(() => {
      if (!saveLists) return
      queue.sync(table, list, { ordered })
      queue.flush().then((ok) => setSaveFailed(!ok))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list, saveLists])
  const codeRows = useMemo(() => Object.entries(codes).map(([code, groupId]) => ({ id: code, code, groupId })), [codes])
  const nicknameRows = useMemo(
    () => Object.entries(personal.nicknames).map(([personKey, nickname]) => ({ id: personKey, personKey, nickname })),
    [personal.nicknames],
  )
  useSaved('church_tx', allTxs)
  useSaved('church_group', allGroups, true)
  useSaved('merge_record', merges, true)
  useSaved('suggestion', allSuggestions, true)
  useSaved('unread', allUnread)
  useSaved('code_entry', codeRows)
  useSaved('special', specials, true)
  useSaved('personal_tx', personal.allPTxs)
  useSaved('category', personal.allCategories, true)
  useSaved('category_rule', personal.rules, true)
  useSaved('nickname', nicknameRows)
  useSaved('group_change', changes)

  const settings = useMemo(
    () => ({ useType, themePref, exportPrefs, pExportPrefs: personal.pExportPrefs, weekly, onboarded, firstRunCodes, serviceId, periodId: personal.periodId }),
    [useType, themePref, exportPrefs, personal.pExportPrefs, weekly, onboarded, firstRunCodes, serviceId, personal.periodId],
  )
  useEffect(() => {
    if (!canSave) return
    const t = setTimeout(() => {
      StoreNative.saveSettings(settings).catch(() => setSaveFailed(true))
    }, 300)
    return () => clearTimeout(t)
  }, [settings, canSave])

  useEffect(() => {
    if (saveFailed) notify("Couldn't save. Try again.")
  }, [saveFailed, notify])
  const txs = empty ? [] : allTxs
  const groups = useMemo(() => (empty ? [] : allGroups.filter((g) => !g.hidden)), [allGroups, empty])
  const unread = empty ? [] : allUnread
  const suggestions = useMemo(() => {
    if (empty) return []
    const live = new Set(allGroups.filter((g) => !g.hidden).map((g) => g.id))
    return allSuggestions.filter((s) => live.has(s.keepId) && live.has(s.mergeId))
  }, [allSuggestions, allGroups, empty])

  // Unnamed number codes waiting in their holding group (Code 5).
  const pendingCodes = useMemo(
    () =>
      groups
        .filter((g) => g.code)
        .map((g) => {
          const inGroup = txs.filter((t) => t.groupId === g.id)
          return { group: g, code: g.code!, doubt: codeDoubt(g.code!, inGroup.map((t) => t.amount)), ...statsOf(inGroup) }
        })
        .filter((c) => c.count > 0),
    [groups, txs],
  )

  const groupName = useCallback((id: string) => allGroups.find((g) => g.id === id)?.name ?? 'Unknown group', [allGroups])

  // Services: weekly instances, special sessions sit beside their day.
  const services = useMemo<Service[]>(() => {
    const list: Service[] = []
    const d = latestWeekday(today, weekly.day)
    for (let i = 0; i < 4; i++) {
      const date = addDays(d, -7 * i)
      list.push({
        id: 'w:' + date,
        kind: 'weekly',
        // Organisations meet rather than hold services; it is the only wording default for now.
        title: `${DAYS[weekly.day]} ${useType === 'organisation' ? 'meeting' : 'service'}`,
        date,
        dateLabel: longDate(date),
        start: weekly.start,
        end: weekly.end,
      })
    }
    for (const s of specials) {
      list.push({ id: 'sp:' + s.id, kind: 'special', title: s.name, date: s.date, dateLabel: longDate(s.date), start: s.start, end: s.end })
    }
    return list.sort((a, b) => (a.date === b.date ? toMin(b.start ?? '0:0') - toMin(a.start ?? '0:0') : a.date < b.date ? 1 : -1))
  }, [weekly, specials, useType, today])

  const serviceOfTx = useCallback(
    (t: Tx): string | null => {
      const sp = specials.find((s) => s.date === t.date && inWindow(t.time, s.start, s.end))
      if (sp) return 'sp:' + sp.id
      if (weekdayOf(t.date) === weekly.day && inWindow(t.time, weekly.start, weekly.end)) return 'w:' + t.date
      return null
    },
    [specials, weekly],
  )

  const serviceInfo = useCallback(
    (id: string): Service => {
      if (id.startsWith('range:')) {
        const [, from, to] = id.split(':')
        return { id, kind: 'range', title: 'Chosen dates', date: from, dateLabel: `${shortDate(from)} to ${shortDate(to)}` }
      }
      return services.find((s) => s.id === id) ?? services[0]
    },
    [services],
  )

  const txsIn = useCallback(
    (id: string) => {
      if (id.startsWith('range:')) {
        const [, from, to] = id.split(':')
        return txs.filter((t) => t.date >= from && t.date <= to)
      }
      return txs.filter((t) => serviceOfTx(t) === id)
    },
    [txs, serviceOfTx],
  )

  const service = serviceInfo(serviceId)

  // ---- Lock ----------------------------------------------------------------------
  /** Lock secrets when nothing is saved (Expo Go, developer flows). Real builds keep only hashes in Java. */
  const memLock = useRef<{ secret: string; recovery: string } | null>(null)
  const realLock = () => StoreNative.available() && !sampleMode
  const normalizeCode = (c: string) => c.replace(/-/g, '').trim().toUpperCase()
  /** A recovery code to show once: secure random in Java on real builds. */
  const newRecoveryCode = async () => (realLock() && hasNative('AuCourantLock') ? LockNative.recoveryCode() : makeRecoveryCode())
  /** A new lock with its recovery code, or (no code) a new PIN or password that keeps the current code. */
  const saveLock = async (type: LockType, secret: string, recovery?: string) => {
    const fingerprint = lock?.fingerprint ?? false
    if (realLock()) {
      if (recovery || !lock) await StoreNative.setLock(type, secret, recovery ?? (await newRecoveryCode()), fingerprint)
      else await StoreNative.changeSecret(type, secret)
    } else {
      memLock.current = { secret, recovery: recovery ?? memLock.current?.recovery ?? DEMO_RECOVERY }
    }
    setLock({ type, fingerprint })
  }
  /** A new recovery code; the old one stops working. */
  const saveRecovery = async (code: string) => {
    if (realLock()) await StoreNative.setRecovery(code)
    else if (memLock.current) memLock.current = { ...memLock.current, recovery: code }
  }
  /** Whether this phone can unlock with a fingerprint. Always ready on sample data, where it is simulated. */
  const fingerprintStatus = async (): Promise<FingerprintStatus> => (realLock() ? FingerprintNative.status().catch(() => 'unavailable' as const) : 'ready')
  /** Turning it on asks for a fingerprint first; anything but 'ok' leaves it as it was. */
  const setFingerprint = async (on: boolean): Promise<FingerprintResult> => {
    if (realLock() && lock) {
      if (on) {
        const r = await FingerprintNative.enable()
        if (r !== 'ok') return r
      } else await FingerprintNative.disable()
      await StoreNative.setFingerprint(on)
    }
    setLock((l) => (l ? { ...l, fingerprint: on } : l))
    return 'ok'
  }
  /**
   * Asks for a fingerprint to unlock. When the phone's fingerprints changed it is turned off: on a
   * shared phone, someone may have added theirs.
   */
  const checkFingerprint = async (): Promise<FingerprintResult> => {
    if (!realLock()) return new Promise((resolve) => setTimeout(() => resolve('ok'), 700))
    const r = await FingerprintNative.check().catch(() => 'unavailable' as const)
    if (r === 'changed') await setFingerprint(false).catch(() => {})
    return r
  }
  /** Seconds left of a wait after too many wrong tries, when the app was closed during it. */
  const lockWait = async () => (realLock() ? StoreNative.lockWait().catch(() => 0) : 0)
  /** After 5 wrong tries Java refuses for 30 seconds, also when the app restarts (`waitSeconds`). */
  const checkLock = async (value: string): Promise<LockCheck> =>
    realLock() ? StoreNative.checkLock(value) : { ok: value === (memLock.current?.secret ?? DEMO_SECRET), waitSeconds: 0 }
  const checkRecovery = async (code: string): Promise<LockCheck> =>
    realLock() ? StoreNative.checkRecovery(code) : { ok: normalizeCode(code) === normalizeCode(memLock.current?.recovery ?? DEMO_RECOVERY), waitSeconds: 0 }
  /**
   * Back to where the user was, after the lock screen. If first run was interrupted after the lock
   * was set, it counts as finished: a new recovery code can be made in Settings.
   */
  const unlock = () => (onboarded ? setPhase({ kind: 'app' }) : enterApp())

  /** Adds one record to the manual-fix log. Returns its id, for the Undo that cancels it. */
  const record = (kind: GroupChange['kind'], txId: string, from: string, to: string, undoes: string | null = null, id = changeId()) => {
    setChanges((cs) => [...cs, { id, txId, fromGroupId: from, toGroupId: to, at: Date.now(), kind, undoes }])
    return id
  }

  // Reversible data actions. Each shows an Undo message instead of a dialog.
  const setTxGroup = (ids: string[], to: string, onlyIfIn?: string) =>
    setTxs((ts) => ts.map((t) => (ids.includes(t.id) && (!onlyIfIn || t.groupId === onlyIfIn) ? { ...t, groupId: to } : t)))

  const moveTx = (txId: string, toId: string) => {
    const tx = allTxs.find((t) => t.id === txId)
    if (!tx || tx.groupId === toId) return
    const from = tx.groupId
    setTxGroup([txId], toId)
    const cid = record('manual', txId, from, toId)
    notify(`Moved to ${groupName(toId)}.`, {
      label: 'Undo',
      run: () => {
        setTxGroup([txId], from)
        record('undo', txId, toId, from, cid)
      },
    })
  }

  const createGroupAndMove = (name: string, txId: string) => {
    const tx = allTxs.find((t) => t.id === txId)
    if (!tx) return
    const id = 'g' + Date.now()
    const from = tx.groupId
    setGroups((gs) => [...gs, { id, name: name.trim() }])
    setTxGroup([txId], id)
    const cid = record('manual', txId, from, id)
    notify(`Moved to ${name.trim()}.`, {
      label: 'Undo',
      run: () => {
        setTxGroup([txId], from)
        setGroups((gs) => gs.filter((g) => g.id !== id))
        record('undo', txId, id, from, cid)
      },
    })
  }

  const findGroupByName = (name: string) => allGroups.find((g) => !g.hidden && normalize(g.name) === normalize(name))

  const renameGroup = (id: string, name: string) => {
    const n = name.trim()
    if (!n) return
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, name: n } : g)))
    record('manual', '', id, id)
  }

  const withCode = (code: string, groupId: string | undefined) =>
    setCodes((c) => {
      const next = { ...c }
      if (groupId) next[code] = groupId
      else delete next[code]
      return next
    })

  const applyMerge = (m: Merge) => {
    setTxGroup(m.txIds, m.targetId, m.code ? undefined : m.sourceId)
    setGroups((gs) =>
      gs.map((g) => (g.id === m.sourceId ? { ...g, hidden: true } : g.id === m.targetId ? { ...g, hidden: false } : g)),
    )
    setMerges((ms) => [m, ...ms.filter((x) => x.id !== m.id)])
    if (m.code) withCode(m.code, m.targetId)
  }
  const revertMerge = (undone: Merge) => {
    // Payments added to the merge since it was made (by a scan) are split off too.
    const m = latest.current.merges.find((x) => x.id === undone.id) ?? undone
    setTxGroup(m.txIds, m.sourceId, m.targetId)
    setGroups((gs) =>
      gs.map((g) =>
        g.id === m.sourceId ? { ...g, hidden: false } : g.id === m.createdGroupId ? { ...g, hidden: true } : g,
      ),
    )
    setMerges((ms) => ms.filter((x) => x.id !== m.id))
    if (m.code) withCode(m.code, undefined)
  }

  /** Name a number code, or change what it means. Every payment with that code moves. */
  const assignCode = (code: string, name: string): string | undefined => {
    const n = name.trim()
    const holding = allGroups.find((g) => g.code === code && !g.hidden)
    const existing = findGroupByName(n)
    if (existing?.code) return
    let targetId = existing?.id
    let createdGroupId: string | undefined
    if (!targetId) {
      createdGroupId = 'g' + Date.now()
      targetId = createdGroupId
      const id = createdGroupId
      setGroups((gs) => [...gs, { id, name: n }])
    }
    const to = targetId
    const label = existing?.name ?? n
    const moved = allTxs.filter((t) => t.reference?.trim() === code && t.groupId !== to).map((t) => ({ id: t.id, from: t.groupId }))
    if (holding) {
      const m: Merge = { id: 'm' + Date.now(), sourceId: holding.id, targetId: to, txIds: moved.map((x) => x.id), date: today, code, createdGroupId }
      applyMerge(m)
      record('code', '', holding.id, to, null, 'c:' + m.id)
      notify(`Named code ${code} as ${label}.`, {
        label: 'Undo',
        run: () => {
          revertMerge(m)
          record('undo', '', to, holding.id, 'c:' + m.id)
        },
      })
      return to
    }
    const prev = codes[code]
    const before = new Set(allTxs.map((t) => t.id))
    setTxGroup(
      moved.map((x) => x.id),
      to,
    )
    withCode(code, to)
    const cid = record('code', '', prev ?? '', to)
    notify(prev ? `Code ${code} now counts as ${label}.` : `Code ${code} saved as ${label}.`, {
      label: 'Undo',
      run: () => {
        record('undo', '', to, prev ?? '', cid)
        // A check may have added payments with this code meanwhile. They wait under the code's own
        // group (the one the Java sorter would use), or go back to what it meant before.
        const lateTo = prev ?? `code-${code}`
        const undoOf = { code, to, moved, lateTo, before }
        const late = undoNaming(latest.current.allTxs, undoOf).some((t) => t.groupId === lateTo && !before.has(t.id))
        if (late && !prev) {
          setGroups((gs) =>
            gs.some((g) => g.id === lateTo) ? gs.map((g) => (g.id === lateTo ? { ...g, hidden: false } : g)) : [...gs, { id: lateTo, name: `Code ${code}`, code }],
          )
        }
        setTxs((ts) => undoNaming(ts, undoOf))
        withCode(code, prev)
        if (createdGroupId) setGroups((gs) => gs.filter((g) => g.id !== createdGroupId))
      },
    })
    return to
  }

  /**
   * The treasurer said a number is not a code (an amount like "50", or a long number like 1001).
   * Its payments move to No reference, and later payments with that number go there too.
   */
  const notACode = (code: string) => {
    const holding = allGroups.find((g) => g.code === code && !g.hidden)
    if (!holding) return
    const ids = allTxs.filter((t) => t.groupId === holding.id).map((t) => t.id)
    const m: Merge = { id: 'm' + Date.now(), sourceId: holding.id, targetId: NO_REFERENCE, txIds: ids, date: today, code }
    applyMerge(m)
    record('code', '', holding.id, NO_REFERENCE, null, 'c:' + m.id)
    notify(`${code} is not a code. Its payments are in No reference.`, {
      label: 'Undo',
      run: () => {
        revertMerge(m)
        record('undo', '', NO_REFERENCE, holding.id, 'c:' + m.id)
      },
    })
  }

  /** First-run setup: save several codes at once, quietly. Payments with each number move into its group. */
  const setupCodes = (rows: { code: string; name: string }[]) => {
    let gs = [...allGroups]
    let ts = [...allTxs]
    const cs = { ...codes }
    rows.forEach(({ code, name }, i) => {
      let g = gs.find((x) => !x.hidden && !x.system && !x.code && normalize(x.name) === normalize(name))
      if (!g) {
        g = { id: `g${Date.now()}-${i}`, name: name.trim() }
        gs.push(g)
      }
      const id = g.id
      ts = ts.map((t) => (t.reference?.trim() === code ? { ...t, groupId: id } : t))
      gs = gs.map((x) => (x.code === code ? { ...x, hidden: true } : x))
      cs[code] = id
    })
    setGroups(gs)
    setTxs(ts)
    setCodes(cs)
    setFirstRunCodes((prev) => [...prev.filter((p) => !rows.some((r) => r.code === p.code)), ...rows])
  }

  /** Wordings and number codes that count in a group: "Offertory, 1". */
  const alsoCounted = (id: string) => {
    const words = merges.filter((m) => m.targetId === id && !m.code).map((m) => groupName(m.sourceId))
    const nums = Object.entries(codes)
      .filter(([, g]) => g === id)
      .map(([c]) => c)
      .sort((a, b) => Number(a) - Number(b))
    return [...words, ...nums]
  }

  const mergeGroups = (sourceId: string, targetId: string) => {
    const m: Merge = {
      id: 'm' + Date.now(),
      sourceId,
      targetId,
      txIds: allTxs.filter((t) => t.groupId === sourceId).map((t) => t.id),
      date: today,
    }
    const removed = allSuggestions.filter((s) => [s.keepId, s.mergeId].includes(sourceId))
    // Confirming a suggestion is not a manual fix; merging two groups by hand is.
    const suggested = removed.some((s) => [s.keepId, s.mergeId].includes(targetId))
    applyMerge(m)
    record(suggested ? 'confirmed' : 'manual', '', sourceId, targetId, null, 'c:' + m.id)
    setSuggestions((ss) => ss.filter((s) => !removed.some((r) => r.id === s.id)))
    notify(`Merged ${groupName(sourceId)} into ${groupName(targetId)}.`, {
      label: 'Undo',
      run: () => {
        revertMerge(m)
        record('undo', '', targetId, sourceId, 'c:' + m.id)
        setSuggestions((ss) => [...removed, ...ss.filter((s) => !removed.some((r) => r.id === s.id))])
      },
    })
  }

  const undoMerge = (mergeId: string) => {
    const m = merges.find((x) => x.id === mergeId)
    if (!m) return
    revertMerge(m)
    const cid = record('undo', '', m.targetId, m.sourceId, 'c:' + m.id)
    notify(`Split ${groupName(m.sourceId)} from ${groupName(m.targetId)}.`, {
      label: 'Undo',
      run: () => {
        applyMerge(m)
        record('undo', '', m.sourceId, m.targetId, cid)
      },
    })
  }

  const keepSeparate = (sid: string) => {
    const s = allSuggestions.find((x) => x.id === sid)
    if (!s) return
    const index = allSuggestions.indexOf(s)
    setSuggestions((ss) => ss.filter((x) => x.id !== sid))
    notify(`Kept ${groupName(s.mergeId)} separate.`, {
      label: 'Undo',
      run: () =>
        setSuggestions((ss) => {
          const next = [...ss]
          next.splice(index, 0, s)
          return next
        }),
    })
  }

  const skipUnread = (id: string) => {
    const u = allUnread.find((x) => x.id === id)
    if (!u) return
    setUnread((us) => us.filter((x) => x.id !== id))
    notify('Message skipped.', { label: 'Undo', run: () => setUnread((us) => [u, ...us]) })
  }

  const addSpecial = (s: Omit<Special, 'id'>) => {
    const id = 'sp' + Date.now()
    setSpecials((ss) => [...ss, { ...s, id }])
    setServiceId('sp:' + id)
  }

  /**
   * Reads, sorts and saves the phone's MoMo messages in Java (StoreModule.scan), then shows what
   * changed. The first scan replaces the sample data. A later scan only adds what is new: group
   * names, merges, named codes, moved payments and categories all stay as they are.
   *
   * Waits for pending saves first, so Java sorts against the latest edits.
   */
  const scanMessages = async (opts: { since?: number; onProgress?: (read: number, total: number) => void } = {}): Promise<ScanResult> => {
    if (!canScan) throw new Error('Scanning is off while the developer flows are showing sample data.')
    const saved = await queue.flush()
    setSaveFailed(!saved)
    if (!saved) throw new SaveError()
    const since = opts.since ?? (dataSource === 'messages' ? Math.max(0, newestSms.current - NEW_MESSAGE_OVERLAP_MS) : 0)
    const stop = queue.track()
    let res: NativeScanResult
    let touched = { edited: new Set<string>(), sent: new Set<string>() }
    try {
      res = await StoreNative.scan(since, { useType, firstRunCodes, defaultCategories: DEFAULT_CATEGORIES }, opts.onProgress)
    } finally {
      touched = stop()
    }
    newestSms.current = res.newestSms
    applyScan(res, touched)
    return { messages: res.messages, newPayments: res.newPayments }
  }

  /**
   * `touched.edited`: rows the user changed or removed during the scan (the screen version wins).
   * `touched.sent`: rows the queue sent during the scan; they are not marked saved, so the screen
   * version (with what the scan added) is sent again after Java's write.
   */
  const applyScan = (res: NativeScanResult, touched: { edited: Set<string>; sent: Set<string> }) => {
    const edited = touched.edited
    const unsent = <T extends { id: string }>(rows: T[]) => rows.filter((r) => !touched.sent.has(r.id))
    const ch = res.changed
    const cTxs = (ch.txs ?? []) as Tx[]
    const cGroups = (ch.groups ?? []) as Group[]
    const cMerges = (ch.merges ?? []) as Merge[]
    const cSuggestions = (ch.suggestions ?? []) as Suggestion[]
    const cUnread = (ch.unread ?? []) as Unread[]
    const cCodes = (ch.codes ?? []) as { id: string; code: string; groupId: string }[]
    const cPTxs = (ch.pTxs ?? []) as PTx[]

    if (res.first) {
      const txs = newestFirst([...cTxs])
      const unread = newestFirst([...cUnread])
      const categories = (ch.categories ?? []) as Category[]
      setTxs(txs)
      setGroups(cGroups)
      setMerges(cMerges)
      setSuggestions(cSuggestions)
      setUnread(unread)
      setCodes(Object.fromEntries(cCodes.map((c) => [c.code, c.groupId])))
      setChanges([])
      setSpecials([])
      personal.applyPersonalScan(cPTxs, true, edited, categories)
      // Java saved all of these, and cleared the rest.
      queue.markSaved('church_tx', txs, { replace: true })
      queue.markSaved('church_group', cGroups, { replace: true })
      queue.markSaved('merge_record', cMerges, { replace: true })
      queue.markSaved('suggestion', cSuggestions, { replace: true })
      queue.markSaved('unread', unread, { replace: true })
      queue.markSaved('code_entry', cCodes, { replace: true })
      queue.markSaved('personal_tx', cPTxs, { replace: true })
      queue.markSaved('category', categories, { replace: true })
      for (const t of ['special', 'category_rule', 'nickname', 'group_change']) queue.markSaved(t, [], { replace: true })
      setServiceId('w:' + latestWeekday(phoneToday(), weekly.day))
      setTxFilters({ thisService: true, groupId: null, query: '' })
      setSessionDraft(null)
      setDemo('populated')
      setDataSource('messages')
      return
    }

    // New payments in a group merged on screen while the scan ran follow that merge.
    const now = latest.current
    const have = new Set(now.allTxs.map((t) => t.id))
    const settled = settleNew(cTxs.filter((t) => !have.has(t.id)), now.allGroups, now.merges)
    const settledTx = new Map(settled.txs.map((t) => [t.id, t]))
    const grown = new Map(settled.merges.filter((m, i) => m !== now.merges[i]).map((m) => [m.id, m]))
    // What Java saved is marked saved; the settled versions differ, so the queue saves them.
    queue.markSaved('church_tx', unsent(cTxs))
    queue.markSaved('church_group', unsent(cGroups))
    queue.markSaved('merge_record', unsent(cMerges))
    queue.markSaved('suggestion', unsent(cSuggestions))
    queue.markSaved('unread', unsent(cUnread))
    queue.markSaved('code_entry', unsent(cCodes))
    queue.markSaved('personal_tx', unsent(cPTxs))
    if (cTxs.length) setTxs((ts) => newestFirst(mergeScan(ts, cTxs.map((t) => settledTx.get(t.id) ?? t), edited)))
    if (cGroups.length) setGroups((gs) => mergeScan(gs, cGroups, edited, 'end'))
    if (cMerges.length || grown.size) setMerges((ms) => mergeScan(ms.map((m) => grown.get(m.id) ?? m), cMerges, edited, 'end'))
    if (cSuggestions.length) setSuggestions((ss) => mergeScan(ss, cSuggestions, edited, 'end'))
    if (cUnread.length) setUnread((us) => newestFirst(mergeScan(us, cUnread, edited)))
    if (cCodes.length) setCodes((c) => ({ ...c, ...Object.fromEntries(cCodes.filter((x) => !edited.has(x.id)).map((x) => [x.code, x.groupId])) }))
    personal.applyPersonalScan(cPTxs, false, edited)
  }

  /** Puts what was saved on this phone on screen, and decides where the app opens. */
  const hydrate = (snap: Snapshot) => {
    const st = snap.settings
    const get = <T,>(kind: string) => (snap.lists[kind] ?? []) as T[]
    if (st.useType) setUseType(st.useType as UseType)
    if (st.themePref) setThemePref(st.themePref as ThemePref)
    if (st.exportPrefs) setExportPrefs(st.exportPrefs as ExportPrefs)
    if (st.pExportPrefs) personal.setPExportPrefs(st.pExportPrefs as PExportPrefs)
    if (st.periodId) personal.setPeriodId(st.periodId as PeriodId)
    if (st.weekly) setWeekly(st.weekly as Weekly)
    if (Array.isArray(st.firstRunCodes)) setFirstRunCodes(st.firstRunCodes as CodeName[])
    const done = st.onboarded === true
    setOnboarded(done)
    const messages = st.dataSource === 'messages'
    if (messages) {
      const txs = newestFirst(get<Tx>('church_tx'))
      const unread = newestFirst(get<Unread>('unread'))
      const codeList = get<{ id: string; code: string; groupId: string }>('code_entry')
      const nicknames = get<{ id: string; personKey: string; nickname: string }>('nickname')
      setTxs(txs)
      setGroups(get<Group>('church_group'))
      setMerges(get<Merge>('merge_record'))
      setSuggestions(get<Suggestion>('suggestion'))
      setUnread(unread)
      setSpecials(get<Special>('special'))
      setCodes(Object.fromEntries(codeList.map((c) => [c.code, c.groupId])))
      setChanges(get<GroupChange>('group_change'))
      personal.hydratePersonal({
        pTxs: get<PTx>('personal_tx'),
        categories: get<Category>('category'),
        rules: get<CategoryRule>('category_rule'),
        nicknames: Object.fromEntries(nicknames.map((n) => [n.personKey, n.nickname])),
      })
      for (const kind of ['church_group', 'merge_record', 'suggestion', 'special', 'code_entry', 'personal_tx', 'category', 'category_rule', 'nickname', 'group_change']) {
        queue.markSaved(kind, get<{ id: string }>(kind), { replace: true })
      }
      queue.markSaved('church_tx', txs, { replace: true })
      queue.markSaved('unread', unread, { replace: true })
      if (typeof st.serviceId === 'string') setServiceId(st.serviceId)
      newestSms.current = typeof st.newestSms === 'number' ? st.newestSms : 0
      setDataSource('messages')
    }
    if (snap.lock) setLock(snap.lock)
    // A saved lock always comes first, even when first run was interrupted after it was set.
    setStack([{ name: 'home' }])
    setPhase(launchPhase({ onboarded: done, messages, lock: !!snap.lock }))
  }

  useEffect(() => {
    if (!StoreNative.available()) return
    let alive = true
    StoreNative.load()
      .then((snap) => alive && hydrate(snap))
      .catch(() => {
        // Never write over data that could not be read: run on sample data for this session.
        if (!alive) return
        setSampleMode(true)
        notify("Couldn't load your data. Restart the app to try again.")
      })
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
    // Once, at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetData = () => {
    const s = seed()
    setTxs(s.txs)
    setGroups(s.groups)
    setMerges(s.merges)
    setSuggestions(s.suggestions)
    setUnread(s.unread)
    setSpecials(s.specials)
    setWeekly(s.weekly)
    setCodes(s.codes)
    setDataSource('sample')
    setFirstRunCodes([])
    setChanges([])
    newestSms.current = 0
    setServiceId(DEFAULT_SERVICE)
    setTxFilters({ thisService: true, groupId: null, query: '' })
    setSessionDraft(null)
    personal.resetPersonal()
  }

  /** Back to a new install, in memory. */
  const resetAll = () => {
    resetData()
    setOnboarded(false)
    memLock.current = null
    setLock(null)
    setUseType('church')
    setCoachStep(null)
    setSnack(null)
    setExportPrefs({ format: 'pdf', hideMembers: false, fields: [...EXPORT_FIELDS] })
    setStack([{ name: 'home' }])
    setPhase({ kind: 'onboarding', step: 'welcome' })
  }

  /** The last-resort erase (Settings, or a lost lock and code): the saved data goes too. */
  const eraseAll = () => {
    resetAll()
    if (StoreNative.available() && !sampleMode) {
      StoreNative.eraseAll().catch(() => notify("Couldn't erase. Try again."))
      FingerprintNative.disable().catch(() => {})
    }
  }

  const enterApp = (tab: Tab = 'home') => {
    setStack([{ name: tab }])
    setPhase({ kind: 'app' })
    setOnboarded(true)
  }

  const jumpFlow = (flow: 1 | 2 | 3 | 4 | 5 | 6) => {
    setSnack(null)
    setCoachStep(null)
    // The flows run on sample data; saved data is left untouched until the app restarts.
    setSampleMode(true)
    if (flow === 1) return resetAll()
    if (flow === 5) {
      setLock(DEMO_LOCK)
      memLock.current = { secret: DEMO_SECRET, recovery: DEMO_RECOVERY }
      setPhase({ kind: 'locked', step: 'lock' })
      return
    }
    if (flow === 2 || flow === 6) resetData()
    if (flow === 3) setTxFilters({ thisService: true, groupId: null, query: '' })
    enterApp(flow === 2 || flow === 6 ? 'home' : flow === 3 ? 'transactions' : 'export')
  }

  return {
    ...personal,
    themePref,
    setThemePref,
    theme,
    motion,
    setMotion,
    demo,
    setDemo,
    phase,
    setPhase,
    stack,
    route,
    push,
    back,
    replace,
    setTab,
    enterApp,
    jumpFlow,
    eraseAll,
    today,
    dataSource,
    ready,
    sampleMode,
    canScan,
    scanMessages,
    changes,
    txs,
    allTxs,
    groups,
    allGroups,
    merges,
    suggestions,
    unread,
    pendingCodes,
    codes,
    assignCode,
    notACode,
    setupCodes,
    alsoCounted,
    specials,
    weekly,
    setWeekly,
    services,
    service,
    serviceId,
    setServiceId,
    serviceInfo,
    serviceOfTx,
    txsIn,
    groupName,
    findGroupByName,
    moveTx,
    createGroupAndMove,
    renameGroup,
    mergeGroups,
    undoMerge,
    keepSeparate,
    skipUnread,
    addSpecial,
    lock,
    saveLock,
    saveRecovery,
    fingerprintStatus,
    setFingerprint,
    checkFingerprint,
    lockWait,
    checkLock,
    checkRecovery,
    newRecoveryCode,
    unlock,
    useType,
    setUseType,
    coachStep,
    setCoachStep,
    snack,
    setSnack,
    notify,
    exportPrefs,
    setExportPrefs,
    txFilters,
    setTxFilters,
    sessionDraft,
    setSessionDraft,
  }
}

export type AppState = ReturnType<typeof useAppState>
const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppState()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}
