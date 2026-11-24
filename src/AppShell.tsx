import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, AppState, BackHandler, Easing, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { SaveError, useApp, type OnbStep, type Route, type Tab } from './lib/store'
import { plural } from './lib/format'
import { SmsNative } from './native'
import { CrashNative } from './native/crash'
import { StoreNative } from './native/store'
import { DURATION, makeStyles, useTheme } from './theme'
import { T } from './ui/kit'
import { ExportIcon, HouseIcon, ReceiptIcon, StackIcon, TagIcon, type Icon } from './ui/icons'
import { CoachMarks, SnackbarHost, useCoachTarget } from './ui/overlays'
import { Onboarding, ScanComplete, Scanning } from './screens/onboarding'
import { LockScreen, LockSetup, RecoveryCode, ResetLock } from './screens/lock'
import { Home } from './screens/home'
import { GroupDetail, Groups } from './screens/groups'
import { Transactions, TxDetail } from './screens/transactions'
import { Review } from './screens/review'
import { Export } from './screens/export'
import { MergeHistory, Settings, SpecialSession, WeeklyService } from './screens/settings'
import { ReferenceCodes } from './screens/codes'
import { PersonalHome } from './screens/personal/home'
import { PersonalTransactions, PersonalTxDetail } from './screens/personal/transactions'
import { Person } from './screens/personal/person'
import { Categories, CategoryDetail, ManageCategories } from './screens/personal/categories'
import { PersonalExport } from './screens/personal/export'

const NAV_ROUTES: Route['name'][] = ['home', 'groups', 'transactions', 'categories', 'export', 'group', 'tx', 'person', 'category']

const TABS: { tab: Tab; label: string; icon: Icon }[] = [
  { tab: 'home', label: 'Home', icon: HouseIcon },
  { tab: 'groups', label: 'Groups', icon: StackIcon },
  { tab: 'transactions', label: 'Transactions', icon: ReceiptIcon },
  { tab: 'export', label: 'Export', icon: ExportIcon },
]

/** Personal or business: Categories replaces Groups (architecture-personal.md). */
const PERSONAL_TABS: { tab: Tab; label: string; icon: Icon }[] = [
  { tab: 'home', label: 'Home', icon: HouseIcon },
  { tab: 'transactions', label: 'Transactions', icon: ReceiptIcon },
  { tab: 'categories', label: 'Categories', icon: TagIcon },
  { tab: 'export', label: 'Export', icon: ExportIcon },
]

/** Where the hardware back button goes during first run. */
const ONB_BACK: Partial<Record<OnbStep, OnbStep>> = {
  'use-type': 'welcome',
  'ref-numbers': 'use-type',
  permission: 'ref-numbers',
}

