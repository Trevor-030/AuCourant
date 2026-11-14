import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useApp, type LockType } from '../lib/store'
import { RADIUS, makeStyles, useTheme } from '../theme'
import { AppBar, AppIcon, Button, InlineError, Radio, T, TextField, Wordmark } from '../ui/kit'
import { FingerprintIcon, LockSimpleIcon } from '../ui/icons'
import { Body, Fill, Footer } from '../ui/layout'
import { Keypad, PasswordField, PinDots } from '../ui/lock'
import { Dialog } from '../ui/overlays'

/*
 * Prototype note: the lock still compares plain values held in memory, like the Figma
 * prototype. The Java LockModule (PBKDF2 + SecureRandom recovery code) is ready in
 * src/native and replaces this when storage lands.
 */

const TYPES: { id: LockType; label: string }[] = [
  { id: 'pin4', label: '4-digit PIN' },
  { id: 'pin6', label: '6-digit PIN' },
  { id: 'password', label: 'Password' },
]
export const lockTypeLabel = (t: LockType) => TYPES.find((x) => x.id === t)!.label

export function LockSetup({
  mode,
  onSaved,
  onLater,
  onBack,
}: {
  mode: 'initial' | 'reset' | 'change'
  onSaved: (type: LockType, secret: string) => void
  onLater?: () => void
  onBack?: () => void
}) {
  const s = useStyles()
  const { c } = useTheme()
  const { lock } = useApp()
  const [type, setType] = useState<LockType>(mode === 'change' && lock ? lock.type : 'pin4')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [active, setActive] = useState<'a' | 'b'>('a')
  const [errA, setErrA] = useState<string | null>(null)
  const [errB, setErrB] = useState<string | null>(null)
  const isPin = type !== 'password'
  const len = type === 'pin6' ? 6 : 4

  const changeType = (t: LockType) => {
    setType(t)
    setA('')
    setB('')
    setActive('a')
    setErrA(null)
    setErrB(null)
  }

  const digit = (d: string) => {
    if (active === 'a') {
      if (a.length >= len) return
      setErrA(null)
      const n = a + d
      setA(n)
      if (n.length === len) setActive('b')
    } else if (b.length < len) {
      setErrB(null)
      setB(b + d)
    }
  }
  const backspace = () => {
    if (active === 'b' && b) return setB(b.slice(0, -1))
    if (active === 'b') setActive('a')
    setA(a.slice(0, -1))
  }

  const save = () => {
    if (isPin) {
      if (a.length < len) {
        setActive('a')
        return setErrA(`Enter all ${len} digits.`)
      }
      if (b.length < len) {
        setActive('b')
        return setErrB(`Enter all ${len} digits again to confirm.`)
      }
      if (a !== b) {
        setA('')
        setB('')
        setActive('a')
        return setErrB("The two entries don't match. Enter them again.")
      }
    } else {
      if (a.length < 6) return setErrA('Use at least 6 characters.')
      if (a !== b) return setErrB("The two entries don't match. Enter them again.")
    }
    onSaved(type, a)
  }

  const title = mode === 'reset' ? 'Set a new lock' : mode === 'change' ? 'Change lock' : 'Lock AuCourant'

  return (
    <>
      {onBack && <AppBar title={title} onBack={onBack} />}
      <Body>
        {!onBack && (
          <T v="title" w="display" style={{ paddingTop: 32 }} accessibilityRole="header">
            {title}
          </T>
        )}
        <T tone="fg2" style={{ marginTop: onBack ? 0 : 8 }}>
          Choose how to unlock the app on this shared phone.
        </T>

        <T v="sec" w="medium" style={{ marginTop: 24, marginBottom: 8 }}>
          Lock type
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel="Lock type" style={s.types}>
          {TYPES.map((t) => {
            const on = type === t.id
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => changeType(t.id)}
                style={({ pressed }) => [s.type, on ? s.typeOn : pressed && { backgroundColor: c.inset }]}
              >
                <Radio checked={on} size={16} />
                <T v="sec" w="medium" tone={on ? 'accent' : 'fg2'} style={{ flexShrink: 1, lineHeight: 17 }}>
                  {t.label}
                </T>
              </Pressable>
            )
          })}
        </View>

        <View style={{ marginTop: 24, gap: 16 }}>
          {isPin ? (
            <>
              <View>
                <T v="sec" w="medium" style={{ marginBottom: 8 }}>
                  Create PIN
                </T>
                <PinDots length={len} filled={a.length} active={active === 'a'} error={!!errA} label="Create PIN" onActivate={() => setActive('a')} />
                {errA && <InlineError>{errA}</InlineError>}
              </View>
              <View>
                <T v="sec" w="medium" style={{ marginBottom: 8 }}>
                  Confirm PIN
                </T>
                <PinDots length={len} filled={b.length} active={active === 'b'} error={!!errB} label="Confirm PIN" onActivate={() => a.length === len && setActive('b')} />
                {errB && <InlineError>{errB}</InlineError>}
              </View>
            </>
          ) : (
            <>
              <PasswordField
                label="Create password"
                value={a}
                onChange={setA}
                error={errA}
                helper="Use at least 6 characters."
                onFocus={() => setErrA(null)}
                onBlur={() => a && a.length < 6 && setErrA('Use at least 6 characters.')}
              />
              <PasswordField
                label="Confirm password"
                value={b}
                onChange={setB}
                error={errB}
                onFocus={() => setErrB(null)}
                onBlur={() => b && b !== a && setErrB("The two entries don't match. Enter them again.")}
                onEnter={save}
              />
            </>
          )}
          <T v="meta" tone="fg3">
            If you forget it, your recovery code unlocks the app.
          </T>
        </View>
      </Body>
      <Footer style={{ paddingTop: 12 }}>
        {isPin && <Keypad onDigit={digit} onBackspace={backspace} />}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: isPin ? 12 : 0 }}>
          {onLater && (
            <Button variant="text" onPress={onLater}>
              Set up later
            </Button>
          )}
          <Button style={{ flex: 1 }} onPress={save}>
            Save lock
          </Button>
        </View>
      </Footer>
    </>
  )
}

