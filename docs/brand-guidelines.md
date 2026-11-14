# AuCourant: Logo and brand guidelines

> Version 1. The logo is **Gold Standard**: a gold Instrument Serif "Au" over a thin gold line, on the emerald gradient. Colours mirror `src/theme/tokens.ts`. Files live in `assets/brand/`.

## The idea

**Gold Au over a thin gold line: the Home total card in miniature.**

- **Au** is the chemical symbol for gold, and the gold half of the AuCourant wordmark.
- **The line** is the thin gold line under the big total on Home: the number you came for, sorted.
- No cross, church, coin or cedi sign. The mark fits Church, Organisation and Personal or business use alike.

## The parts

| Part | File | Use it for |
|---|---|---|
| App icon (tile) | `svg/aucourant-app-icon.svg` | Launcher icon, avatars, the README, anywhere the mark stands alone |
| App icon, small cut | `svg/aucourant-app-icon-small.svg` | 24 px and below: favicon, notification-sized spots |
| App icon, flat | `svg/aucourant-app-icon-flat.svg` | Print, embroidery, anywhere a gradient can't reproduce |
| Symbol | `svg/aucourant-symbol-gold.svg` | The bare mark on midnight or emerald (splash screen) |
| Symbol, light | `svg/aucourant-symbol-gold-light-bg.svg` | The bare mark on light backgrounds |
| Horizontal lockup | `svg/aucourant-logo-horizontal-{dark,light}.svg` | Default logo: headers, download page, documents |
| Stacked lockup | `svg/aucourant-logo-stacked-{dark,light}.svg` | Square spaces, cover pages, Welcome-style moments. Includes the tagline |
| Wordmark | `svg/aucourant-wordmark-{dark,light}.svg` | When the icon is already on screen (inside the app) |
| One colour | `svg/*-black.svg`, `*-white.svg`, `*-emerald.svg` | Stamps, faxed or photocopied reports, single-ink print |

`-dark` files are for midnight backgrounds, `-light` files for light ones. `-transparent` lockups have no background box. PNGs of the main files are in `assets/brand/png/`. The app's own icon files (`assets/icon.png`, `android-icon-*.png`, `splash-icon.png`, `favicon.png`) are built from `svg/app/`.

## Colours

| Name | HEX | RGB | Role in the logo |
|---|---|---|---|
| Champagne Gold | `#C8AA72` | 200 170 114 | "Au" and the line, on dark |
| Deep Gold | `#8A6D2F` | 138 109 47 | "Au" and the line, on light (contrast-safe) |
| Emerald | `#0D5A40` | 13 90 64 | Tile, gradient start, one-colour brand version |
| Forest Mid | `#0F4636` | 15 70 54 | Gradient middle |
| Deep Teal | `#0A2A26` | 10 42 38 | Gradient end |
| Midnight | `#080D0C` | 8 13 12 | Dark background |
| Ivory Mist | `#E8EEE9` | 232 238 233 | "Courant" on dark |
| Charcoal | `#1D2321` | 29 35 33 | "Courant" on light |

The tile gradient runs top left to bottom right: Emerald, Forest Mid at 55%, Deep Teal. For print, use the flat Emerald tile. Ask the printer to match these values against a printed proof. No CMYK or Pantone values are fixed yet.

**Approved backgrounds:** Midnight, the emerald gradient, Light canvas `#F3F6F2`, white, Soft Champagne `#F3ECDB`. On photos, use the app icon tile, never the bare gold mark.

## Type

- **Instrument Serif 400** for the wordmark. It is never set in another font, never faked bold, never stretched.
- **Inter 400** for the tagline *Stay au courant with your MoMo.*
- Both are free under the SIL Open Font License, which allows use in a logo. Every logo file has the letters converted to outlines, so no font needs to be installed to open them.

## Clear space and minimum size

- **Clear space:** keep empty space around the logo at least the height of the "u" in the wordmark (or, for the tile alone, a quarter of the tile's width).
- **App icon:** the regular file down to 32 px. At **24 px and below**, use the small cut. Its letters and line are heavier so they don't break up.
- **Horizontal lockup:** at least **120 px** wide on screen, **30 mm** in print.
- **Wordmark alone:** at least **80 px** wide on screen.

## Don't

- Don't recolour the "Au" in anything but gold (or the one-colour versions).
- Don't put the bare gold mark on mid-tone or busy backgrounds. Use the tile.
- Don't remove the gold line from the icon, or add a line under the wordmark.
- Don't add shadows, glows, outlines, bevels or a metallic gold effect.
- Don't rotate, stretch or re-space the letters.
- Don't add a cross, church or coin to the mark.
- Don't place "AuCourant" in another font next to the icon.

## Android and Expo

`app.json` already points at these files, so no config change is needed:

| File | Size | What it is |
|---|---|---|
| `assets/icon.png` | 1024 | Full-bleed tile (the launcher applies the mask) |
| `assets/android-icon-background.png` | 512 | The emerald gradient |
| `assets/android-icon-foreground.png` | 512 | Gold mark inside the 66% safe zone, transparent |
| `assets/android-icon-monochrome.png` | 432 | One-colour mark for Android 13+ themed icons |
| `assets/splash-icon.png` | 1024 | Gold mark, transparent, shown at 160 dp on Midnight |
| `assets/favicon.png` | 48 | Small cut on the tile |

Run `npx expo prebuild --clean` after updating them so `android/` picks them up.

## Rebuilding

The SVG masters were drawn in code from the two fonts. Edit `svg/app/*.svg` or the masters, then export PNGs with any SVG renderer (for example `rsvg-convert -w 1024 -h 1024 svg/app/expo-icon.svg -o ../icon.png`).

## Open items

- Trademark search for "AuCourant" (Ghana and wherever the APK is shared) and a reverse image search on the mark.
- A printed proof of the gold and emerald before any printing.
