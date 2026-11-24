import { useEffect } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { useFonts } from 'expo-font'
// Per-weight imports: the package root would bundle every Inter weight (~6 MB).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular'
import { AppProvider, useApp } from './src/lib/store'
import { AppShell } from './src/AppShell'
import { CoachProvider } from './src/ui/overlays'
import { useTheme } from './src/theme'
import { ProblemGate } from './src/screens/problem'

// The splash stays up until the fonts and the saved data are loaded.
SplashScreen.preventAutoHideAsync().catch(() => {})

/** Keeps the window background in step with the theme (seen behind the keyboard and on resize). */
function ThemedRoot() {
  const { c } = useTheme()
  const { ready } = useApp()
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.canvas).catch(() => {})
  }, [c.canvas])
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])
  // Saved data loads first, so the app opens where it was (lock, app, or first run) without a flash.
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.canvas }} />
  return <AppShell />
}

function Main() {
  // Bundled with the app (open font licence). Nothing is fetched at runtime.
  const [loaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, InstrumentSerif_400Regular })
  // Without its fonts the app still works; it must not wait on the splash for ever.
  if (!loaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#080d0c' }} />
  return (
    <AppProvider>
      <CoachProvider>
        <ThemedRoot />
      </CoachProvider>
    </AppProvider>
  )
}

export default function App() {
  // The report of a problem comes before anything that could cause it again.
  return (
    <SafeAreaProvider>
      <ProblemGate>
        <Main />
      </ProblemGate>
    </SafeAreaProvider>
  )
}
