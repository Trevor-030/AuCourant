import { useCallback, useMemo, useRef, useState } from 'react'
import { categoriseAll } from './categorise'
import { plural } from './format'
import { mergeScan } from './persist'
import { mergeCategories, mergePeople, refundsByPayment, separatePeople, type PersonMerge } from './personal-merge'
import { periodInfo, type PeriodId } from './periods'
import type { ReportFormat } from './report'
import { DEFAULT_CATEGORIES, SEED_RULES, seedPersonalTxs, type Category, type CategoryRule, type Direction, type PTx } from './personal-data'
import type { Snack } from './store'

/**
 * State and actions for the Personal or business use type, spread into the app store.
 * Same promise as church: every change can be undone, and the app never learns a rule
 * the user did not confirm.
 */

export type PFilters = {
  inPeriod: boolean
  dir: Direction | null
  /** A category id, 'none' for Uncategorised, or null for all. */
  categoryId: string | null
  personKey: string | null
  query: string
}
export const CLEAR_PFILTERS: PFilters = { inPeriod: true, dir: null, categoryId: null, personKey: null, query: '' }

export const P_EXPORT_FIELDS = ['Date', 'Time', 'Direction', 'Type', 'Amount', 'Fee', 'Category', 'Person', 'Number', 'Note', 'Transaction ID'] as const
export type PExportField = (typeof P_EXPORT_FIELDS)[number]
/** Left out when "Hide names and numbers" is on. */
export const P_NAME_FIELDS: PExportField[] = ['Person', 'Number']
export type PExportPrefs = { format: ReportFormat; hideNames: boolean; fields: PExportField[] }
const DEFAULT_PEXPORT: PExportPrefs = { format: 'pdf', hideNames: false, fields: [...P_EXPORT_FIELDS] }

export type Person = { key: string; name: string; phone: string | null; nickname: string | null }
export { totalsOf, type Totals } from './personal-merge'

function seed() {
  return { txs: categoriseAll(seedPersonalTxs(), SEED_RULES), rules: [...SEED_RULES], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) }
}

type Notify = (message: string, action?: Snack['action']) => void

const newestFirst = (list: PTx[]) => list.sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))

