import { Text, type TextProps, type TextStyle } from 'react-native'
import { FONT, TYPE, useTheme, type Palette } from '../theme'

export type Variant = keyof typeof TYPE
export type Tone = 'fg' | 'fg2' | 'fg3' | 'accent' | 'error' | 'gold' | 'onBtn' | 'onDecision' | 'onDecision2' | 'onSnack' | 'snackAction'
export type Weight = 'regular' | 'medium' | 'semibold' | 'display'

const TONE: Record<Tone, keyof Palette> = {
  fg: 'fg',
  fg2: 'fg2',
  fg3: 'fg3',
  accent: 'accent',
  error: 'error',
  gold: 'gold',
  onBtn: 'onBtn',
  onDecision: 'onDecision',
  onDecision2: 'onDecision2',
  onSnack: 'onSnack',
  snackAction: 'snackAction',
}

export const tabular: TextStyle = { fontVariant: ['tabular-nums'] }

/**
 * Themed text. Android picks the font file by family, so weight maps to a family
 * (Inter 400/500/600, Instrument Serif for display).
 */
export function T({
  v = 'body',
  tone = 'fg',
  w = 'regular',
  num,
  color,
  style,
  ...rest
}: TextProps & { v?: Variant; tone?: Tone; w?: Weight; num?: boolean; color?: string }) {
  const { c } = useTheme()
  return (
    <Text
      {...rest}
      style={[
        TYPE[v],
        { fontFamily: FONT[w], color: color ?? c[TONE[tone]] },
        num && tabular,
        style,
      ]}
    />
  )
}