export function RecoveryCode({ code, onDone, onBack }: { code: string; onDone: () => void; onBack?: () => void }) {
  const s = useStyles()
  const { notify, useType } = useApp()
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code)
      notify('Recovery code copied.')
    } catch {
      notify("Couldn't copy the code. Write it down instead.")
    }
  }
  return (
    <>
      {onBack && <AppBar onBack={onBack} />}
      <Fill style={[{ justifyContent: 'center', paddingHorizontal: 24 }, !onBack && { paddingTop: 32 }]}>
        <T v="title" w="display" accessibilityRole="header">
          Save your recovery code
        </T>
        <T tone="fg2" style={{ marginTop: 8 }}>
          If you forget your PIN or password, this code unlocks the app. Nothing is erased.
        </T>
        <View style={s.codeBox}>
          <T v="section" w="medium" num selectable style={{ letterSpacing: 4 }} accessibilityLabel={`Recovery code ${code.split('').join(' ')}`}>
            {code}
          </T>
        </View>
        <T v="meta" tone="fg3" style={{ marginTop: 12 }}>
          Write it down and keep it safe, for example {useType === 'personal' ? 'in a notebook at home' : 'with a church leader'}. It is shown only once.
        </T>
      </Fill>
      <View style={s.twoBtns}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={copy}>
          Copy code
        </Button>
        <Button style={{ flex: 1 }} onPress={onDone}>
          Finish setup
        </Button>
      </View>
    </>
  )
}

export function FingerprintStep({ onTurnOn, onSkip }: { onTurnOn: () => void; onSkip: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <Fill style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 }}>
      <Fill style={s.centered}>
        <FingerprintIcon size={48} color={c.accent} />
        <T v="title" w="display" style={{ marginTop: 16 }} accessibilityRole="header">
          Use fingerprint
        </T>
        <T tone="fg2" style={{ marginTop: 8, maxWidth: 280, textAlign: 'center' }}>
          Unlock with your fingerprint. Your PIN or password still works.
        </T>
      </Fill>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant="text" onPress={onSkip}>
          Not now
        </Button>
        <Button style={{ flex: 1 }} icon={FingerprintIcon} onPress={onTurnOn}>
          Turn on fingerprint
        </Button>
      </View>
    </Fill>
  )
}

function useCooldown() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [until])
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  const start = useCallback(() => {
    setUntil(Date.now() + 30000)
    setNow(Date.now())
  }, [])
  return { left, start }
}

const TOO_MANY = 'Too many tries. Wait 30 seconds, then try again.'

