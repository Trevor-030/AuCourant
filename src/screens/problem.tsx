import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as SplashScreen from 'expo-splash-screen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { describeError } from '../lib/crash'
import { CrashNative } from '../native/crash'
import { dark as c } from '../theme/tokens'

/*
 * The problem report. These screens use nothing from the app (no store, theme, fonts or kit),
 * because any of those may be what went wrong. They are always dark.
 */

function ProblemScreen({ title, report, action, onContinue }: { title: string; report: string; action: string; onContinue: () => void }) {
  const insets = useSafeAreaInsets()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])
  const copy = () => {
    Clipboard.setStringAsync(report)
      .then(() => setCopied(true))
      .catch(() => {})
  }
  return (
    <View style={[s.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={s.body}>
        AuCourant ran into a problem. Your MoMo messages are not changed. Send this report to the person who set up AuCourant. It stays on this phone unless you share it. Phone numbers and transaction IDs are hidden, but read it before you share it: an error can quote a name.
      </Text>
      <ScrollView style={s.box} contentContainerStyle={{ padding: 12 }}>
        <Text style={s.report} selectable>
          {report}
        </Text>
      </ScrollView>
      <View style={s.row}>
        <ProblemButton label={copied ? 'Copied' : 'Copy report'} onPress={copy} />
        <ProblemButton label="Share report" onPress={() => void Share.share({ message: report }).catch(() => {})} />
      </View>
      <ProblemButton label={action} main onPress={onContinue} />
    </View>
  )
}

function ProblemButton({ label, main, onPress }: { label: string; main?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.button, main && s.main, !main && { flex: 1 }, pressed && { opacity: 0.8 }]}>
      <Text style={s.label}>{label}</Text>
    </Pressable>
  )
}

/** A recorder that does not answer must not keep the app closed. */
const ANSWER_WITHIN_MS = 3000

/** At launch, shows the report of the last problem before anything else of the app runs. */
export function ProblemGate({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<string | null | undefined>(() => (CrashNative.available() ? undefined : null))
  useEffect(() => {
    if (report !== undefined) return
    let done = false
    const answer = (r: string | null) => {
      if (done) return
      done = true
      setReport(r)
    }
    const timer = setTimeout(() => answer(null), ANSWER_WITHIN_MS)
    CrashNative.pending()
      .then(answer)
      .catch(() => answer(null))
    return () => {
      done = true
      clearTimeout(timer)
    }
    // Once, at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (report === undefined) return <View style={s.root} />
  if (report) {
    const next = () => {
      CrashNative.clear().catch(() => {})
      setReport(null)
    }
    return <ProblemScreen title="AuCourant closed by itself" report={report} action="Continue to AuCourant" onContinue={next} />
  }
  return <ProblemBoundary>{children}</ProblemBoundary>
}

/** Catches an error in any screen: records it and shows the report instead of closing the app. */
class ProblemBoundary extends Component<{ children: ReactNode }, { report: string | null }> {
  state: { report: string | null } = { report: null }

  static getDerivedStateFromError(error: unknown) {
    return { report: describeError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    CrashNative.record('Screen error', describeError(error, info.componentStack))
    // The saved report has the steps and the phone as well.
    CrashNative.pending()
      .then((report) => {
        if (report) this.setState((st) => (st.report === null ? st : { report }))
      })
      .catch(() => {})
  }

  render() {
    if (this.state.report === null) return this.props.children
    const again = () => {
      CrashNative.clear().catch(() => {})
      this.setState({ report: null })
    }
    return <ProblemScreen title="Something went wrong" report={this.state.report} action="Try again" onContinue={again} />
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.canvas, paddingHorizontal: 16, gap: 12 },
  title: { color: c.fg, fontSize: 24, fontWeight: '600' },
  body: { color: c.fg2, fontSize: 14, lineHeight: 20 },
  box: { flex: 1, backgroundColor: c.inset, borderRadius: 12 },
  report: { color: c.fg, fontSize: 12, lineHeight: 17, fontFamily: Platform.OS === 'android' ? 'monospace' : undefined },
  row: { flexDirection: 'row', gap: 8 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.strokeStrong, paddingHorizontal: 12 },
  main: { backgroundColor: c.btn, borderColor: c.btn },
  label: { color: c.fg, fontSize: 16, fontWeight: '500' },
})
