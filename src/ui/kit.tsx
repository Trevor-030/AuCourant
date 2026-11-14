import { Children, Fragment, isValidElement, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { BRAND, FONT, RADIUS, TYPE, makeStyles, useTheme } from '../theme'
import { ArrowLeftIcon, CaretDownIcon, CheckIcon, MagnifyingGlassIcon, WarningCircleIcon, XIcon, type Icon } from './icons'
import { T, tabular, type Tone } from './text'

export { T, tabular }

// ---------------------------------------------------------------------------------
// Buttons

type Variant = 'primary' | 'secondary' | 'text' | 'destructive'

export function Button({
  variant = 'primary',
  loading,
  icon: I,
  full,
  style,
  onPress,
  children,
  disabled,
  tone,
}: {
  variant?: Variant
  loading?: boolean
  icon?: Icon
  full?: boolean
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  children: ReactNode
  disabled?: boolean
  /** Text colour override, for buttons placed on error or decision surfaces. */
  tone?: Tone
}) {
  const s = useStyles()
  const { c } = useTheme()
  const fg = tone
    ? undefined
    : variant === 'primary' || variant === 'destructive'
      ? c.onBtn
      : variant === 'text'
        ? c.accent
        : c.fg
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: c.stroke, borderless: false }}
      style={({ pressed }) => [
        s.btn,
        variant === 'text' ? s.btnText : s.btnPad,
        variant === 'primary' && { backgroundColor: pressed ? c.btnPressed : c.btn },
        variant === 'destructive' && { backgroundColor: c.destructive, opacity: pressed ? 0.9 : 1 },
        variant === 'secondary' && [s.btnSecondary, pressed && { backgroundColor: c.inset }],
        variant === 'text' && pressed && { backgroundColor: c.inset },
        full && s.full,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg ?? c.fg} /> : I ? <I size={20} color={fg ?? c.fg} /> : null}
      <T w="medium" numberOfLines={1} color={fg} tone={tone}>
        {children}
      </T>
    </Pressable>
  )
}

/** Icon-only button. Long-press shows its label, since touch has no hover. */
export function IconButton({
  label,
  icon: I,
  onPress,
  size = 24,
  weight,
  color,
  tipAlign = 'center',
  style,
  disabled,
}: {
  label: string
  icon: Icon
  onPress?: () => void
  disabled?: boolean
  size?: number
  weight?: 'regular' | 'fill' | 'bold'
  color?: string
  tipAlign?: 'center' | 'end' | 'start'
  style?: StyleProp<ViewStyle>
}) {
  const s = useStyles()
  const { c } = useTheme()
  const [tip, setTip] = useState(false)
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(false), 1200)
    return () => clearTimeout(t)
  }, [tip])
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      onLongPress={() => setTip(true)}
      hitSlop={4}
      style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: c.inset }, style]}
    >
      <I size={size} weight={weight} color={disabled ? c.fg3 : (color ?? c.fg2)} />
      {tip && (
        <View pointerEvents="none" style={[s.tip, tipAlign === 'end' ? { right: 0 } : tipAlign === 'start' ? { left: 0 } : s.tipCenter]}>
          <T v="meta" tone="onSnack" numberOfLines={1}>
            {label}
          </T>
        </View>
      )}
    </Pressable>
  )
}

/** Inline text link, used inside a sentence ("See these", "Manage"). */
export function LinkText({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}>
      <T v="sec" w="medium" tone="accent">
        {children}
      </T>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------------
// Structure

export function AppBar({ title, onBack, actions }: { title?: ReactNode; onBack?: () => void; actions?: ReactNode }) {
  const s = useStyles()
  return (
    <View style={[s.appBar, { paddingLeft: onBack ? 4 : 16 }]}>
      {onBack && <IconButton label="Back" icon={ArrowLeftIcon} onPress={onBack} tipAlign="start" />}
      <View style={s.flex1}>
        {typeof title === 'string' ? (
          <T v="title" w="display" numberOfLines={1} accessibilityRole="header">
            {title}
          </T>
        ) : (
          title
        )}
      </View>
      {actions}
    </View>
  )
}

/** The logo lives in ./logo (drawn from the brand masters). Re-exported so existing imports keep working. */
export { AppIcon, Lockup, LogoMark, Wordmark } from './logo'

/** Bordered card. With `divided`, children are separated by hairlines (Tailwind divide-y). */
export function Surface({ children, style, divided }: { children: ReactNode; style?: StyleProp<ViewStyle>; divided?: boolean }) {
  const s = useStyles()
  return <View style={[s.surface, style]}>{divided ? <Divided>{children}</Divided> : children}</View>
}

export function Divided({ children }: { children: ReactNode }) {
  const s = useStyles()
  const items = flatten(children)
  return (
    <>
      {items.map((child, i) => (
        <Fragment key={isValidElement(child) && child.key != null ? child.key : i}>
          {i > 0 && <View style={s.hairline} />}
          {child}
        </Fragment>
      ))}
    </>
  )
}

function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((c) => (isValidElement<{ children?: ReactNode }>(c) && c.type === Fragment ? flatten(c.props.children) : [c]))
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const s = useStyles()
  return <View style={[s.hairline, style]} />
}

