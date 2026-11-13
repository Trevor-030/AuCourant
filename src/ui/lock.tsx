import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { RADIUS, makeStyles, useTheme } from '../theme'
import { BackspaceIcon, EyeIcon, EyeSlashIcon } from './icons'
import { IconButton, T, TextField } from './kit'

export function PinDots({
  length,
  filled,
  error,
  active,
  label,
  onActivate,
  center,
}: {
  length: number
  filled: number
  error?: boolean
  active?: boolean
  label: string
  onActivate?: () => void
  center?: boolean
}) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole={onActivate ? 'button' : undefined}
      accessibilityLabel={`${label}, ${filled} of ${length} digits entered`}
      onPress={onActivate}
      disabled={!onActivate}
      style={[s.dots, center && { justifyContent: 'center' }, onActivate && [s.dotsBox, { borderColor: active ? c.accent : c.stroke }]]}
    >
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          style={[
            s.dot,
            i < filled ? { backgroundColor: error ? c.error : c.fg } : { borderWidth: 2, borderColor: error ? c.error : c.fg3 },
          ]}
        />
      ))}
    </Pressable>
  )
}

export function Keypad({
  onDigit,
  onBackspace,
  disabled,
  leftKey,
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  disabled?: boolean
  leftKey?: ReactNode
}) {
  const s = useStyles()
  const { c } = useTheme()
  const key = (d: string) => (
    <Pressable
      key={d}
      accessibilityRole="button"
      accessibilityLabel={d}
      disabled={disabled}
      onPress={() => onDigit(d)}
      style={({ pressed }) => [s.key, pressed && { backgroundColor: c.inset }]}
    >
      <T v="title" w="medium" num tone={disabled ? 'fg3' : 'fg'}>
        {d}
      </T>
    </Pressable>
  )
  return (
    <View accessibilityLabel="Number keypad" style={s.pad}>
      {[
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
      ].map((r) => (
        <View key={r[0]} style={s.padRow}>
          {r.map(key)}
        </View>
      ))}
      <View style={s.padRow}>
        <View style={s.keySlot}>{leftKey}</View>
        {key('0')}
        <View style={s.keySlot}>
          <IconButton label="Delete digit" icon={BackspaceIcon} onPress={disabled ? undefined : onBackspace} tipAlign="end" />
        </View>
      </View>
    </View>
  )
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  helper,
  onBlur,
  onFocus,
  autoFocus,
  onEnter,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | null
  helper?: string
  onBlur?: () => void
  onFocus?: () => void
  autoFocus?: boolean
  onEnter?: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      helper={helper}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      importantForAutofill="no"
      autoFocus={autoFocus}
      onBlur={onBlur}
      onFocus={onFocus}
      returnKeyType="done"
      onSubmitEditing={onEnter}
      trailing={<IconButton label={show ? 'Hide password' : 'Show password'} icon={show ? EyeSlashIcon : EyeIcon} size={20} onPress={() => setShow(!show)} tipAlign="end" />}
    />
  )
}

const useStyles = makeStyles((c) => ({
  dots: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: RADIUS.lg, paddingHorizontal: 16, alignSelf: 'stretch' },
  dotsBox: { borderWidth: 1, backgroundColor: c.surface },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pad: { gap: 4 },
  padRow: { flexDirection: 'row', gap: 4 },
  key: { flex: 1, height: 56, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  keySlot: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
}))