function NavTab({ tab, label, icon: I, on, onPress }: { tab: Tab; label: string; icon: Icon; on: boolean; onPress: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const coach = useCoachTarget('export-tab')
  return (
    <View style={{ flex: 1 }} {...(tab === 'export' ? coach : {})}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        onPress={onPress}
        style={({ pressed }) => [s.tab, pressed && { backgroundColor: c.inset }]}
      >
        {on && <View style={s.tabMark} />}
        <I size={24} weight={on ? 'fill' : 'regular'} color={on ? c.accent : c.fg2} />
        <T v="meta" w="medium" tone={on ? 'accent' : 'fg2'}>
          {label}
        </T>
      </Pressable>
    </View>
  )
}

function BottomNav() {
  const s = useStyles()
  const insets = useSafeAreaInsets()
  const { stack, setTab, useType } = useApp()
  const active = stack[0].name
  return (
    <View accessibilityRole="tablist" style={[s.nav, { paddingBottom: insets.bottom, height: 64 + insets.bottom }]}>
      {(useType === 'personal' ? PERSONAL_TABS : TABS).map((t) => (
        <NavTab key={t.tab} {...t} on={active === t.tab} onPress={() => setTab(t.tab)} />
      ))}
    </View>
  )
}

function Rescan() {
  const { setTab, notify, dataSource } = useApp()
  const [done, setDone] = useState(false)
  // Only a scan after the first one has "new" payments to report.
  const again = useRef(dataSource === 'messages')
  return done ? (
    <ScanComplete actionLabel="Go to Home" onAction={() => setTab('home')} />
  ) : (
    <Scanning
      onDone={(result) => {
        setDone(true)
        if (result && again.current) notify(result.newPayments ? `${plural(result.newPayments, 'new payment')} found.` : 'No new payments since the last scan.')
      }}
    />
  )
}

function NewRecovery({ code }: { code: string }) {
  const { saveRecovery, back, notify } = useApp()
  const saved = useRef<string | null>(null)
  // The old code stops working as soon as the new one is shown.
  useEffect(() => {
    if (saved.current === code) return
    saved.current = code
    saveRecovery(code).catch(() => notify('Could not save the new code. Try again.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])
  return (
    <RecoveryCode
      code={code}
      onDone={() => {
        back()
        notify('New recovery code saved. The old one no longer works.')
      }}
    />
  )
}

function Screen({ route }: { route: Route }) {
  const { back, replace, lock, saveLock, newRecoveryCode, notify, setPhase, useType } = useApp()
  const personal = useType === 'personal'
  switch (route.name) {
    case 'home':
      return personal ? <PersonalHome /> : <Home />
    case 'categories':
      return <Categories />
    case 'category':
      return <CategoryDetail id={route.id} />
    case 'manage-categories':
      return <ManageCategories />
    case 'person':
      return <Person id={route.id} />
    case 'groups':
      return <Groups />
    case 'group':
      return <GroupDetail id={route.id} />
    case 'transactions':
      return personal ? <PersonalTransactions /> : <Transactions />
    case 'tx':
      return personal ? <PersonalTxDetail id={route.id} /> : <TxDetail id={route.id} />
    case 'review':
      return <Review initialTab={route.tab} />
    case 'export':
      return personal ? <PersonalExport /> : <Export />
    case 'settings':
      return <Settings />
    case 'merge-history':
      return <MergeHistory />
    case 'reference-codes':
      return <ReferenceCodes />
    case 'weekly-service':
      return <WeeklyService />
    case 'special-session':
      return <SpecialSession />
    case 'rescan':
      return <Rescan />
    case 'verify-lock':
      return (
        <LockScreen
          onBack={back}
          onSuccess={() => newRecoveryCode().then((code) => replace({ name: 'new-recovery', code }))}
          onForgot={() => setPhase({ kind: 'locked', step: 'reset' })}
        />
      )
    case 'new-recovery':
      return <NewRecovery code={route.code} />
    case 'lock-change':
      return (
        <LockSetup
          mode="change"
          onBack={back}
          onSaved={(type, secret) => {
            ;(async () => {
              if (lock) {
                await saveLock(type, secret)
                notify('Lock saved.')
                back()
              } else {
                const code = await newRecoveryCode()
                await saveLock(type, secret, code)
                replace({ name: 'new-recovery', code })
              }
            })().catch(() => notify('Could not save the lock. Try again.'))
          }}
        />
      )
  }
}

function Locked() {
  const { phase, setPhase, enterApp, unlock, saveLock, newRecoveryCode, notify, useType } = useApp()
  if (phase.kind !== 'locked') return null
  const go = (step: typeof phase.step) => setPhase({ kind: 'locked', step })
  switch (phase.step) {
    case 'lock':
      // Back to the screen the user left (the app also locks after 5 minutes away).
      return <LockScreen onSuccess={unlock} onForgot={() => go('reset')} />
    case 'reset':
      return <ResetLock onBack={() => go('lock')} onReset={() => go('new-lock')} />
    case 'new-lock':
      return (
        <LockSetup
          mode="reset"
          onSaved={(type, secret) => {
            ;(async () => {
              const code = await newRecoveryCode()
              await saveLock(type, secret, code)
              setPhase({ kind: 'locked', step: 'new-recovery', code })
            })().catch(() => notify('Could not save the lock. Try again.'))
          }}
        />
      )
    case 'new-recovery':
      return (
        <RecoveryCode
          code={phase.code ?? ''}
          onDone={() => {
            enterApp()
            notify(`New lock saved. Your payments and ${useType === 'personal' ? 'categories' : 'groups'} are all here.`)
          }}
        />
      )
  }
}

/** Snackbar offset above the bottom nav or the screen's action bar. */
function snackBottom(phaseKind: string, route: Route['name']) {
  if (phaseKind !== 'app') return 96
  if (route === 'export') return 152
  if (['review', 'special-session', 'weekly-service', 'lock-change', 'new-recovery'].includes(route)) return 88
  return NAV_ROUTES.includes(route) ? 72 : 16
}

/** Android back button: pop the stack, then go Home, then leave the app. */
function useHardwareBack() {
  const app = useApp()
  const ref = useRef(app)
  ref.current = app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const { phase, setPhase, stack, back, setTab, useType } = ref.current
      if (phase.kind === 'onboarding') {
        let prev = ONB_BACK[phase.step]
        if (phase.step === 'permission' && useType === 'personal') prev = 'use-type'
        if (!prev) return false
        setPhase({ kind: 'onboarding', step: prev })
        return true
      }
      if (phase.kind === 'locked') {
        if (phase.step === 'reset') {
          setPhase({ kind: 'locked', step: 'lock' })
          return true
        }
        return false
      }
      if (stack.length > 1) {
        back()
        return true
      }
      if (stack[0].name !== 'home') {
        setTab('home')
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [])
}

/** A safety net for phones that hold back the receiver. */
const NEW_MESSAGES_EVERY_MS = 60000
/** Founder, 2026-11-21: lock again after 5 minutes away, so a quick switch to the MoMo app does not ask. */
const AUTO_LOCK_MS = 5 * 60 * 1000

/** Locks the app when it comes back after more than 5 minutes in the background, if a lock is set. */
function useAutoLock() {
  const app = useApp()
  const ref = useRef(app)
  ref.current = app
  useEffect(() => {
    let leftAt = 0
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') {
        leftAt = Date.now()
        return
      }
      if (st !== 'active' || !leftAt) return
      const away = Date.now() - leftAt
      leftAt = 0
      const a = ref.current
      // The route stack is kept, so unlocking returns to the same screen.
      if (a.lock && a.phase.kind === 'app' && away > AUTO_LOCK_MS) a.setPhase({ kind: 'locked', step: 'lock' })
    })
    return () => sub.remove()
  }, [])
}

/**
 * While real payments are on screen, looks for new MoMo messages as they arrive (SmsReceiver.java),
 * when the app opens or comes back to the front, and once a minute in case the phone held the
 * receiver back, so totals keep up during a service. New payments are added quietly; nothing else
 * changes. Reading, sorting and saving happen in Java (scanMessages).
 */
function useNewMessages() {
  const app = useApp()
  const ref = useRef(app)
  ref.current = app
  const on = app.dataSource === 'messages' && app.phase.kind === 'app' && app.canScan
  useEffect(() => {
    if (!on || !SmsNative.canReadMessages()) return
    let busy = false
    /** A message arrived during a check, perhaps after it had read the inbox. */
    let again = false
    let toldSaveFailed = false
    // The Scan messages again screen does its own reading.
    const rescanning = () => ref.current.route.name === 'rescan'
    const check = async () => {
      if (busy) {
        again = true
        return
      }
      if (AppState.currentState !== 'active' || rescanning()) return
      busy = true
      try {
        if (!(await SmsNative.hasPermission())) return
        if (rescanning()) return
        const { newPayments } = await ref.current.scanMessages()
        toldSaveFailed = false
        // Never replace a message that is offering Undo.
        if (newPayments > 0 && !ref.current.snack) ref.current.notify(`${plural(newPayments, 'new payment')} added.`)
      } catch (e) {
        // A missed check costs nothing: the next one, or Scan messages again, picks the payment up.
        // But while edits cannot be saved no check gets through, so say why totals stopped moving.
        if (e instanceof SaveError && !toldSaveFailed) {
          toldSaveFailed = true
          ref.current.notify("New payments can't be added until your changes are saved. Check that the phone has free storage.")
        }
      } finally {
        busy = false
        if (again) {
          again = false
          void check()
        }
      }
    }
    void check()
    const stopListening = StoreNative.onNewMessage(check)
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') check()
    })
    const timer = setInterval(check, NEW_MESSAGES_EVERY_MS)
    return () => {
      again = false
      stopListening()
      sub.remove()
      clearInterval(timer)
    }
  }, [on])
}