export function SectionLabel({ children, end }: { children: ReactNode; end?: ReactNode }) {
  const s = useStyles()
  return (
    <View style={[s.between, { marginBottom: 8 }]}>
      <T v="sec" w="medium" tone="fg2" accessibilityRole="header">
        {children}
      </T>
      {end}
    </View>
  )
}

export function SectionTitle({ children, end }: { children: ReactNode; end?: ReactNode }) {
  const s = useStyles()
  return (
    <View style={[s.between, { marginBottom: 12 }]}>
      <T v="section" w="semibold" accessibilityRole="header">
        {children}
      </T>
      {end}
    </View>
  )
}

export function Row({
  title,
  sub,
  end,
  endSub,
  onPress,
  leading,
  trailing,
  titleTone = 'fg',
  titleWeight = 'regular',
  endTone = 'fg',
  style,
}: {
  title: ReactNode
  sub?: ReactNode
  end?: ReactNode
  endSub?: ReactNode
  onPress?: () => void
  leading?: ReactNode
  trailing?: ReactNode
  titleTone?: Tone
  titleWeight?: 'regular' | 'medium'
  endTone?: Tone
  style?: StyleProp<ViewStyle>
}) {
  const s = useStyles()
  const { c } = useTheme()
  const inner = (
    <>
      {leading}
      <View style={s.flex1}>
        <T numberOfLines={1} tone={titleTone} w={titleWeight}>
          {title}
        </T>
        {sub != null && (
          <T v="sec" tone="fg2" numberOfLines={1}>
            {sub}
          </T>
        )}
      </View>
      {end != null && (
        <View style={s.rowEnd}>
          <T num tone={endTone}>
            {end}
          </T>
          {endSub != null && (
            <T v="sec" tone="fg2">
              {endSub}
            </T>
          )}
        </View>
      )}
      {trailing}
    </>
  )
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: c.inset }, style]}>
      {inner}
    </Pressable>
  ) : (
    <View style={[s.row, style]}>{inner}</View>
  )
}

export function Chip({ selected, onPress, children, caret }: { selected?: boolean; onPress: () => void; children: ReactNode; caret?: boolean }) {
  const s = useStyles()
  const { c } = useTheme()
  const color = selected ? c.accent : c.fg2
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={s.chipHit}>
      {({ pressed }) => (
        <View style={[s.chip, selected ? s.chipOn : pressed && { backgroundColor: c.inset }]}>
          {selected && !caret && <CheckIcon size={16} color={color} />}
          <T v="sec" w="medium" color={color}>
            {children}
          </T>
          {caret && <CaretDownIcon size={16} color={color} />}
        </View>
      )}
    </Pressable>
  )
}

export function Radio({ checked, disabled, size = 20 }: { checked: boolean; disabled?: boolean; size?: number }) {
  const { c } = useTheme()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: checked ? c.accent : disabled ? c.strokeStrong : c.fg3,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <View style={{ width: size / 2, height: size / 2, borderRadius: size / 4, backgroundColor: c.accent }} />}
    </View>
  )
}

