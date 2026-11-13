import { useEffect } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SystemUI from 'expo-system-ui'
import { useFonts } from 'expo-font'
// Per-weight imports: the package root would bundle every Inter weight (~6 MB).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular'
import { AppProvider } from './src/lib/store'
import { AppShell } from './src/AppShell'
import { CoachProvider } from './src/ui/overlays'
import { useTheme } from './src/theme'

/** Keeps the window background in step with the theme (seen behind the keyboard and on resize). */
function ThemedRoot() {
  const { c } = useTheme()
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.canvas).catch(() => {})
  }, [c.canvas])
  return <AppShell />
}

export default function App() {
  // Bundled with the app (open font licence). Nothing is fetched at runtime.
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, InstrumentSerif_400Regular })
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#080d0c' }} />
  return (
    <SafeAreaProvider>
      <AppProvider>
        <CoachProvider>
          <ThemedRoot />
        </CoachProvider>
      </AppProvider>
    </SafeAreaProvider>
  )
}
