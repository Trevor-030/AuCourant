import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Constants from 'expo-constants'
import { useApp, type Demo, type Motion, type SessionDraft } from '../lib/store'
import { DAYS, TODAY, addDays, plural, shortDate, toMin, weekdayOf } from '../lib/format'
import { RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, AppIcon, Button, Divided, EmptyState, RadioRow, Row, SectionLabel, Surface, SwitchRow, T, TextField } from '../ui/kit'
import { CaretRightIcon, GitMergeIcon, TrashIcon } from '../ui/icons'
import { Body, Footer } from '../ui/layout'
import { Dialog, Sheet } from '../ui/overlays'
import { DateField, PickerField, TimeField } from '../ui/pickers'
import { NativeMissingError, SmsNative, type ParsedType } from '../native'
import { lockTypeLabel } from './lock'
import { UseTypeSheet, useTypeLabel } from './usetype'

function Caret() {
  const { c } = useTheme()
  return <CaretRightIcon size={20} color={c.fg2} />
}

export function Settings() {
  const { back, push, themePref, setThemePref, lock, setLock, weekly, eraseAll, codes, pendingCodes, useType, rules } = useApp()
  const [del, setDel] = useState(false)
  const [usedFor, setUsedFor] = useState(false)
  const org = useType === 'organisation'
  const personal = useType === 'personal'
  return (
    <>
      <AppBar title="Settings" onBack={back} />
      <Body padBottom={32}>
        <View style={{ gap: 24 }}>
          <View>
            <SectionLabel>{personal ? 'Use' : org ? 'Periods' : 'Services'}</SectionLabel>
            <Surface divided>
              <Row title="Used for" sub={useTypeLabel(useType)} trailing={<Caret />} onPress={() => setUsedFor(true)} />
              {personal ? (
                <Row title="Categories and rules" sub={plural(rules.length, 'rule')} trailing={<Caret />} onPress={() => push({ name: 'manage-categories' })} />
              ) : (
              <Row
                title={org ? 'Weekly meeting' : 'Weekly service'}
                sub={`${DAYS[weekly.day]}, ${weekly.start} to ${weekly.end}`}
                trailing={<Caret />}
                onPress={() => push({ name: 'weekly-service' })}
              />
              )}
            </Surface>
          </View>

          <View>
            <SectionLabel>Appearance</SectionLabel>
            <Surface>
              <View accessibilityRole="radiogroup" accessibilityLabel="Appearance">
                <Divided>
                  <RadioRow label="Dark" checked={themePref === 'dark'} onSelect={() => setThemePref('dark')} />
                  <RadioRow label="Light" checked={themePref === 'light'} onSelect={() => setThemePref('light')} />
                  <RadioRow label="Match phone" checked={themePref === 'system'} onSelect={() => setThemePref('system')} />
                </Divided>
              </View>
            </Surface>
          </View>

          <View>
            <SectionLabel>App lock</SectionLabel>
            <Surface divided>
              {lock ? (
                <>
                  <Row title="Lock type" sub={lockTypeLabel(lock.type)} trailing={<Caret />} onPress={() => push({ name: 'lock-change' })} />
                  <Row title="Change PIN or password" trailing={<Caret />} onPress={() => push({ name: 'lock-change' })} />
                  <SwitchRow label="Use fingerprint" sub="Your PIN or password still works." checked={lock.fingerprint} onChange={(v) => setLock({ ...lock, fingerprint: v })} />
                </>
              ) : (
                <Row title="Set up lock" sub="The app opens without a lock now." trailing={<Caret />} onPress={() => push({ name: 'lock-change' })} />
              )}
            </Surface>
          </View>

          <View>
            <SectionLabel>Recovery code</SectionLabel>
            <Surface style={{ padding: 16 }}>
              <T v="sec" tone="fg2">
                {lock ? 'Use it if you forget your PIN or password. A new code stops the old one working.' : 'Set up a lock first. A recovery code is made with it.'}
              </T>
              {lock && (
                <Button variant="secondary" full style={{ marginTop: 16 }} onPress={() => push({ name: 'verify-lock' })}>
                  Make a new recovery code
                </Button>
              )}
            </Surface>
          </View>

          <View>
            <SectionLabel>Data</SectionLabel>
            <Surface divided>
              {!personal && (
              <Row
                title="Reference codes"
                sub={pendingCodes.length ? `${plural(Object.keys(codes).length, 'code')} named, ${pendingCodes.length} to name` : `${plural(Object.keys(codes).length, 'code')} named`}
                trailing={<Caret />}
                onPress={() => push({ name: 'reference-codes' })}
              />
              )}
              {!personal && <Row title="Merge history" trailing={<Caret />} onPress={() => push({ name: 'merge-history' })} />}
              <Row title="Scan messages again" sub="Finds payments that arrived while the app was closed." trailing={<Caret />} onPress={() => push({ name: 'rescan' })} />
              <Row title="Networks supported" end="MTN" endTone="fg2" />
              <Row leading={<AppIcon size={32} />} title="About AuCourant" sub="Stay au courant with your MoMo." end={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`} endTone="fg2" />
            </Surface>
          </View>

          <Surface>
            <Row title="Delete all data" titleTone="error" leading={<TrashIconError />} onPress={() => setDel(true)} />
          </Surface>

          {__DEV__ && <DeveloperSection />}
        </View>
      </Body>
      <UseTypeSheet open={usedFor} onClose={() => setUsedFor(false)} />
      <Dialog
        open={del}
        onCancel={() => setDel(false)}
        title="Delete all AuCourant data from this phone?"
        body="Reports you exported stay in your files."
        confirmLabel="Delete data"
        onConfirm={() => {
          setDel(false)
          eraseAll()
        }}
      />
    </>
  )
}

function TrashIconError() {
  const { c } = useTheme()
  return <TrashIcon size={20} color={c.error} />
}

const FLOWS = [
  { n: 1, title: 'First run', body: 'Welcome to Home, with lock and recovery code' },
  { n: 2, title: 'Review merges', body: 'Home, Review now, confirm a merge, Undo' },
  { n: 3, title: 'Fix one payment', body: 'Transactions, payment detail, Change group' },
  { n: 4, title: 'Export', body: 'Export tab with defaults, Customize fields, Share file' },
  { n: 5, title: 'Forgot lock', body: 'Lock screen, recovery code, new lock (demo PIN 1234)' },
  { n: 6, title: 'Name a code', body: 'Home, Review now, Codes tab, Name this code, Undo' },
] as const

/** Developer builds only: the Figma prototype's side panel (flows, screen states, motion). */
function DeveloperSection() {
  const s = useStyles()
  const { c } = useTheme()
  const { jumpFlow, demo, setDemo, motion, setMotion } = useApp()
  const seg = <V extends string>(value: V, set: (v: V) => void, opts: [V, string][]) => (
    <View style={s.seg}>
      {opts.map(([v, l]) => (
        <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: value === v }} onPress={() => set(v)} style={[s.segItem, value === v && { backgroundColor: c.inset }]}>
          <T v="sec" w="medium" tone={value === v ? 'accent' : 'fg2'} numberOfLines={1}>
            {l}
          </T>
        </Pressable>
      ))}
    </View>
  )
  return (
    <View style={{ gap: 16 }}>
      <SectionLabel>Developer (dev builds only)</SectionLabel>
      <Surface divided>
        {FLOWS.map((f) => (
          <Row key={f.n} leading={<T v="sec" w="medium" tone="accent" num>{`F${f.n}`}</T>} title={f.title} sub={f.body} onPress={() => jumpFlow(f.n)} />
        ))}
      </Surface>
      <View>
        <T v="sec" tone="fg2" style={{ marginBottom: 8 }}>
          Screen state
        </T>
        {seg<Demo>(demo, setDemo, [
          ['populated', 'Populated'],
          ['loading', 'Loading'],
          ['empty', 'Empty'],
          ['error', 'Error'],
        ])}
        <T v="meta" tone="fg3" style={{ marginTop: 8 }}>
          Loading and Empty apply to Home, Groups and Transactions. Error applies to the inbox scan and to Export.
        </T>
      </View>
      <View>
        <T v="sec" tone="fg2" style={{ marginBottom: 8 }}>
          Motion
        </T>
        {seg<Motion>(motion, setMotion, [
          ['full', 'Full'],
          ['reduced', 'Reduced'],
        ])}
      </View>
      <ParseInbox />
    </View>
  )
}

type ParseResult = { total: number; byType: [ParsedType, number][]; partial: number; samples: string[] }

/**
 * Spike 1 helper (architecture-personal.md): reads the real inbox, runs the Java MTN
 * templates and counts message types. Nothing is stored. Unread samples help write new templates.
 */
function ParseInbox() {
  const [state, setState] = useState<{ status: 'idle' | 'working' | 'done' | 'error'; result?: ParseResult; error?: string }>({ status: 'idle' })
  const run = async () => {
    setState({ status: 'working' })
    try {
      if (!(await SmsNative.hasPermission())) throw new Error('Message access is off. Allow it from first run or Android settings.')
      const inbox = await SmsNative.readInbox(0)
      const parsed = await SmsNative.parse(inbox.map((m) => m.body))
      const counts = new Map<ParsedType, number>()
      for (const p of parsed) counts.set(p.type, (counts.get(p.type) ?? 0) + 1)
      setState({
        status: 'done',
        result: {
          total: parsed.length,
          byType: [...counts.entries()].sort((a, b) => b[1] - a[1]),
          partial: parsed.filter((p) => p.status === 'PARTIAL').length,
          samples: parsed.filter((p) => p.type === 'UNREAD').slice(0, 3).map((p) => p.raw),
        },
      })
    } catch (e) {
      setState({ status: 'error', error: e instanceof NativeMissingError ? e.message : e instanceof Error ? e.message : 'Could not read the inbox.' })
    }
  }
  const r = state.result
  return (
    <View>
      <T v="sec" tone="fg2" style={{ marginBottom: 8 }}>
        Parser check (reads this phone's MoMo messages, stores nothing)
      </T>
      <Button variant="secondary" full loading={state.status === 'working'} onPress={run}>
        Parse my inbox
      </Button>
      {state.status === 'error' && (
        <T v="sec" tone="error" style={{ marginTop: 8 }}>
          {state.error}
        </T>
      )}
      {r && (
        <Surface divided style={{ marginTop: 12 }}>
          <Row title="Messages" end={String(r.total)} />
          {r.byType.map(([type, n]) => (
            <Row key={type} title={type === 'UNREAD' ? 'Not read' : type} end={String(n)} />
          ))}
          <Row title="Type known, amount missing" end={String(r.partial)} />
          {r.samples.map((raw, i) => (
            <View key={i} style={{ padding: 16 }}>
              <T v="meta" tone="fg2" selectable>
                {raw}
              </T>
            </View>
          ))}
        </Surface>
      )}
    </View>
  )
}

export function MergeHistory() {
  const { back, merges, groupName, undoMerge, setTab } = useApp()
  const s = useStyles()
  const sorted = [...merges].sort((a, b) => Number(!!a.builtIn) - Number(!!b.builtIn))
  return (
    <>
      <AppBar title="Merge history" onBack={back} />
      <Body padBottom={32}>
        <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
          Undo a merge to count that wording as its own group again.
        </T>
        <Surface>
          {sorted.length === 0 ? (
            <EmptyState icon={GitMergeIcon} title="No merges yet" body="Merged groups show up here so you can undo them." action="Go to Groups" onAction={() => setTab('groups')} />
          ) : (
            <Divided>
              {sorted.map((m) => (
                <View key={m.id} style={s.listRow}>
                  <View style={{ flex: 1 }}>
                    <T numberOfLines={1}>
                      {groupName(m.sourceId)} into {groupName(m.targetId)}
                    </T>
                    <T v="sec" tone="fg2" num numberOfLines={1}>
                      {m.builtIn ? 'Built in' : shortDate(m.date)} · {plural(m.txIds.length, 'payment')}
                    </T>
                  </View>
                  <Button variant="text" onPress={() => undoMerge(m.id)}>
                    Undo merge
                  </Button>
                </View>
              ))}
            </Divided>
          )}
        </Surface>
      </Body>
    </>
  )
}

function latest(day: number) {
  let d = TODAY
  while (weekdayOf(d) !== day) d = addDays(d, -1)
  return d
}

export function WeeklyService() {
  const { back, weekly, setWeekly, serviceId, setServiceId, notify, useType } = useApp()
  const [day, setDay] = useState(weekly.day)
  const [start, setStart] = useState(weekly.start)
  const [end, setEnd] = useState(weekly.end)
  const [dayOpen, setDayOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const check = (st = start, en = end) => (!st || !en ? 'Choose a start and an end time.' : toMin(en) <= toMin(st) ? 'End time must be after the start time.' : null)
  const word = useType === 'organisation' ? 'meeting' : 'service'

  const save = () => {
    const e = check()
    if (e) return setError(e)
    setWeekly({ day, start, end })
    if (serviceId.startsWith('w:')) setServiceId('w:' + latest(day))
    notify(`Weekly ${word} saved.`)
    back()
  }

  return (
    <>
      <AppBar title={`Weekly ${word}`} onBack={back} />
      <Body>
        <T v="sec" tone="fg2">
          Payments inside this window each week count as that week's {word}.
        </T>
        <View style={{ marginTop: 24 }}>
          <PickerField label="Day of week" value={DAYS[day]} onPress={() => setDayOpen(true)} />
        </View>
        <View style={{ marginTop: 24, flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TimeField label="Start time" value={start} onChange={(v) => (setStart(v), setError(check(v, end)))} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField label="End time" value={end} onChange={(v) => (setEnd(v), setError(check(start, v)))} />
          </View>
        </View>
        {error && (
          <T v="sec" tone="error" style={{ marginTop: 8 }} accessibilityRole="alert">
            {error}
          </T>
        )}
      </Body>
      <Footer>
        <Button full onPress={save}>
          {`Save weekly ${word}`}
        </Button>
      </Footer>
      <Sheet open={dayOpen} onClose={() => setDayOpen(false)} title="Day of week">
        <Surface>
          <View accessibilityRole="radiogroup">
            <Divided>
              {DAYS.map((d, i) => (
                <RadioRow
                  key={d}
                  label={d}
                  checked={day === i}
                  onSelect={() => {
                    setDay(i)
                    setDayOpen(false)
                  }}
                />
              ))}
            </Divided>
          </View>
        </Surface>
      </Sheet>
    </>
  )
}

type Errs = Partial<Record<keyof SessionDraft, string>>

function validate(v: SessionDraft): Errs {
  const e: Errs = {}
  if (!v.name.trim()) e.name = 'Enter a session name.'
  if (!v.date) e.date = 'Choose a date.'
  if (!v.start) e.start = 'Choose a start time.'
  if (!v.end) e.end = 'Choose an end time.'
  else if (v.start && toMin(v.end) <= toMin(v.start)) e.end = 'End time must be after the start time.'
  return e
}

export function SpecialSession() {
  const { back, sessionDraft, setSessionDraft, addSpecial, notify, useType } = useApp()
  const [v, setV] = useState<SessionDraft>(sessionDraft ?? { name: '', date: TODAY, start: '', end: '' })
  const [errs, setErrs] = useState<Errs>({})

  const update = (k: keyof SessionDraft, val: string) => {
    const next = { ...v, [k]: val }
    setV(next)
    setSessionDraft(next)
    if (k !== 'name') setErrs((e) => ({ ...e, [k]: validate(next)[k] }))
  }

  const save = () => {
    const e = validate(v)
    setErrs(e)
    if (Object.values(e).some(Boolean)) return
    addSpecial({ name: v.name.trim(), date: v.date, start: v.start, end: v.end })
    setSessionDraft(null)
    notify(`${v.name.trim()} saved. It is now the selected ${useType === 'organisation' ? 'period' : 'service'}.`)
    back()
  }

  const leave = () => {
    if (v.name || v.start || v.end) notify('Draft kept. Open Create special session to finish it.')
    else setSessionDraft(null)
    back()
  }

  return (
    <>
      <AppBar title="Special session" onBack={leave} />
      <Body>
        <T v="sec" tone="fg2">
          For harvests, funerals, weddings or any gathering outside the weekly {useType === 'organisation' ? 'meeting' : 'service'}.
        </T>
        <View style={{ marginTop: 24, gap: 24 }}>
          <TextField
            label="Session name"
            placeholder="Harvest thanksgiving"
            value={v.name}
            onChange={(x) => update('name', x)}
            error={errs.name}
            onBlur={() => setErrs((e) => ({ ...e, name: validate(v).name }))}
            onFocus={() => setErrs((e) => ({ ...e, name: undefined }))}
            autoCapitalize="sentences"
            autoComplete="off"
          />
          <DateField label="Date" value={v.date} onChange={(x) => update('date', x)} error={errs.date} />
          <View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TimeField label="Start time" value={v.start} onChange={(x) => update('start', x)} error={errs.start} />
              </View>
              <View style={{ flex: 1 }}>
                <TimeField label="End time" value={v.end} onChange={(x) => update('end', x)} error={errs.end} />
              </View>
            </View>
            <T v="meta" tone="fg3" style={{ marginTop: 8 }}>
              Payments inside this session count here, not in the weekly {useType === 'organisation' ? 'meeting' : 'service'}.
            </T>
          </View>
        </View>
      </Body>
      <Footer>
        <Button full onPress={save}>
          Save session
        </Button>
      </Footer>
    </>
  )
}

const useStyles = makeStyles((c) => ({
  listRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 16, paddingRight: 4 },
  seg: { flexDirection: 'row', gap: 4, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: 4 },
  segItem: { flex: 1, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
}))
