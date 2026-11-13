import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, BackHandler, Easing, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useApp, type OnbStep, type Route, type Tab } from './lib/store'
import { makeRecoveryCode } from './lib/data'
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
  const { setTab } = useApp()
  const [done, setDone] = useState(false)
  return done ? <ScanComplete actionLabel="Go to Home" onAction={() => setTab('home')} /> : <Scanning onDone={() => setDone(true)} />
}

function NewRecovery({ code }: { code: string }) {
  const { lock, setLock, back, notify } = useApp()
  // The old code stops working as soon as the new one is shown.
  useEffect(() => {
    if (lock && lock.recovery !== code) setLock({ ...lock, recovery: code })
  }, [code, lock, setLock])
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
  const { back, replace, lock, setLock, notify, setPhase, useType } = useApp()
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
          onSuccess={() => replace({ name: 'new-recovery', code: makeRecoveryCode() })}
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
            if (lock) {
              setLock({ ...lock, type, secret })
              notify('Lock saved.')
              back()
            } else {
              const code = makeRecoveryCode()
              setLock({ type, secret, fingerprint: false, recovery: code })
              replace({ name: 'new-recovery', code })
            }
          }}
        />
      )
  }
}

function Locked() {
  const { phase, setPhase, enterApp, lock, setLock, notify, useType } = useApp()
  if (phase.kind !== 'locked') return null
  const go = (step: typeof phase.step) => setPhase({ kind: 'locked', step })
  switch (phase.step) {
    case 'lock':
      return <LockScreen onSuccess={() => enterApp()} onForgot={() => go('reset')} />
    case 'reset':
      return <ResetLock onBack={() => go('lock')} onReset={() => go('new-lock')} />
    case 'new-lock':
      return (
        <LockSetup
          mode="reset"
          onSaved={(type, secret) => {
            setLock({ type, secret, fingerprint: lock?.fingerprint ?? false, recovery: makeRecoveryCode() })
            go('new-recovery')
          }}
        />
      )
    case 'new-recovery':
      return (
        <RecoveryCode
          code={lock?.recovery ?? ''}
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
  const inApp = phase.kind === 'app'
  const showNav = inApp && NAV_ROUTES.includes(route.name)
  const key = phase.kind === 'app' ? `app:${stack.length}:${route.name}:${'id' in route ? route.id : ''}` : `${phase.kind}:${phase.step}`
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