export function RadioRow({
  checked,
  onSelect,
  label,
  sub,
  end,
}: {
  checked: boolean
  onSelect: () => void
  label: ReactNode
  sub?: ReactNode
  end?: ReactNode
}) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onSelect}
      style={({ pressed }) => [s.radioRow, pressed && { backgroundColor: c.inset }]}
    >
      <Radio checked={checked} />
      <View style={s.flex1}>
        <T numberOfLines={1}>{label}</T>
        {sub != null && (
          <T v="sec" tone="fg2" numberOfLines={1}>
            {sub}
          </T>
        )}
      </View>
      {end}
    </Pressable>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const s = useStyles()
  const { c, reduced } = useTheme()
  const x = useRef(new Animated.Value(checked ? 20 : 0)).current
  useEffect(() => {
    Animated.timing(x, { toValue: checked ? 20 : 0, duration: reduced ? 0 : 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [checked, reduced, x])
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={[s.switch, checked ? { backgroundColor: c.btn, borderColor: c.btn } : { backgroundColor: c.inset, borderColor: c.strokeStrong }]}
    >
      <Animated.View style={[s.knob, { backgroundColor: checked ? c.onBtn : c.fg3, transform: [{ translateX: x }] }]}>
        {checked && <CheckIcon size={14} weight="bold" color={c.btn} />}
      </Animated.View>
    </Pressable>
  )
}

export function SwitchRow({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  const s = useStyles()
  return (
    <View style={s.row}>
      <Pressable style={s.flex1} onPress={() => onChange(!checked)} accessible={false}>
        <T>{label}</T>
        {sub && (
          <T v="sec" tone="fg2">
            {sub}
          </T>
        )}
      </Pressable>
      <Switch checked={checked} onChange={onChange} label={label} />
    </View>
  )
}

export function CheckRow({
  checked,
  onChange,
  label,
  disabled,
  sub,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
  sub?: string
}) {
  const s = useStyles()
  const { c } = useTheme()
  const on = checked && !disabled
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={s.checkRow}
    >
      <View style={[s.box, on ? { backgroundColor: c.btn, borderColor: c.btn } : { borderColor: disabled ? c.strokeStrong : c.fg3 }]}>
        {on && <CheckIcon size={14} weight="bold" color={c.onBtn} />}
      </View>
      <T style={s.flex1} tone={disabled ? 'fg3' : 'fg'}>
        {label}
      </T>
      {sub && (
        <T v="sec" tone="fg3">
          {sub}
        </T>
      )}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------------
// Inputs

export function InlineError({ children }: { children: ReactNode }) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <View style={s.inlineError} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <WarningCircleIcon size={16} color={c.error} style={{ marginTop: 3 }} />
      <T v="sec" tone="error" style={s.flex1}>
        {children}
      </T>
    </View>
  )
}

type FieldProps = Omit<TextInputProps, 'onChange' | 'value' | 'onChangeText' | 'style'> & {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | null
  helper?: ReactNode
  trailing?: ReactNode
  style?: StyleProp<ViewStyle>
  inputStyle?: TextInputProps['style']
  /** Read-only fields show the value without a keyboard. */
  readOnly?: boolean
  inputRef?: Ref<TextInputInstance>
}

export function TextField({ label, value, onChange, error, helper, trailing, style, inputStyle, readOnly, onFocus, onBlur, inputRef, ...rest }: FieldProps) {
  const s = useStyles()
  const { c } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={style}>
      <T v="sec" w="medium" style={{ marginBottom: 8 }}>
        {label}
      </T>
      <View style={[s.field, { borderColor: error ? c.error : focused ? c.accent : c.strokeStrong }]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          editable={!readOnly}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={c.fg3}
          selectionColor={c.accent}
          cursorColor={c.accent}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[s.input, readOnly && { color: c.fg2 }, inputStyle]}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <InlineError>{error}</InlineError>
      ) : helper ? (
        <T v="meta" tone="fg3" style={{ marginTop: 8 }}>
          {helper}
        </T>
      ) : null}
    </View>
  )
}

export function SearchField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const s = useStyles()
  const { c } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={[s.field, s.search, { borderColor: focused ? c.accent : c.strokeStrong }]}>
      <MagnifyingGlassIcon size={20} color={c.fg3} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={c.fg3}
        selectionColor={c.accent}
        cursorColor={c.accent}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[s.input, { paddingHorizontal: 0 }]}
      />
      {value ? <IconButton label="Clear search" icon={XIcon} size={20} onPress={() => onChange('')} tipAlign="end" /> : <View style={{ width: 12 }} />}
    </View>
  )
}

