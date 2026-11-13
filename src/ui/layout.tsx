import type { ReactNode } from 'react'
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { BRAND, RADIUS, makeStyles } from '../theme'

/** Scrolling body under an AppBar. 16px gutters, like the Figma frames. */
export function Body({
  children,
  style,
  padX = 16,
  padBottom = 24,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  padX?: number
  padBottom?: number
}) {
  const s = useStyles()
  return (
    <ScrollView
      style={s.fill}
      contentContainerStyle={[{ paddingHorizontal: padX, paddingBottom: padBottom }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

/** Fixed action bar at the bottom of a screen, with a top hairline. */
export function Footer({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles()
  return <View style={[s.footer, style]}>{children}</View>
}

export function Fill({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles()
  return <View style={[s.fill, style]}>{children}</View>
}

/** Signature gradient. Brand moments only: Welcome hero, Home total card. */
export function BrandGradient({ children, style, rounded }: { children: ReactNode; style?: StyleProp<ViewStyle>; rounded?: boolean }) {
  return (
    <LinearGradient
      colors={BRAND.gradient}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ overflow: 'hidden' }, rounded && { borderRadius: RADIUS.lg }, style]}
    >
      {children}
    </LinearGradient>
  )
}

/** Soft emerald radial glow behind hero content. Decorative. */
export function EmeraldGlow({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#35a879" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#35a879" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#g)" />
      </Svg>
    </View>
  )
}

const useStyles = makeStyles((c) => ({
  fill: { flex: 1, minHeight: 0 },
  footer: { borderTopWidth: 1, borderTopColor: c.stroke, paddingHorizontal: 16, paddingVertical: 16 },
}))
