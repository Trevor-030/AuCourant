import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutRectangle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApp, type Snack } from '../lib/store'
import { DURATION, RADIUS, makeStyles, useTheme } from '../theme'
import { Button, Divided, T } from './kit'

const EASE_ENTER = Easing.bezier(0.16, 1, 0.3, 1)
const EASE_EXIT = Easing.bezier(0.7, 0, 0.84, 0)

/**
 * Mount while open, play the exit animation, then unmount.
 * `t` runs 0 (hidden) to 1 (shown). Reduced motion uses 100ms fades only.
 */
export function usePresence(open: boolean) {
  const { reduced } = useTheme()
  const [mounted, setMounted] = useState(open)
  const t = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    if (open) {
      setMounted(true)
      Animated.timing(t, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.enter, easing: EASE_ENTER, useNativeDriver: true }).start()
    } else {
      Animated.timing(t, { toValue: 0, duration: reduced ? DURATION.fast : DURATION.exit, easing: EASE_EXIT, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false),
      )
    }
  }, [open, reduced, t])
  return { mounted, t, reduced }
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const s = useStyles()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { mounted, t, reduced } = usePresence(open)
  if (!mounted) return null
  const translateY = reduced ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] })
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: t }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[s.sheet, { maxHeight: height * 0.88, paddingBottom: insets.bottom, transform: [{ translateY }], opacity: reduced ? t : 1 }]}
        >
          <View style={s.grabber} />
          <T v="section" w="semibold" style={s.sheetTitle} accessibilityRole="header">
            {title}
          </T>
          <ScrollView style={s.flexShrink} contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={s.sheetFooter}>{footer}</View>}
        </Animated.View>
      </View>
    </Modal>
  )
}

export function Dialog({
  open,
  onCancel,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onCancel: () => void
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => void
}) {
  const s = useStyles()
  const { mounted, t, reduced } = usePresence(open)
  if (!mounted) return null
  const translateY = reduced ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] })
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onCancel}>
      <View style={s.center}>
        <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: t }]} />
        <Animated.View accessibilityRole="alert" accessibilityViewIsModal style={[s.dialog, { opacity: t, transform: [{ translateY }] }]}>
          <T v="section" w="semibold">
            {title}
          </T>
          <View style={{ marginTop: 12 }}>
            {typeof body === 'string' ? (
              <T v="sec" tone="fg2">
                {body}
              </T>
            ) : (
              body
            )}
          </View>
          <View style={s.dialogActions}>
            <Button variant="text" onPress={onCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

/** Centered modal card. Used for the Android-style permission mock and similar. */
export function CenterModal({ open, onRequestClose, children }: { open: boolean; onRequestClose: () => void; children: ReactNode }) {
  const s = useStyles()
  const { mounted, t } = usePresence(open)
  if (!mounted) return null
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onRequestClose}>
      <View style={s.center}>
        <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: t }]} />
        <Animated.View style={[s.dialog, { opacity: t }]}>{children}</Animated.View>
      </View>
    </Modal>
  )
}

/** Simple list of menu items inside a Surface-like card. */
export function MenuList({ children }: { children: ReactNode }) {
  const s = useStyles()
  return (
    <View style={s.menu}>
      <Divided>{children}</Divided>
    </View>
  )
}

/** Undo message. About 8 seconds, 8px rise plus fade. */
export function SnackbarHost({ bottom }: { bottom: number }) {
  const s = useStyles()
  const { snack, setSnack } = useApp()
  const [shown, setShown] = useState<Snack | null>(null)
  const { mounted, t, reduced } = usePresence(!!snack)
  useEffect(() => {
    if (!snack) return
    setShown(snack)
    const timer = setTimeout(() => setSnack(null), 8000)
    return () => clearTimeout(timer)
  }, [snack, setSnack])
  if (!mounted || !shown) return null
  const translateY = reduced ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] })
  return (
    <Animated.View
      key={shown.id}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[s.snackWrap, { bottom, opacity: t, transform: [{ translateY }] }]}
    >
      <View style={s.snack}>
        <T v="sec" tone="onSnack" style={s.snackText}>
          {shown.message}
        </T>
        {shown.action && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              shown.action?.run()
              setSnack(null)
            }}
            style={s.snackAction}
          >
            <T v="sec" w="medium" tone="snackAction">
              {shown.action.label}
            </T>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

// ---------------------------------------------------------------------------------
// Coach marks: first-use tips. One at a time, three in total.

export type CoachTarget = 'service' | 'review' | 'export-tab'

const COACH: { target: CoachTarget; title: string; body: string }[] = [
  { target: 'service', title: 'Choose a service', body: 'Pick which Sunday or special session you are counting.' },
  { target: 'review', title: 'Decide in one place', body: 'Confirm suggested merges and check messages the app could not read.' },
  { target: 'export-tab', title: 'Export when ready', body: 'Make a PDF or Excel report for the service you chose.' },
]

/** Personal or business: the same three targets, with period wording. */
const COACH_PERSONAL: typeof COACH = [
  { target: 'service', title: 'Choose a period', body: 'See today, this week, this month or any dates you choose.' },
  { target: 'review', title: 'Sort the odd ones', body: 'Put payments in a category once. The app offers to do the same for that person next time.' },
  { target: 'export-tab', title: 'Export when ready', body: 'Make a PDF or Excel report for the period you chose.' },
]

