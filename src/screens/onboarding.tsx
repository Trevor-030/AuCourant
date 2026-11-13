import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, AppState, Easing, Linking, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApp } from '../lib/store'
import { FIRST_RECOVERY_CODE } from '../lib/data'
import { money, shortDate } from '../lib/format'
import { SmsNative } from '../native'
import { BRAND, DURATION, RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, Button, Divided, ErrorBox, LinkText, Row, Surface, T, Wordmark } from '../ui/kit'
import { ChatCircleDotsIcon, ChatSlashIcon, CheckCircleIcon, DeviceMobileIcon, LockSimpleIcon, ShieldCheckIcon, type Icon } from '../ui/icons'
import { BrandGradient, EmeraldGlow, Fill } from '../ui/layout'
import { Sheet } from '../ui/overlays'
import { FingerprintStep, LockSetup, RecoveryCode } from './lock'
import { RefNumbersStep } from './refnumbers'
import { UseTypeStep } from './usetype'

export function Onboarding() {
  const { phase, setPhase, setLock, lock, enterApp, setCoachStep, useType } = useApp()
  if (phase.kind !== 'onboarding') return null
  const go = (step: typeof phase.step) => setPhase({ kind: 'onboarding', step })
  // A1c is for Church and Organisation only.
  const asksNumbers = useType === 'church' || useType === 'organisation'
  const finish = () => {
    enterApp('home')
    setCoachStep(0)
  }
  switch (phase.step) {
    case 'welcome':
      return <Welcome onNext={() => go('use-type')} />
    case 'use-type':
      return <UseTypeStep onBack={() => go('welcome')} onNext={() => go(asksNumbers ? 'ref-numbers' : 'permission')} />
    case 'ref-numbers':
      return <RefNumbersStep onBack={() => go('use-type')} onDone={() => go('permission')} />
    case 'permission':
      return <Permission onBack={() => go(asksNumbers ? 'ref-numbers' : 'use-type')} onAllow={() => go('scanning')} onDeny={() => go('denied')} />
    case 'denied':
      return <Denied onAllow={() => go('scanning')} />
    case 'scanning':
      return <Scanning onDone={() => go('complete')} />
    case 'complete':
      return <ScanComplete actionLabel="Set up lock" onAction={() => go('lock-setup')} onLater={finish} />
    case 'lock-setup':
      return (
        <LockSetup
          mode="initial"
          onLater={finish}
          onSaved={(type, secret) => {
            setLock({ type, secret, fingerprint: false, recovery: FIRST_RECOVERY_CODE })
            go('recovery')
          }}
        />
      )
    case 'recovery':
      return <RecoveryCode code={lock?.recovery ?? FIRST_RECOVERY_CODE} onDone={() => go('fingerprint')} />
    case 'fingerprint':
      return (
        <FingerprintStep
          onTurnOn={() => {
            if (lock) setLock({ ...lock, fingerprint: true })
            finish()
          }}
          onSkip={finish}
        />
      )
  }
}

function PrivacyPoint({ icon: I, title, body }: { icon: Icon; title: string; body: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <I size={20} color={c.fg2} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <T w="medium">{title}</T>
        <T v="sec" tone="fg2">
          {body}
        </T>
      </View>
    </View>
  )
}

function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="How your messages stay private"
      footer={
        <Button full variant="secondary" onPress={onClose}>
          Close
        </Button>
      }
    >
      <View style={{ gap: 24, paddingTop: 4 }}>
        <PrivacyPoint icon={DeviceMobileIcon} title="Read on this phone only" body="Messages are read here. Nothing is sent to a server." />
        <PrivacyPoint icon={ChatCircleDotsIcon} title="Only MoMo payments" body="AuCourant looks for MTN MoMo payment messages and ignores the rest." />
        <PrivacyPoint icon={ShieldCheckIcon} title="No account, no cloud" body="Payments and reports stay on this phone unless you share a file." />
      </View>
    </Sheet>
  )
}