export function usePersonalState({ notify, empty, today }: { notify: Notify; empty: boolean; today: string }) {
  const [initial] = useState(seed)
  const [allPTxs, setPTxs] = useState<PTx[]>(initial.txs)
  const [rules, setRules] = useState<CategoryRule[]>(initial.rules)
  /** The latest rules, for a scan that started before the last change to them. */
  const latestRules = useRef(rules)
  latestRules.current = rules
  const [allCategories, setCategories] = useState<Category[]>(initial.categories)
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [personMerges, setPersonMerges] = useState<PersonMerge[]>([])
  // Remembered between visits (architecture-personal.md, Settings).
  const [periodId, setPeriodId] = useState<PeriodId>('month')
  const [pFilters, setPFilters] = useState<PFilters>(CLEAR_PFILTERS)
  const [pExportPrefs, setPExportPrefs] = useState<PExportPrefs>(DEFAULT_PEXPORT)

  const pTxs = empty ? [] : allPTxs
  /** What has been given back on each payment, from every payment, so totals in any period net it off. */
  const refunds = useMemo(() => refundsByPayment(pTxs), [pTxs])
  const period = periodInfo(periodId, today)
  const pTxsIn = useCallback((id: PeriodId) => {
    const p = periodInfo(id, today)
    return pTxs.filter((t) => t.date >= p.from && t.date <= p.to)
  }, [pTxs, today])
  const categories = useMemo(() => allCategories.filter((c) => !c.hidden), [allCategories])
  const categoryName = useCallback((id: string | null) => (id ? (allCategories.find((c) => c.id === id)?.name ?? 'Unknown category') : 'Uncategorised'), [allCategories])

  const people = useMemo(() => {
    const m = new Map<string, Person>()
    // Newest first, so the name is the last one seen.
    for (const t of [...allPTxs].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))) {
      if (!m.has(t.personKey)) m.set(t.personKey, { key: t.personKey, name: t.name, phone: t.phone, nickname: nicknames[t.personKey] ?? null })
    }
    return m
  }, [allPTxs, nicknames])
  const personName = useCallback((key: string) => {
    const p = people.get(key)
    return p ? (p.nickname ?? p.name) : 'Unknown'
  }, [people])

  // ---- Categories on payments --------------------------------------------------

  const restore = (snapshot: PTx[]) => {
    const byId = new Map(snapshot.map((t) => [t.id, t]))
    setPTxs((ts) => ts.map((t) => byId.get(t.id) ?? t))
  }

  /**
   * Puts one payment in a category, then offers to move the other payments with the same
   * person. A rule is only created when the user taps "Move them".
   */
  const setCategory = (txId: string, categoryId: string | null, label?: string) => {
    const tx = allPTxs.find((t) => t.id === txId)
    if (!tx || (tx.categoryId === categoryId && tx.catSource === 'manual')) return
    const before = [tx]
    setPTxs((ts) => ts.map((t) => (t.id === txId ? { ...t, categoryId, catSource: 'manual' } : t)))
    // A category made a moment ago is not in state yet, so its name can be passed in.
    const to = label ?? categoryName(categoryId)
    const others = categoryId ? allPTxs.filter((t) => t.id !== txId && t.personKey === tx.personKey && t.categoryId !== categoryId && t.catSource !== 'manual') : []
    if (others.length === 0 || !categoryId) {
      notify(`Moved to ${to}.`, { label: 'Undo', run: () => restore(before) })
      return
    }
    const who = personName(tx.personKey)
    notify(`Moved to ${to}. Also move ${plural(others.length, 'other payment')} with ${who}?`, {
      label: 'Move them',
      run: () => {
        const prevRules = rules
        const rule: CategoryRule = { id: 'r' + Date.now(), kind: 'person', value: tx.personKey, label: tx.name, categoryId }
        const nextRules = [rule, ...rules.filter((r) => !(r.kind === 'person' && r.value === tx.personKey))]
        setRules(nextRules)
        setPTxs((ts) => categoriseAll(ts, nextRules))
        // Shown after the current message closes.
        setTimeout(
          () =>
            notify(`Moved ${plural(others.length + 1, 'payment')} to ${to}. New payments with ${who} go there too.`, {
              label: 'Undo',
              run: () => {
                setRules(prevRules)
                restore([...before, ...others])
              },
            }),
          0,
        )
      },
    })
  }

  // ---- Managing categories and rules -------------------------------------------

  const findCategoryByName = (name: string) => allCategories.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())

  const addCategory = (name: string): string | undefined => {
    const n = name.trim()
    if (!n || findCategoryByName(n)) return
    const id = 'c' + Date.now()
    setCategories((cs) => [...cs, { id, name: n }])
    notify(`Added ${n}.`, { label: 'Undo', run: () => setCategories((cs) => cs.filter((c) => c.id !== id)) })
    return id
  }

  const renameCategory = (id: string, name: string) => {
    const n = name.trim()
    const prev = allCategories.find((c) => c.id === id)
    if (!n || !prev || prev.name === n) return
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name: n } : c)))
    notify(`Renamed ${prev.name} to ${n}.`, { label: 'Undo', run: () => setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name: prev.name } : c))) })
  }

  /** Hidden categories leave the lists and pickers. Their payments keep the category. */
  const setCategoryHidden = (id: string, hidden: boolean) => {
    const c = allCategories.find((x) => x.id === id)
    if (!c) return
    setCategories((cs) => cs.map((x) => (x.id === id ? { ...x, hidden } : x)))
    notify(hidden ? `${c.name} hidden.` : `${c.name} shown again.`, {
      label: 'Undo',
      run: () => setCategories((cs) => cs.map((x) => (x.id === id ? { ...x, hidden: !hidden } : x))),
    })
  }

  const moveCategory = (id: string, by: -1 | 1) =>
    setCategories((cs) => {
      const i = cs.findIndex((c) => c.id === id)
      const j = i + by
      if (i < 0 || j < 0 || j >= cs.length) return cs
      const next = [...cs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  /** Payments already placed by the rule stay where they are; only future ones are affected. */
  const deleteRule = (id: string) => {
    const r = rules.find((x) => x.id === id)
    if (!r) return
    const index = rules.indexOf(r)
    setRules((rs) => rs.filter((x) => x.id !== id))
    notify('Rule removed. Payments it already moved stay where they are.', {
      label: 'Undo',
      run: () =>
        setRules((rs) => {
          const next = [...rs]
          next.splice(index, 0, r)
          return next
        }),
    })
  }

  const setNickname = (key: string, nickname: string) => {
    const prev = nicknames[key]
    const n = nickname.trim()
    const apply = (v: string | undefined) =>
      setNicknames((m) => {
        const next = { ...m }
        if (v) next[key] = v
        else delete next[key]
        return next
      })
    apply(n || undefined)
    notify(n ? `Nickname saved: ${n}.` : 'Nickname removed.', { label: 'Undo', run: () => apply(prev) })
  }

  /** What was saved on this phone, at launch. */
  // ---- Merging people and categories, refunds (docs/superpowers/specs/2026-11-24-personal-merge-design.md)

  /** Person `fromKey` becomes `toKey`, shown as `keepName`. New messages from either number follow (the scan reads the record). */
  const mergePerson = (fromKey: string, toKey: string, keepName: string) => {
    if (fromKey === toKey) return
    const fromName = personName(fromKey)
    const moved = allPTxs.filter((t) => t.personKey === fromKey)
    const prevRules = rules
    const prevNicknames = nicknames
    const s = mergePeople({ txs: allPTxs, rules, nicknames }, { id: 'pm' + Date.now(), fromKey, toKey, keepName, date: today })
    setPTxs(s.txs)
    setRules(s.rules)
    setNicknames(s.nicknames)
    setPersonMerges((ms) => [s.record, ...ms])
    notify(`Merged ${fromName} into ${keepName}.`, {
      label: 'Undo',
      run: () => {
        restore(moved)
        setRules(prevRules)
        setNicknames(prevNicknames)
        setPersonMerges((ms) => ms.filter((m) => m.id !== s.record.id))
      },
    })
  }

  /** Undoes a person merge, any time later. */
  const separatePerson = (recordId: string) => {
    const r = personMerges.find((m) => m.id === recordId)
    if (!r) return
    const s = separatePeople({ txs: allPTxs, rules, nicknames }, r)
    setPTxs(s.txs)
    setNicknames(s.nicknames)
    setPersonMerges((ms) => ms.filter((m) => m.id !== recordId))
    notify(`Separated ${personName(r.fromKey)} again.`)
  }

  /** Category `fromId` goes into `toId`; built-in categories cannot be merged away. Undo only from the message. */
  const mergeCategory = (fromId: string, toId: string) => {
    const s = mergeCategories({ txs: allPTxs, rules, categories: allCategories }, fromId, toId)
    if (!s) return
    const moved = allPTxs.filter((t) => t.categoryId === fromId)
    const prevRules = rules
    const prevCategories = allCategories
    const fromName = categoryName(fromId)
    setPTxs(s.txs)
    setRules(s.rules)
    setCategories(s.categories)
    notify(`Merged ${fromName} into ${categoryName(toId)}.`, {
      label: 'Undo',
      run: () => {
        setCategories(prevCategories)
        setRules(prevRules)
        restore(moved)
      },
    })
  }

  /** Marks money received as giving back another payment, or (null) not a refund. */
  const setRefundOf = (txId: string, refundOf: string | null) => {
    const tx = allPTxs.find((t) => t.id === txId)
    if (!tx || (tx.refundOf ?? null) === refundOf) return
    setPTxs((ts) => ts.map((t) => (t.id === txId ? { ...t, refundOf } : t)))
    notify(refundOf ? 'Marked as a refund.' : 'No longer counted as a refund.', { label: 'Undo', run: () => restore([tx]) })
  }

  const hydratePersonal = (saved: { pTxs: PTx[]; categories: Category[]; rules: CategoryRule[]; nicknames: Record<string, string>; personMerges: PersonMerge[] }) => {
    setPTxs(newestFirst(saved.pTxs))
    setCategories(saved.categories.length ? saved.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })))
    setRules(saved.rules)
    setNicknames(saved.nicknames)
    setPersonMerges(saved.personMerges)
  }

  /**
   * Payments a scan read and categorised in Java. The first scan replaces the sample data and its
   * made-up rules. Later scans only add or update payments, and a payment the user changed while
   * the scan ran keeps the user's version. Java read the rules when the scan started, so they run
   * once more here in case one was added since.
   */
  const applyPersonalScan = (read: PTx[], first: boolean, touched: Set<string>, categories?: Category[]) => {
    if (first) {
      setRules([])
      setNicknames({})
      setPersonMerges([])
      setCategories(categories?.length ? categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })))
      setPeriodId('month')
      setPFilters(CLEAR_PFILTERS)
      setPTxs(newestFirst([...read]))
      return
    }
    const placed = categoriseAll(read, latestRules.current)
    if (placed.length) setPTxs((ts) => newestFirst(mergeScan(ts, placed, touched)))
  }

  const resetPersonal = () => {
    const s = seed()
    setPTxs(s.txs)
    setRules(s.rules)
    setCategories(s.categories)
    setNicknames({})
    setPersonMerges([])
    setPeriodId('month')
    setPFilters(CLEAR_PFILTERS)
    setPExportPrefs(DEFAULT_PEXPORT)
  }

  return {
    nicknames,
    pTxs,
    refunds,
    allPTxs,
    pTxsIn,
    period,
    periodId,
    setPeriodId,
    pFilters,
    setPFilters,
    pExportPrefs,
    setPExportPrefs,
    categories,
    allCategories,
    categoryName,
    findCategoryByName,
    rules,
    people,
    personName,
    setCategory,
    addCategory,
    renameCategory,
    setCategoryHidden,
    moveCategory,
    deleteRule,
    setNickname,
    personMerges,
    mergePerson,
    separatePerson,
    mergeCategory,
    setRefundOf,
    hydratePersonal,
    applyPersonalScan,
    resetPersonal,
  }
}
