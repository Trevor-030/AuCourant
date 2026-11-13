import { useMemo } from 'react'
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import { useApp } from '../lib/store'
import { dark, light, type Palette } from './tokens'

export * from './tokens'

export function useTheme() {
  const { theme, motion } = useApp()
  const c = theme === 'light' ? light : dark
  return { c, isDark: theme !== 'light', reduced: motion === 'reduced' }
}

type StyleMap = { [key: string]: ViewStyle | TextStyle | ImageStyle }

/**
 * Styles built from the palette, created once per theme (not per render).
 *   const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.surface } }))
 */
export function makeStyles<S extends StyleMap>(
  // The intersection gives the literal a contextual type, so 'row' stays 'row' (same trick as StyleSheet.create).
  factory: (c: Palette) => S & StyleMap,
) {
  const cache = new Map<Palette, Readonly<S>>()
  return function useStyles(): Readonly<S> {
    const { c } = useTheme()
    return useMemo(() => {
      const hit = cache.get(c)
      if (hit) return hit
      const created = StyleSheet.create(factory(c)) as Readonly<S>
      cache.set(c, created)
      return created
    }, [c])
  }
}