/** Plain shapes: message bubbles drop into tidy group cards. Settles in once, no loop. */
function SortingIllustration() {
  const s = useStyles()
  const { reduced } = useTheme()
  const groups = ['Offering', 'Tithe', 'Harvest']
  const anims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current
  useEffect(() => {
    Animated.stagger(
      reduced ? 0 : 100,
      anims.map((a) => Animated.timing(a, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.slow, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true })),
    ).start()
  }, [anims, reduced])
  const drop = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateY: reduced ? 0 : a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
  })
  return (
    <View importantForAccessibility="no-hide-descendants" style={s.illo}>
      {groups.map((g, i) => (
        <View key={g} style={{ flex: 1, alignItems: 'center' }}>
          <Animated.View style={[s.bubble, { marginTop: i === 1 ? 8 : 0 }, drop(anims[i])]}>
            <View style={[s.bar, { width: '100%', backgroundColor: 'rgba(232,238,233,0.35)' }]} />
            <View style={[s.bar, { width: '66%', marginTop: 6 }]} />
          </Animated.View>
          <View style={[s.dash, { height: i === 1 ? 16 : 24 }]} />
          <View style={s.chevron} />
          <Animated.View style={[s.card, drop(anims[i + 3])]}>
            <T v="meta" w="medium" color={BRAND.onBrand} numberOfLines={1}>
              {g}
            </T>
            <View style={s.goldTick} />
            <View style={[s.bar, { width: 40, marginTop: 6 }]} />
          </Animated.View>
        </View>
      ))}
    </View>
  )
}

function Welcome({ onNext }: { onNext: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [privacy, setPrivacy] = useState(false)
  return (
    <Fill>
      <BrandGradient style={[s.hero, { paddingTop: 24 + insets.top }]}>
        <EmeraldGlow size={360} style={{ top: -112, right: -96 }} />
        <Wordmark hero size={32} />
        <T v="sec" color={BRAND.onBrand80}>
          Stay au courant with your MoMo.
        </T>
        <SortingIllustration />
      </BrandGradient>
      <Fill style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}>
        <T v="hero" w="display" accessibilityRole="header">
          Sort your MoMo money by reference
        </T>
        <T tone="fg2" style={{ marginTop: 8 }}>
          AuCourant reads MoMo messages on this phone and groups the money you receive.
        </T>
        <View style={{ marginTop: 'auto', paddingTop: 16 }}>
          <View style={s.promise}>
            <LockSimpleIcon size={16} color={c.fg2} />
            <T v="sec">Nothing leaves this phone. No account needed.</T>
          </View>
          <Button full style={{ marginTop: 16 }} onPress={onNext}>
            Get started
          </Button>
          <Button full variant="text" style={{ marginTop: 4 }} onPress={() => setPrivacy(true)}>
            How your messages stay private
          </Button>
        </View>
      </Fill>
      <PrivacySheet open={privacy} onClose={() => setPrivacy(false)} />
    </Fill>
  )
}