// ---------------------------------------------------------------------------------
// States

export function EmptyState({ icon: I, title, body, action, onAction }: { icon: Icon; title: string; body: string; action: string; onAction: () => void }) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <View style={s.empty}>
      <I size={40} color={c.fg3} />
      <T v="section" w="semibold" style={{ marginTop: 16, textAlign: 'center' }}>
        {title}
      </T>
      <T v="sec" tone="fg2" style={{ marginTop: 8, maxWidth: 260, textAlign: 'center' }}>
        {body}
      </T>
      <Button variant="secondary" style={{ marginTop: 24 }} onPress={onAction}>
        {action}
      </Button>
    </View>
  )
}

export function Skel({ w, h, r = RADIUS.sm, style }: { w?: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: c.inset }, style]} />
}

const SKEL_W = [128, 96, 160, 112, 144]

export function SkeletonRows({ n = 5, amount = true }: { n?: number; amount?: boolean }) {
  const s = useStyles()
  return (
    <View accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
      <Divided>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={s.row}>
            <View style={[s.flex1, { gap: 8 }]}>
              <Skel h={16} w={SKEL_W[i % 5]} />
              <Skel h={12} w={80} />
            </View>
            {amount && <Skel h={16} w={80} />}
          </View>
        ))}
      </Divided>
    </View>
  )
}

export function Expandable({ title, sub, children, defaultOpen = false }: { title: string; sub?: string; children: ReactNode; defaultOpen?: boolean }) {
  const s = useStyles()
  const { c } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Surface>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [s.row, pressed && { backgroundColor: c.inset }]}
      >
        <View style={s.flex1}>
          <T>{title}</T>
          {sub && (
            <T v="sec" tone="fg2">
              {sub}
            </T>
          )}
        </View>
        <CaretDownIcon size={20} color={c.fg2} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>}
    </Surface>
  )
}

/** Label and value stacked. Used inside detail cards, separated by space not lines. */
export function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: string }) {
  return (
    <View>
      <T v="sec" tone="fg2">
        {label}
      </T>
      {typeof children === 'string' ? <T>{children}</T> : children}
      {helper && (
        <T v="meta" tone="fg3">
          {helper}
        </T>
      )}
    </View>
  )
}

/** Alert box on the error surface (scan and export failures). */
export function ErrorBox({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const s = useStyles()
  const { c } = useTheme()
  return (
    <View style={s.errorBox} accessibilityRole="alert">
      <WarningCircleIcon size={20} color={c.error} style={{ marginTop: 2 }} />
      <View style={s.flex1}>
        <T v="sec" tone="error">
          {children}
        </T>
        {action}
      </View>
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  flex1: { flex: 1, minWidth: 0 },
  full: { alignSelf: 'stretch' },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  btn: {
    height: 48,
    minWidth: 48,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  btnPad: { paddingHorizontal: 20 },
  btnText: { paddingHorizontal: 12 },
  btnSecondary: { borderWidth: 1, borderColor: c.strokeStrong },
  iconBtn: { width: 48, height: 48, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  tip: {
    position: 'absolute',
    top: 50,
    zIndex: 30,
    backgroundColor: c.snack,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tipCenter: { alignSelf: 'center' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
  surface: { overflow: 'hidden', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface },
  hairline: { height: 1, backgroundColor: c.stroke },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowEnd: { alignItems: 'flex-end', flexShrink: 0 },
  chipHit: { height: 48, justifyContent: 'center' },
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.strokeStrong,
    paddingHorizontal: 16,
  },
  chipOn: { borderColor: c.accent, backgroundColor: c.selected },
  radioRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  switch: { width: 52, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  inlineError: { flexDirection: 'row', gap: 6, marginTop: 8 },
  field: { height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.lg, borderWidth: 1, backgroundColor: c.surface },
  search: { paddingLeft: 12, gap: 8 },
  input: { flex: 1, minWidth: 0, height: '100%', paddingHorizontal: 16, color: c.fg, fontFamily: FONT.regular, ...TYPE.body, lineHeight: undefined },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  errorBox: { flexDirection: 'row', gap: 12, borderRadius: RADIUS.lg, backgroundColor: c.errorBg, padding: 16 },
}))