export function LockScreen({ onSuccess, onForgot, onBack }: { onSuccess: () => void; onForgot: () => void; onBack?: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const { lock } = useApp()
  const type = lock?.type ?? 'pin4'
  const isPin = type !== 'password'
  const len = type === 'pin6' ? 6 : 4
  const [entry, setEntry] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [scanning, setScanning] = useState(false)
  const cool = useCooldown()
  const blocked = cool.left > 0
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!blocked && error === TOO_MANY) setError(null)
  }, [blocked, error])

  const check = (value: string) => {
    if (!lock) return
    if (value === lock.secret) return onSuccess()
    const t = tries + 1
    setEntry('')
    if (t >= 5) {
      setTries(0)
      cool.start()
      return setError(TOO_MANY)
    }
    setTries(t)
    setError(isPin ? "That PIN doesn't match. Try again." : "That password doesn't match. Try again.")
  }

  const digit = (d: string) => {
    if (blocked || entry.length >= len) return
    const n = entry + d
    setEntry(n)
    if (n.length === len) timer.current = setTimeout(() => check(n), 150)
  }

  // Fingerprint is simulated until the AndroidX Biometric module is added (architecture spike 5).
  const fingerprint = () => {
    setScanning(true)
    timer.current = setTimeout(() => {
      setScanning(false)
      onSuccess()
    }, 700)
  }

  return (
    <>
      {onBack ? (
        <AppBar title="Check your lock" onBack={onBack} />
      ) : (
        <View style={{ paddingTop: 32, alignItems: 'center', gap: 12 }}>
          <AppIcon size={56} />
          <Wordmark size={20} />
        </View>
      )}
      <Fill style={[s.centered, { paddingHorizontal: 24 }]}>
        <LockSimpleIcon size={32} color={c.fg2} />
        <T v="title" w="display" style={{ marginTop: 16 }} accessibilityRole="header">
          {isPin ? 'Enter your PIN' : 'Enter your password'}
        </T>
        <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
          {isPin ? (
            <PinDots length={len} filled={entry.length} error={!!error && !entry} label="PIN" center />
          ) : (
            <PasswordField label="Password" value={entry} onChange={(v) => (setEntry(v), setError(null))} onEnter={() => !blocked && check(entry)} />
          )}
        </View>
        <View style={{ marginTop: 4, minHeight: 48, alignSelf: 'stretch' }}>
          {error && <InlineError>{error}</InlineError>}
          {blocked && (
            <T v="meta" tone="fg3" num style={{ marginTop: 4, paddingLeft: 22 }}>
              You can try again in {cool.left} seconds.
            </T>
          )}
        </View>
      </Fill>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 4 }}>
        {isPin ? (
          <Keypad onDigit={digit} onBackspace={() => setEntry((e) => e.slice(0, -1))} disabled={blocked} />
        ) : (
          <Button full onPress={() => !blocked && check(entry)}>
            Unlock app
          </Button>
        )}
        {lock?.fingerprint && (
          <Button variant="secondary" full icon={FingerprintIcon} loading={scanning} onPress={fingerprint} style={{ marginTop: 8 }}>
            {scanning ? 'Checking fingerprint…' : 'Use fingerprint'}
          </Button>
        )}
        <Button variant="text" full onPress={onForgot}>
          Forgot PIN or password
        </Button>
      </View>
    </>
  )
}

function formatCode(v: string) {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return raw.match(/.{1,4}/g)?.join('-') ?? ''
}

export function ResetLock({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const { lock, eraseAll, useType } = useApp()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [erase, setErase] = useState(false)
  const cool = useCooldown()
  const blocked = cool.left > 0

  const submit = () => {
    if (blocked) return setError(TOO_MANY)
    if (!code) return setError('Enter your recovery code.')
    if (code.replace(/-/g, '') === lock?.recovery.replace(/-/g, '')) return onReset()
    const t = tries + 1
    if (t >= 5) {
      setTries(0)
      cool.start()
      return setError(TOO_MANY)
    }
    setTries(t)
    setError("That code doesn't match. Check it and try again.")
  }

  return (
    <>
      <AppBar title="Reset your lock" onBack={onBack} />
      <Body>
        <T tone="fg2">Enter the recovery code you saved when you set up the lock. Your payments and {useType === 'personal' ? 'categories' : 'groups'} stay.</T>
        <TextField
          style={{ marginTop: 24 }}
          label="Recovery code"
          placeholder="XXXX-XXXX-XXXX"
          value={code}
          onChange={(v) => setCode(formatCode(v))}
          error={error}
          helper={blocked ? `You can try again in ${cool.left} seconds.` : undefined}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={14}
          inputStyle={{ letterSpacing: 2, fontVariant: ['tabular-nums'] }}
          onFocus={() => !blocked && setError(null)}
          onBlur={() => code && code.length < 14 && setError('Enter all 12 characters of the code.')}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
      </Body>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 4 }}>
        <Button full onPress={submit}>
          Reset lock
        </Button>
        <Button variant="text" full onPress={() => setErase(true)}>
          I lost my recovery code
        </Button>
      </View>
      <Dialog
        open={erase}
        onCancel={() => setErase(false)}
        title="Erase all AuCourant data from this phone?"
        body={
          useType === 'personal'
            ? 'Payments come back from your messages after a new scan, but your categories, rules and nicknames are lost. Exported reports stay in your files.'
            : 'Payments come back from your messages after a new scan, but your group names, merges, reference codes and sessions are lost. Exported reports stay in your files.'
        }
        confirmLabel="Erase data"
        onConfirm={() => {
          setErase(false)
          eraseAll()
        }}
      />
    </>
  )
}

const useStyles = makeStyles((c) => ({
  types: { flexDirection: 'row', gap: 8 },
  type: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.strokeStrong,
    paddingHorizontal: 8,
  },
  typeOn: { borderColor: c.accent, backgroundColor: c.selected },
  codeBox: {
    marginTop: 24,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.inset,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  twoBtns: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  centered: { alignItems: 'center', justifyContent: 'center' },
}))
