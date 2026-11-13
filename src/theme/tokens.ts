/**
 * Midnight Emerald Gold. Mirrors the Figma variables (see docs/figma-brief.md).
 * Dark is its own palette, not an inversion. No purple.
 */
export type Palette = {
  canvas: string
  surface: string
  inset: string
  raised: string
  decision: string
  onDecision: string
  onDecision2: string
  stroke: string
  strokeStrong: string
  fg: string
  fg2: string
  fg3: string
  accent: string
  accentRing: string
  btn: string
  btnPressed: string
  onBtn: string
  selected: string
  error: string
  errorBg: string
  warning: string
  warningBg: string
  gold: string
  destructive: string
  scrim: string
  snack: string
  onSnack: string
  snackAction: string
}

export const dark: Palette = {
  canvas: '#080d0c',
  surface: '#0e1a16',
  inset: '#13241e',
  raised: '#1a2f27',
  decision: '#1c1910',
  onDecision: '#e8eee9',
  onDecision2: '#a3b1aa',
  stroke: 'rgba(232,238,233,0.1)',
  strokeStrong: 'rgba(232,238,233,0.18)',
  fg: '#e8eee9',
  fg2: '#a3b1aa',
  fg3: '#8a988f',
  accent: '#35a879',
  accentRing: 'rgba(53,168,121,0.35)',
  btn: '#0d5a40',
  btnPressed: '#0a4733',
  onBtn: '#e8eee9',
  selected: '#13241e',
  error: '#ff9a92',
  errorBg: '#2a1513',
  warning: '#e8b54a',
  warningBg: '#2b2108',
  gold: '#c8aa72',
  destructive: '#b3261e',
  scrim: 'rgba(0,0,0,0.6)',
  snack: '#1a2f27',
  onSnack: '#e8eee9',
  snackAction: '#35a879',
}

export const light: Palette = {
  canvas: '#f3f6f2',
  surface: '#ffffff',
  inset: '#eaf0ec',
  raised: '#ffffff',
  decision: '#f3ecdb',
  onDecision: '#1d2321',
  onDecision2: '#46534c',
  stroke: 'rgba(29,35,33,0.1)',
  strokeStrong: 'rgba(29,35,33,0.2)',
  fg: '#1d2321',
  fg2: '#46534c',
  fg3: '#5f6c66',
  accent: '#0d5a40',
  accentRing: 'rgba(13,90,64,0.35)',
  btn: '#0d5a40',
  btnPressed: '#0a4733',
  onBtn: '#ffffff',
  selected: '#ddebe5',
  error: '#b3261e',
  errorBg: '#fcedeb',
  warning: '#8a5a00',
  warningBg: '#fff4db',
  gold: '#8a6d2f',
  destructive: '#b3261e',
  scrim: 'rgba(8,13,12,0.4)',
  snack: '#1d2321',
  onSnack: '#f3f6f2',
  snackAction: '#35a879',
}

/** Brand moments only (Welcome hero, Home total card). Same in both themes. */
export const BRAND = {
  gradient: ['#0d5a40', '#0f4636', '#0a2a26'] as const,
  onBrand: '#e8eee9',
  onBrand80: 'rgba(232,238,233,0.8)',
  gold: '#c8aa72',
}

export const FONT = {
  display: 'InstrumentSerif_400Regular',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
}

/** Type scale from the Figma brief: size and line height in px. */
export const TYPE = {
  meta: { fontSize: 12, lineHeight: 18 },
  sec: { fontSize: 14, lineHeight: 21 },
  body: { fontSize: 16, lineHeight: 24 },
  section: { fontSize: 20, lineHeight: 24 },
  title: { fontSize: 24, lineHeight: 29 },
  big: { fontSize: 32, lineHeight: 38, letterSpacing: -0.32 },
  hero: { fontSize: 32, lineHeight: 37 },
}

export const RADIUS = { sm: 4, md: 6, lg: 8, xl: 12, full: 999 }

/** Motion: 100/150/200/300ms only. */
export const DURATION = { fast: 100, exit: 150, enter: 200, slow: 300 }