type Rects = Partial<Record<CoachTarget, LayoutRectangle>>
type SetRect = (k: CoachTarget, r: LayoutRectangle | null) => void
// Setter and rects live in separate contexts so targets don't re-render when a rect changes.
const CoachSetCtx = createContext<SetRect | null>(null)
const CoachRectsCtx = createContext<Rects | null>(null)

export function CoachProvider({ children }: { children: ReactNode }) {
  const [rects, setRects] = useState<Rects>({})
  const set = useCallback((k: CoachTarget, r: LayoutRectangle | null) => {
    setRects((prev) => {
      const cur = prev[k]
      if (!r) {
        if (!cur) return prev
        const next = { ...prev }
        delete next[k]
        return next
      }
      if (cur && cur.x === r.x && cur.y === r.y && cur.width === r.width && cur.height === r.height) return prev
      return { ...prev, [k]: r }
    })
  }, [])
  return (
    <CoachSetCtx.Provider value={set}>
      <CoachRectsCtx.Provider value={rects}>{children}</CoachRectsCtx.Provider>
    </CoachSetCtx.Provider>
  )
}

/** Attach to a View: `<View {...useCoachTarget('service')}>`. Measures in window coordinates. */
export function useCoachTarget(k: CoachTarget) {
  const set = useContext(CoachSetCtx)
  const ref = useRef<ComponentRef<typeof View>>(null)
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) set?.(k, { x, y, width, height })
    })
  }, [k, set])
  useEffect(() => {
    // Re-measure after the screen's enter animation settles.
    const t = setTimeout(measure, 250)
    return () => {
      clearTimeout(t)
      set?.(k, null)
    }
  }, [k, measure, set])
  return { ref, onLayout: measure, collapsable: false }
}

export function CoachMarks() {
  const s = useStyles()
  const { c } = useTheme()
  const { coachStep, setCoachStep, useType } = useApp()
  const COACH_LIST = useType === 'personal' ? COACH_PERSONAL : COACH
  const rects = useContext(CoachRectsCtx)
  const { width: W, height: H } = useWindowDimensions()

  // Skip tips whose target is not on screen.
  useEffect(() => {
    if (coachStep == null || !rects) return
    const t = setTimeout(() => {
      let i = coachStep
      while (i < COACH_LIST.length && !rects[COACH_LIST[i].target]) i++
      if (i >= COACH_LIST.length) setCoachStep(null)
      else if (i !== coachStep) setCoachStep(i)
    }, 400)
    return () => clearTimeout(t)
  }, [coachStep, rects, setCoachStep])

  if (coachStep == null || !rects) return null
  const step = COACH_LIST[coachStep]
  const box = rects[step.target]
  if (!box) return null
  const pad = 4
  const x = box.x - pad
  const y = box.y - pad
  const w = box.width + pad * 2
  const h = box.height + pad * 2
  const below = box.y + box.height / 2 < H / 2
  const next = () => setCoachStep(coachStep + 1 < COACH_LIST.length ? coachStep + 1 : null)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim with a hole around the target. */}
      <View style={[s.scrim, { position: 'absolute', left: 0, top: 0, width: W, height: Math.max(0, y) }]} />
      <View style={[s.scrim, { position: 'absolute', left: 0, top: y + h, width: W, bottom: 0 }]} />
      <View style={[s.scrim, { position: 'absolute', left: 0, top: y, width: Math.max(0, x), height: h }]} />
      <View style={[s.scrim, { position: 'absolute', left: x + w, top: y, right: 0, height: h }]} />
      <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: c.accent }} />
      <View accessibilityViewIsModal accessibilityLabel={step.title} style={[s.coach, below ? { top: y + h + 12 } : { bottom: H - y + 12 }]}>
        <T v="meta" tone="fg3">
          Tip {coachStep + 1} of {COACH_LIST.length}
        </T>
        <T w="medium" style={{ marginTop: 4 }}>
          {step.title}
        </T>
        <T v="sec" tone="fg2" style={{ marginTop: 4 }}>
          {step.body}
        </T>
        <View style={{ alignItems: 'flex-end', marginTop: 8, marginRight: -8, marginBottom: -8 }}>
          <Button variant="text" onPress={next}>
            Dismiss
          </Button>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  flexShrink: { flexShrink: 1 },
  scrim: { backgroundColor: c.scrim },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.raised,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.stroke,
    elevation: 12,
  },
  grabber: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: c.strokeStrong, marginTop: 12, marginBottom: 4 },
  sheetTitle: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 16 },
  sheetFooter: { borderTopWidth: 1, borderTopColor: c.stroke, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  dialog: { width: '100%', borderRadius: RADIUS.xl, backgroundColor: c.raised, padding: 24, elevation: 12 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  menu: {
    position: 'absolute',
    top: 56,
    right: 8,
    zIndex: 30,
    minWidth: 240,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.raised,
    paddingVertical: 4,
    elevation: 8,
  },
  snackWrap: { position: 'absolute', left: 16, right: 16, zIndex: 60 },
  snack: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.snack,
    paddingLeft: 16,
    paddingRight: 4,
    elevation: 6,
  },
  snackText: { flex: 1, paddingVertical: 12 },
  snackAction: { height: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.lg },
  coach: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.raised,
    padding: 16,
    elevation: 8,
  },
}))