/** 8px rise plus fade when the screen changes. Reduced motion: 100ms fade. */
function Transition({ id, children }: { id: string; children: ReactNode }) {
  const { reduced } = useTheme()
  const t = useRef(new Animated.Value(1)).current
  useEffect(() => {
    t.setValue(0)
    Animated.timing(t, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.enter, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start()
  }, [id, reduced, t])
  const translateY = reduced ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] })
  return <Animated.View style={{ flex: 1, opacity: t, transform: [{ translateY }] }}>{children}</Animated.View>
}

export function AppShell() {
  const s = useStyles()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { phase, route, stack } = useApp()
  useHardwareBack()
  useNewMessages()
  useAutoLock()
  const inApp = phase.kind === 'app'
  const showNav = inApp && NAV_ROUTES.includes(route.name)
  const key = phase.kind === 'app' ? `app:${stack.length}:${route.name}:${'id' in route ? route.id : ''}` : `${phase.kind}:${phase.step}`
  // Steps for the problem report. The screen's name only: ids can hold phone numbers.
  const screen = phase.kind === 'app' ? `app ${route.name}` : `${phase.kind} ${phase.step}`
  useEffect(() => CrashNative.step(`screen ${screen} shown`), [screen])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => CrashNative.step(`app ${st}`))
    return () => sub.remove()
  }, [])
  // The Welcome hero runs edge to edge under the status bar.
  const heroTop = phase.kind === 'onboarding' && phase.step === 'welcome'

  return (
    <View style={s.root}>
      <StatusBar style={heroTop || isDark ? 'light' : 'dark'} />
      <View style={[s.body, { paddingTop: heroTop ? 0 : insets.top, paddingBottom: showNav ? 0 : insets.bottom }]}>
        <Transition id={key}>{phase.kind === 'onboarding' ? <Onboarding /> : phase.kind === 'locked' ? <Locked /> : <Screen route={route} />}</Transition>
      </View>
      {showNav && <BottomNav />}
      <SnackbarHost bottom={snackBottom(phase.kind, route.name) + insets.bottom} />
      {inApp && <CoachMarks />}
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.canvas },
  body: { flex: 1 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.stroke, backgroundColor: c.surface },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabMark: { position: 'absolute', top: 0, width: 40, height: 2, borderRadius: 1, backgroundColor: c.accent },
}))