/** Asks Android for SMS access. Resolves true when granted. */
async function askSms() {
  try {
    return (await SmsNative.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/** A1d Message access. Shows the real Android prompt. */
function Permission({ onBack, onAllow, onDeny }: { onBack: () => void; onAllow: () => void; onDeny: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const [privacy, setPrivacy] = useState(false)
  const [asking, setAsking] = useState(false)
  const allow = async () => {
    setAsking(true)
    const ok = await askSms()
    setAsking(false)
    if (ok) onAllow()
    else onDeny()
  }
  return (
    <>
      <AppBar onBack={onBack} />
      <Fill style={{ paddingHorizontal: 24, paddingBottom: 16, overflow: 'hidden' }}>
        <EmeraldGlow size={300} style={{ top: 16, alignSelf: 'center' }} />
        <Fill style={{ justifyContent: 'center' }}>
          <ChatCircleDotsIcon size={40} color={c.accent} />
          <T v="hero" w="display" style={{ marginTop: 16 }} accessibilityRole="header">
            Let AuCourant read MoMo messages
          </T>
          <T tone="fg2" style={{ marginTop: 8 }}>
            It looks for MoMo payments you received and sorts them by reference. Other messages are ignored.
          </T>
          <View style={[s.promise, { marginTop: 24 }]}>
            <LockSimpleIcon size={16} color={c.fg2} />
            <T v="sec">Nothing leaves this phone. No account needed.</T>
          </View>
        </Fill>
        <T v="meta" tone="fg3">
          Android will ask to read messages. Choose Allow so AuCourant can sort them.
        </T>
        <Button full loading={asking} style={{ marginTop: 16 }} onPress={allow}>
          Allow message access
        </Button>
        <Button full variant="text" style={{ marginTop: 4 }} onPress={() => setPrivacy(true)}>
          How your messages stay private
        </Button>
      </Fill>
      <PrivacySheet open={privacy} onClose={() => setPrivacy(false)} />
    </>
  )
}

function Denied({ onAllow }: { onAllow: () => void }) {
  const { c } = useTheme()
  // Coming back from phone settings: check again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      if (st !== 'active') return
      try {
        if (await SmsNative.hasPermission()) onAllow()
      } catch {
        /* native module missing: stay on this screen */
      }
    })
    return () => sub.remove()
  }, [onAllow])
  return (
    <Fill style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 }}>
      <Fill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ChatSlashIcon size={40} color={c.fg3} />
        <T v="title" w="display" style={{ marginTop: 16 }} accessibilityRole="header">
          Message access is off
        </T>
        <T tone="fg2" style={{ marginTop: 12, maxWidth: 290, textAlign: 'center' }}>
          AuCourant needs to read MoMo messages to sort them. You can turn this on in phone settings.
        </T>
      </Fill>
      <View style={{ gap: 8 }}>
        <Button variant="secondary" full onPress={async () => (await askSms()) && onAllow()}>
          Try again
        </Button>
        <Button full onPress={() => Linking.openSettings()}>
          Open phone settings
        </Button>
      </View>
    </Fill>
  )
}

export function Scanning({ onDone }: { onDone: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const { demo } = useApp()
  const total = 480
  const [n, setN] = useState(0)
  const [failed, setFailed] = useState(false)
  const [run, setRun] = useState(0)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    setN(0)
    setFailed(false)
    let v = 0
    let finish: ReturnType<typeof setTimeout> | undefined
    const t = setInterval(() => {
      v = Math.min(total, v + 12)
      if (demo === 'error' && v >= 312) {
        setN(312)
        setFailed(true)
        clearInterval(t)
        return
      }
      setN(v)
      if (v >= total) {
        clearInterval(t)
        finish = setTimeout(() => done.current(), 300)
      }
    }, 50)
    return () => {
      clearInterval(t)
      clearTimeout(finish)
    }
  }, [run, demo])
  return (
    <Fill style={{ justifyContent: 'center', paddingHorizontal: 24 }}>
      <T v="title" w="display" accessibilityRole="header">
        Setting up AuCourant
      </T>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Reading messages"
        accessibilityValue={{ min: 0, max: total, now: n }}
        style={s.track}
      >
        <View style={[s.fillBar, { width: `${(n / total) * 100}%`, backgroundColor: failed ? c.error : c.accent }]} />
      </View>
      <T num style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
        Reading messages… {n} of {total}
      </T>
      {failed ? (
        <View style={{ marginTop: 24 }}>
          <ErrorBox
            action={
              <Button variant="secondary" tone="error" style={{ marginTop: 12, marginLeft: -4, alignSelf: 'flex-start', borderColor: c.error }} onPress={() => setRun(run + 1)}>
                Try again
              </Button>
            }
          >
            We couldn't finish reading messages. Keep the app open and try again.
          </ErrorBox>
        </View>
      ) : (
        <T v="meta" tone="fg3" style={{ marginTop: 4 }}>
          This only happens once. Keep the app open.
        </T>
      )}
    </Fill>
  )
}

