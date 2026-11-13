import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  type ExportField,
  type Group,
  type Merge,
  type Special,
  type Suggestion,
  type Tx,
  type Unread,
  type Weekly,
} from './data'
import { DAYS, TODAY, addDays, inWindow, longDate, normalize, shortDate, toMin, weekdayOf } from './format'
import { usePersonalState } from './personal'

export type ThemePref = 'dark' | 'light' | 'system'
export type Motion = 'full' | 'reduced'
export type Demo = 'populated' | 'loading' | 'empty' | 'error'
export type LockType = 'pin4' | 'pin6' | 'password'
export type Lock = { type: LockType; secret: string; fingerprint: boolean; recovery: string }
export type UseType = 'church' | 'organisation' | 'personal'
export type OnbStep = 'welcome' | 'use-type' | 'ref-numbers' | 'permission' | 'denied' | 'scanning' | 'complete' | 'lock-setup' | 'recovery' | 'fingerprint'
export type Phase =
  | { kind: 'onboarding'; step: OnbStep }
  | { kind: 'locked'; step: 'lock' | 'reset' | 'new-lock' | 'new-recovery' }
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
export type ExportPrefs = { format: 'pdf' | 'csv'; hideMembers: boolean; fields: ExportField[] }
export type TxFilters = { thisService: boolean; groupId: string | null; query: string }
export type SessionDraft = { name: string; date: string; start: string; end: string }

export const DEMO_LOCK: Lock = { type: 'pin4', secret: '1234', fingerprint: false, recovery: 'K7M2-9QXA-4TNR' }
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
  const personal = usePersonalState({ notify, empty })
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
        .map((g) => ({ group: g, code: g.code!, ...statsOf(txs.filter((t) => t.groupId === g.id)) }))
        .filter((c) => c.count > 0),
    [groups, txs],
  )

  const groupName = useCallback((id: string) => allGroups.find((g) => g.id === id)?.name ?? 'Unknown group', [allGroups])

  // Services: weekly instances, special sessions sit beside their day.
  const services = useMemo<Service[]>(() => {
    const list: Service[] = []
    let d = TODAY
    while (weekdayOf(d) !== weekly.day) d = addDays(d, -1)
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
  }, [weekly, specials, useType])

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

  // Reversible data actions. Each shows an Undo message instead of a dialog.
  const setTxGroup = (ids: string[], to: string, onlyIfIn?: string) =>
    setTxs((ts) => ts.map((t) => (ids.includes(t.id) && (!onlyIfIn || t.groupId === onlyIfIn) ? { ...t, groupId: to } : t)))

  const moveTx = (txId: string, toId: string) => {
    const tx = allTxs.find((t) => t.id === txId)
    if (!tx || tx.groupId === toId) return
    const from = tx.groupId
    setTxGroup([txId], toId)
    notify(`Moved to ${groupName(toId)}.`, { label: 'Undo', run: () => setTxGroup([txId], from) })
  }

  const createGroupAndMove = (name: string, txId: string) => {
    const tx = allTxs.find((t) => t.id === txId)
    if (!tx) return
    const id = 'g' + Date.now()
    const from = tx.groupId
    setGroups((gs) => [...gs, { id, name: name.trim() }])
    setTxGroup([txId], id)
    notify(`Moved to ${name.trim()}.`, {
      label: 'Undo',
      run: () => {
        setTxGroup([txId], from)
        setGroups((gs) => gs.filter((g) => g.id !== id))
      },
    })
  }

  const findGroupByName = (name: string) => allGroups.find((g) => !g.hidden && normalize(g.name) === normalize(name))

  const renameGroup = (id: string, name: string) => {
    const n = name.trim()
    if (!n) return
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, name: n } : g)))
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
  const revertMerge = (m: Merge) => {
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
      const m: Merge = { id: 'm' + Date.now(), sourceId: holding.id, targetId: to, txIds: moved.map((x) => x.id), date: TODAY, code, createdGroupId }
      applyMerge(m)
      notify(`Named code ${code} as ${label}.`, { label: 'Undo', run: () => revertMerge(m) })
      return to
    }
    const prev = codes[code]
    setTxGroup(
      moved.map((x) => x.id),
      to,
    )
    withCode(code, to)
    notify(prev ? `Code ${code} now counts as ${label}.` : `Code ${code} saved as ${label}.`, {
      label: 'Undo',
      run: () => {
        setTxs((ts) => ts.map((t) => ({ ...t, groupId: moved.find((x) => x.id === t.id)?.from ?? t.groupId })))
        withCode(code, prev)
        if (createdGroupId) setGroups((gs) => gs.filter((g) => g.id !== createdGroupId))
      },
    })
    return to
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
      date: TODAY,
    }
    const removed = allSuggestions.filter((s) => [s.keepId, s.mergeId].includes(sourceId))
    applyMerge(m)
    setSuggestions((ss) => ss.filter((s) => !removed.some((r) => r.id === s.id)))
    notify(`Merged ${groupName(sourceId)} into ${groupName(targetId)}.`, {
      label: 'Undo',
      run: () => {
        revertMerge(m)
        setSuggestions((ss) => [...removed, ...ss.filter((s) => !removed.some((r) => r.id === s.id))])
      },
    })
  }

  const undoMerge = (mergeId: string) => {
    const m = merges.find((x) => x.id === mergeId)
    if (!m) return
    revertMerge(m)
    notify(`Split ${groupName(m.sourceId)} from ${groupName(m.targetId)}.`, { label: 'Undo', run: () => applyMerge(m) })
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
    setServiceId(DEFAULT_SERVICE)
    setTxFilters({ thisService: true, groupId: null, query: '' })
    setSessionDraft(null)
    personal.resetPersonal()
  }

  const eraseAll = () => {
    resetData()
    setLock(null)
    setUseType('church')
    setCoachStep(null)
    setSnack(null)
    setExportPrefs({ format: 'pdf', hideMembers: false, fields: [...EXPORT_FIELDS] })
    setStack([{ name: 'home' }])
    setPhase({ kind: 'onboarding', step: 'welcome' })
  }

  const enterApp = (tab: Tab = 'home') => {
    setStack([{ name: tab }])
    setPhase({ kind: 'app' })
  }

  const jumpFlow = (flow: 1 | 2 | 3 | 4 | 5 | 6) => {
    setSnack(null)
    setCoachStep(null)
    if (flow === 1) return eraseAll()
    if (flow === 5) {
      if (!lock) setLock(DEMO_LOCK)
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
    setLock,
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