export function ScanComplete({ actionLabel, onAction, onLater }: { actionLabel: string; onAction: () => void; onLater?: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const { allTxs, allGroups, pendingCodes, groupName, useType, allPTxs } = useApp()
  const [noRefOpen, setNoRefOpen] = useState(false)
  const personal = useType === 'personal'
  const named = allGroups
    .filter((g) => !g.hidden && !g.system && !g.code)
    .map((g) => ({ g, total: allTxs.filter((t) => t.groupId === g.id).reduce((sum, t) => sum + t.amount, 0) }))
    .sort((a, b) => b.total - a.total)
  const groupCount = allGroups.filter((g) => !g.hidden && !g.system).length
  const noRef = allTxs.filter((t) => t.groupId === 'noref')
  const summary =
    named.length > 3
      ? `${named
          .slice(0, 3)
          .map((x) => x.g.name)
          .join(', ')} and ${named.length - 3} more`
      : named.map((x) => x.g.name).join(', ')
  const stat = (label: ReactNode, value: number) => (
    <View style={s.statRow}>
      {typeof label === 'string' ? <T tone="fg2">{label}</T> : label}
      <T w="medium" num>
        {value}
      </T>
    </View>
  )
  return (
    <Fill style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, overflow: 'hidden' }}>
      <EmeraldGlow size={320} style={{ top: 24, alignSelf: 'center' }} />
      <Fill style={{ justifyContent: 'center' }}>
        <CheckCircleIcon size={40} weight="fill" color={c.gold} />
        <T v="hero" w="display" style={{ marginTop: 16 }} accessibilityRole="header">
          Your payments are sorted
        </T>
        <T tone="fg2" style={{ marginTop: 8 }}>
          Here is what AuCourant found in your MoMo messages.
        </T>
        {personal ? (
          <Surface divided style={{ marginTop: 24 }}>
            {stat('Money received', allPTxs.filter((t) => t.direction === 'in').length)}
            {stat('Money sent and spent', allPTxs.filter((t) => t.direction === 'out').length)}
            {stat('Put in a category for you', allPTxs.filter((t) => t.categoryId).length)}
            {stat('To categorise', allPTxs.filter((t) => !t.categoryId).length)}
          </Surface>
        ) : (
        <Surface divided style={{ marginTop: 24 }}>
          {stat('Payments received', allTxs.length)}
          {stat('Groups found', groupCount)}
          {stat(
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <T tone="fg2" numberOfLines={1}>
                With no reference
              </T>
              {noRef.length > 0 && <LinkText onPress={() => setNoRefOpen(true)}>See these</LinkText>}
            </View>,
            noRef.length,
          )}
          {pendingCodes.length > 0 && stat('Codes to name', pendingCodes.length)}
        </Surface>
        )}
        {!personal && !!summary && (
          <T v="sec" tone="fg2" style={{ marginTop: 12 }}>
            {summary}
          </T>
        )}
      </Fill>
      <Button full onPress={onAction}>
        {actionLabel}
      </Button>
      {onLater && (
        <Button full variant="text" style={{ marginTop: 4 }} onPress={onLater}>
          Set up later
        </Button>
      )}
      <Sheet
        open={noRefOpen}
        onClose={() => setNoRefOpen(false)}
        title="With no reference"
        footer={
          <Button full variant="secondary" onPress={() => setNoRefOpen(false)}>
            Close
          </Button>
        }
      >
        <T v="sec" tone="fg2" style={{ marginBottom: 16 }}>
          The givers did not type a note. You can move each one into a group later from Transactions.
        </T>
        <Surface>
          <Divided>
            {noRef.map((t) => (
              <Row key={t.id} title={t.sender} sub={`${shortDate(t.date)}, ${t.time} · ${groupName(t.groupId)}`} end={money(t.amount)} />
            ))}
          </Divided>
        </Surface>
      </Sheet>
    </Fill>
  )
}

const useStyles = makeStyles((c) => ({
  hero: { paddingHorizontal: 24, paddingBottom: 24 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  illo: { flexDirection: 'row', gap: 12, marginTop: 24 },
  bubble: {
    alignSelf: 'stretch',
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: 2,
    backgroundColor: 'rgba(232,238,233,0.12)',
    padding: 10,
  },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(232,238,233,0.25)' },
  dash: { width: 0, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(232,238,233,0.25)' },
  chevron: {
    width: 6,
    height: 6,
    marginTop: -5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(232,238,233,0.4)',
    transform: [{ rotate: '45deg' }],
  },
  card: {
    alignSelf: 'stretch',
    marginTop: 4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(232,238,233,0.14)',
    backgroundColor: 'rgba(8,13,12,0.35)',
    padding: 10,
  },
  goldTick: { height: 1, width: 24, backgroundColor: BRAND.gold, marginTop: 6 },
  track: { marginTop: 32, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: c.inset },
  fillBar: { height: '100%' },
  statRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
}))
