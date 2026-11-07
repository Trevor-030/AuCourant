# AuCourant: Figma Design Brief

> Version 6 (purple removed, Instrument Serif, number references, welcome screens reworked, use type choice). Source of truth for the frontend design. Built from `aucourant.prd.md` and `architecture.md`.
> Platform: **Android phone, one shared phone per church.**
> Identity: **Midnight Emerald Gold**, dark theme by default, light theme included. No purple anywhere.
> Design knowledge: **Kole Jain** lessons applied where they fit (section 3).
> Rules applied: anti-slop, typography, spacing, colour-palette, empty-states, errors, verbs, labels, page-patterns, surfaces, forms, defaults, loaders, motion, reduced-motion.

---

## 1. Design goal

A treasurer opens the app after a service and, in about **3 minutes**, sees every payment sorted by reference and exports a report. The design must make three things obvious at a glance:

1. How much came in, and for what (groups).
2. What needs a decision (suggested merges, messages the app could not read).
3. How to export.

Tone: **quiet luxury, calm, trustworthy.** This is church money. Luxury here means restraint, not decoration.

**Five-second test:** on Home, a stranger must name the total, whether something needs attention, and where to export within 5 seconds.

## 2. Who wins when sources disagree

1. **UI skill hard rules** win on working screens (surfaces, forms, motion, loaders, anti-slop).
2. **Kole Jain lessons** shape structure, colour, hierarchy and process.
3. **Midnight Emerald Gold** wins on brand moments only (Welcome, Home total card).

## 3. Kole Jain design knowledge applied

| Lesson | What changed in this design |
|---|---|
| **4-layer colour model.** Neutral foundation first, accent as a ramp, semantic colours break the brand palette, theming by shifting the neutrals | Dark mode now has **4 background layers, 2 strokes, 3 text shades** (section 5). Emerald is a small ramp with real pressed states. Status colours (error red, warning amber) are not brand colours. Success is a gold check **plus text**, so green stays the action colour. |
| **Dark mode needs about double the step between neutrals, and surfaces get lighter as they rise** | Dark steps are 0.04 to 0.05 in perceived lightness, light steps about 0.02. Sheets, dialogs and menus use the lightest dark layer. Shadows are replaced by lighter surfaces. |
| **Icon colour only for status. Neutral balance. Never invert light into dark. Red stays red** | Icons are neutral by default. Colour only for status and the active tab. Dark theme is its own palette, not an inversion. Destructive actions are always error red. |
| **Hierarchy from two weights and two colours** | Text uses Inter 400 and 500, Inter 600 for section titles and the big number, Instrument Serif 400 for screen titles, in text and secondary colour. No extra sizes to fake hierarchy. |
| **Whitespace over dividers and extra cards** | Inside cards and detail screens, groups are separated by space, not lines. Long lists (Groups, Transactions) keep one hairline divider style because they scan faster with it. |
| **Cards: group and prioritise content, not flat label lists** | Transaction detail is rebuilt: amount and sender on top, then grouped sections, with Transaction ID, Fee and Original message collapsed under *More details*. |
| **Let the data dictate the form** | Amounts right-aligned in tabular figures. Long names truncate to one line. Skipped rows are shaded. Payments are shown as a **timeline with date headers and day totals**. |
| **Progressive disclosure: secondary actions tucked away, onboarding one tooltip at a time** | Export fields hide under *Customize fields*. First-use coach marks show **one at a time, three in total**. Secondary actions sit in menus. |
| **Invisible UI: hidden states and tooltips** | Every icon-only control has a long-press label. Coach marks are designed, not skipped. |
| **Design for all states, and in flows, not isolated screens** | Every screen has loading, empty, error and populated. Six flows are wired as prototypes (section 9). |
| **Mobile: one screen does one thing, new function goes to a bottom sheet or new page, no double-nested cards, 44px or larger targets** | Applied through the surface rules in section 8. Targets are 48. No card sits inside another card. |
| **Swipe gestures as shortcuts, always with a visible button** | Merge review is a **stack, one card at a time**. Swipe right confirms, swipe left keeps separate. Both buttons stay visible. |
| **Optimistic UI** | Confirming a merge or moving a payment happens at once, with an **Undo message** at the bottom. No confirmation dialog for things that can be undone. |
| **Load more beats infinite scroll** | Transactions show 50 rows, then a *Show more payments* button. |
| **Right-thumb placement, fewer choices means faster action (Hick's law)** | Primary actions sit in the bottom third. Review shows one decision at a time. |
| **Cut redundant elements, rank widgets by importance (finance dashboard redesign)** | Home ranks: 1 total, 2 needs attention, 3 top groups. The Export button on Home is removed because the Export tab already does it. |
| **Chips: thin, auto layout, never in the primary button colour, padding about half vertical to horizontal** | Chips are 1px outlined, 32 tall with a 48 tap area, 8 by 16 padding. Selected is a tint plus Jade text, never solid emerald. |
| **Primary button gets colour, secondary gets outline** | Never two filled buttons side by side. |
| **One consistent icon set, no emoji** | **Phosphor Regular** only. 24 for navigation, 20 inline, 16 in meta. |
| **Nested corner radius: inner = outer minus the gap, plus Figma corner smoothing** | Radius table in section 6. Corner smoothing 60% on cards, sheets and buttons. |
| **Strict 4 and 8px grid, nudge amount 8** | Set Figma nudge to 8. |
| **Negative letter spacing on large text** | Only the 32 big number gets -1%. Kole's -2 to -4% is for 70px and up. |
| **Realistic content, real viewport, preview on a real device** | Fake but realistic data, 360 by 800 frames, check on a real phone with Figma Mirror. |
| **Mood board first, ugly first drafts, several variants** | Process in section 15: reference set, two Home variants, then polish. |
| **Frankenstein wireframe: take layout from references, style from the brand** | Section 15. |
| **Figma prompts need purpose, named elements, an icon library, a clean reference** | Applied in `figma-prompt.md`. |
| **Purposeful motion only** | Motion section 10. |
| **Show a working prototype to the client, not a stylised collage** | The church treasurer gets a clickable prototype on a phone. |

**Not applied, and why**

| Kole idea | Why not |
|---|---|
| Mesh gradients, kaleidoscope, clay, metallic card effects, AI glass | Decoration. Fails the anti-slop rule. Only the brand's own signature gradient is kept, on two brand moments. |
| Springs and bounce (the 636 and 550 stiffness values) | The motion rule bans bounce and overshoot on product chrome. |
| Swipe-to-confirm for irreversible actions | The surfaces rule requires a named dialog with a destructive verb and Cancel focused. |
| Group names as chips, hover reveals | Anti-slop bans pill wrappers on plain text. Touch has no hover, so long-press and menus are used. |
| Web layout ideas: bento, carousels, marquee, overlap and break-the-box, display fonts as art | This is a utility app, not a website. |
| Floating bottom bar | Docked 4-tab bar is the Android convention and fits thumb reach. |

## 4. Design rules (hard)

**Anti-slop**
- No gradients on buttons. Primary buttons are one solid emerald.
- No glass or blur. No cartoon people or mascots. Empty states use a simple Phosphor glyph.
- No icons inside text inputs unless they do a job (search, clear, show or hide PIN).
- No pill wrappers around plain text like dates, amounts or group names. Chips only for tappable filters.
- Keep list frames and search. Removing decoration must never leave a bare list.

**Typography**
- **Instrument Serif** (one weight, 400) for the AuCourant wordmark, onboarding titles (Welcome, Scan complete) and screen titles. **Inter** for everything else, with tabular figures for amounts. Section titles and the 32 big number are Inter 600. Both fonts are free (open font licence).
- Weights: Inter 400 body, 500 labels and buttons, 600 section titles and big number. Instrument Serif is 400 only, never faked bold.
- Sizes: **12 meta, 14 secondary, 16 body, 20 section title, 24 screen title, 32 big number**.
- List rows are 14 or 16, never 12. 12 is only for timestamps and helper text.
- Line height: titles 1.2, body 1.5.

**Spacing**
- 8pt grid for components, 4pt for small gaps. Tokens: 4, 8, 12, 16, 24, 32, 48.
- Screen side padding 16. Gap between sections 24 or 32. Gap inside a group 8.
- Touch targets at least **48 by 48**.

**Edge alignment**
- Every element touches at least two edges of its container (name on the left edge, amount on the right edge, sub-line under the name). Nothing floats in empty space.

**Colour balance**
- Dark target about **60% midnight, 30% forest and emerald, 5% umber decision surfaces, 5% gold**. Treat it as a sanity check on screenshots. The layers in section 5 do the real work.
- Every list sits on a visible surface with a **1px border**.
- Status is never colour alone. Always add text or an icon.

**Forms and surfaces**
- Submit buttons are **never disabled**. Tapping with missing data shows the error inline and scrolls to it.
- Errors show only after first blur, and clear on focus.
- Every input has a visible label. Placeholders show format only.
- One field, one action: **edit in place** (rename). Two or three fields under 10 seconds: **bottom sheet**. Three or more fields, or several steps: **a full page**. Never a modal on a modal.
- Every destructive action opens a dialog that **names the thing**, uses a destructive verb in error red, and focuses Cancel by default.
- Defaults are chosen and shown: export remembers the last format and fields.

**Copy**
- Buttons start with a verb, sentence case: *Export report, Confirm merge, Keep separate, Assign group*.
- Banned: OK, Submit, Proceed, Continue.
- Errors never blame, are two sentences or fewer, and give a way to recover.
- Every empty state has: headline, one sentence of value, one action button.
- No nag screens. Lock setup is offered once, and can be set up later.

## 5. Tokens (Figma variables with two modes: Dark and Light)

### Brand colours

| Name | Hex |
|---|---|
| Midnight | `#080D0C` |
| Emerald | `#0D5A40` |
| Forest Mid (gradient middle) | `#0F4636` |
| Deep Teal (gradient end) | `#0A2A26` |
| Champagne Gold | `#C8AA72` |
| Jade | `#35A879` |
| Ivory Mist | `#E8EEE9` |
| Deep Umber (dark decision surface) | `#1C1910` |
| Soft Champagne (light decision surface) | `#F3ECDB` |

Royal Aubergine, Imperial Purple, Velvet Violet, Black Plum and Soft Orchid are **removed**. No purple, violet or plum anywhere.

### Layer 1: neutral foundation

| Token | Dark (default) | Light |
|---|---|---|
| `bg-0` canvas | `#080D0C` | `#F3F6F2` |
| `bg-1` cards and lists | `#0E1A16` | `#FFFFFF` |
| `bg-2` inset areas, selected rows | `#13241E` | `#EAF0EC` |
| `bg-3` sheets, dialogs, menus (the highest layer) | `#1A2F27` | `#FFFFFF` with shadow |
| `bg-decision` merge and attention surfaces | `#1C1910` | `#F3ECDB` |
| `stroke` | Ivory at 10% | Charcoal at 10% |
| `stroke-strong` | Ivory at 18% | Charcoal at 20% |
| `text` | `#E8EEE9` | `#1D2321` |
| `text-secondary` | `#A3B1AA` | `#46534C` |
| `text-tertiary` (meta, placeholder, disabled) | `#8A988F` | `#5F6C66` |

Dark layers step up in lightness by about 0.04 to 0.05 each (twice the light theme's step), so layers stay visible without shadows.

### Layer 2: functional accent (emerald ramp)

| Role | Dark | Light |
|---|---|---|
| Button fill (emerald 600) | `#0D5A40` | `#0D5A40` |
| Button pressed (emerald 700) | `#0A4733` | `#0A4733` |
| Label on button | `#E8EEE9` | `#FFFFFF` |
| Link, icon-active, active tab, focus ring (emerald 400) | `#35A879` (Jade) | `#0D5A40` |
| Selected row tint | `bg-2` plus Jade 1px border | `#DDEBE5` |
| Disabled button | `bg-3` fill, `text-tertiary` label | `#EAF0EC` fill, `text-tertiary` label |

Optional: generate the full 50 to 900 ramp from `#0D5A40` in a ramp tool and keep 600 as the base. Darker steps drift slightly toward teal, which matches the gradient end.

### Layer 3: semantic (deliberately off-brand)

| Role | Dark | Light |
|---|---|---|
| Error | `#FF9A92` on `#2A1513` | `#B3261E` on `#FCEDEB` |
| Warning | `#E8B54A` on `#2B2108` | `#8A5A00` on `#FFF4DB` |
| Success | Gold check `#C8AA72` plus text | `#8A6D2F` check plus text |
| Destructive button | `#B3261E` fill, ivory label | `#B3261E` fill, white label |

### Layer 4: theming

Dark and Light share one structure. Changing the brand hue means shifting the neutrals with the same lightness and chroma steps. Do not recolour by hand.

### Contrast checks (measured)

| Pair | Ratio |
|---|---|
| Ivory on Midnight | 16.6 |
| Secondary text on Midnight | 8.8 |
| Tertiary text on `bg-0`, `bg-1`, `bg-2`, `bg-3` (dark) | 6.5, 5.9, 5.4, 4.7 |
| Jade on Midnight and on `bg-3` | 6.6 and 4.8 |
| Ivory on Emerald and on pressed Emerald | 7.0 and 9.1 |
| Gold on Midnight | 8.8 |
| Ivory on Deep Umber | about 15.0 |
| Secondary and tertiary text on Deep Umber | about 7.9 and 5.9 |
| Ivory on the gradient middle and end | about 9.2 and 13.1 |
| Charcoal on Light canvas | 14.7 |
| Charcoal on Soft Champagne | about 13 |
| Tertiary text on Light canvas and on white | 5.0 and 5.5 |
| Emerald on white | 8.2 |

**One trap:** Emerald `#0D5A40` on Midnight is only **2.4**, so it is a button fill only, never text, icon or focus.

The values marked "about" were worked out by hand after the purple was removed. Recheck them in a contrast tool when the variables exist.

Radius and edges: see section 6. Dark has no shadows. Use the lighter layer and a 1px top edge highlight (Ivory at 6%).

## 6. Craft details

**Icons:** Phosphor Regular only, no emoji anywhere. Sizes 24 (navigation), 20 (inline), 16 (meta). Neutral colour by default. Colour only for status and the active tab.

**Chips (filters only):** 1px outline, `text-secondary`, 32 tall with a 48 tap area, padding 8 vertical and 16 horizontal, radius 8. Selected: `bg-2` tint, Jade text and border. Never solid emerald.

**Corner radius (nested rule: inner = outer minus the gap):**

| Shape | Radius |
|---|---|
| Cards, lists, inputs, buttons | 8 |
| Bottom sheets (top corners), dialogs | 12 |
| Selected row highlight inset 4 inside a list | 4 |
| Image or glyph tile inset 4 inside a card | 4 |
| Anything inset 8 or more | independent, use 8 |

Turn on Figma corner smoothing at 60% for cards, sheets and buttons.

**Big number:** Inter 600, 32, tabular figures, letter spacing -1%.

**Amounts:** right-aligned, Inter tabular figures, `GHS 2,450.00`.

**Truncation:** names and references are one line with an ellipsis. Full text is on the detail screen. Test every row with a very long name and a very large amount.

**Gradient and noise (brand moments only):** the signature gradient `#0D5A40 → #0F4636 → #0A2A26` with 3% noise, on the Welcome hero and the Home total card. Text on it passes contrast. One soft emerald glow behind Welcome and Scan complete only. Gold is used for the wordmark's "Au", the thin line under the big total, the success check and hairlines. Focus is a soft Jade ring (3px, 35% opacity).

## 7. Navigation and thumb zone

- **Bottom navigation, 4 tabs:** Home, Groups, Transactions, Export. Docked. Active tab: filled icon, Jade label, 2px Jade line above. Icons all aligned, no oversized centre button.
- **App bar:** screen title left. Settings gear right on Home only. Other screens show a back arrow. Icon-only buttons have a long-press label.
- **Predictive back:** every screen supports the Android back gesture. Leaving a form with unsaved input restores it as a draft.
- **Thumb zone:** primary actions sit in the bottom third (sticky bottom bar on Review, Export and forms). The only top-right action is Settings.
- **Review queue** opens from the attention card on Home.

## 8. Screens

Each screen names its page pattern. Design every screen in **Dark first, then Light**.

**Wording by use type.** Mockups use the **Church** wording. **Organisation** says *period* where Church says *service* (for example *Weekly period*, *Sunday, 26 Oct 2026* stays a date). Built-in known pairs (Offertory into Offering, Tithes into Tithe) exist for Church only, so Merge history shows them for Church only. Layout, colours and flows are the same for both.

### A. First run and lock

**A1. Welcome** (Form, centered): gradient hero with 3% noise and soft emerald glow. No photo (church privacy, and stock photos feel fake).
- Wordmark: **AuCourant** in Instrument Serif, "Au" in Champagne Gold, tagline *Stay au courant with your MoMo.*
- **Hero illustration** (plain shapes only, no people): three grey message bubbles with text lines at the top, sliding down into three tidy group cards labelled *Offering*, *Tithe*, *Harvest*. It shows what the app does in one look.
- Title (Instrument Serif, 32): *Sort your MoMo money by reference*
- Body: *AuCourant reads MoMo messages on this phone and groups the money you receive.*
- Button: *Get started*. One action on the screen. No carousel.

**A1b. Who is AuCourant for?** (Form, centered)
- Title (Instrument Serif): *How will you use AuCourant?* Body: *This sets up the right defaults. You can change it later in Settings.*
- Single-select list on a bordered `bg-1` surface, three rows, each 48 or taller, radius 8, with a Phosphor 24 icon, a title and one grey line:
  - **Church** (church icon): *Sort offerings, tithes and special services.* Selected by default.
  - **Organisation** (buildings icon): *Sort payments by reference for your team or group.*
  - **Personal** (user icon): *Understand your own MoMo money.* Grey text *Coming soon*. Not selectable.
- Selected row: `bg-2` tint, Jade 1px border, Jade radio dot. No card inside a card.
- Sticky bottom button, never disabled, label follows the choice: *Set up for church* or *Set up for organisation*.
- Tapping *Personal* shows nothing selected and the helper *Personal use is coming. Choose Church or Organisation for now.*

**A1c. Message access** (Form, centered)
- Title (Instrument Serif): *Let AuCourant read your MoMo messages*. Body: *AuCourant reads MoMo messages on this phone and groups the money you receive.*
- **Trust row** above the button: lock icon (Phosphor, 16) and *Nothing leaves this phone. No account needed.* Plain text, no pill wrapper.
- **Permission helper:** *Android will ask to read messages. Choose Allow so AuCourant can sort them.*
- Button: *Allow message access*. Text link: *How your messages stay private*

**A2. Permission denied** (Form, centered)
- Title: *Message access is off*
- Body: *AuCourant needs to read MoMo messages to sort them. You can turn this on in phone settings.*
- Buttons: *Open phone settings*, *Try again*

**A3. Scanning inbox** (Form, centered, loading)
- Determinate progress bar (a transform reveal), text *Reading messages… 120 of 480*
- Helper: *This only happens once. Keep the app open.*

**A4. Scan complete** (Form, centered): gold check (static, 100ms fade), soft emerald glow.
- Title (Instrument Serif): *Your payments are sorted*
- Rows: *Payments received 312*, *Groups found 7*, *With no reference 18*, *Codes to name 2* (only when numbers were found as references)
- Plain text line under the rows: *Offering, Tithe, Harvest and 4 more*. Not chips.
- Tappable text link on the no-reference row: *See these*.
- Button: *Set up lock*. Text link under it: *Set up later*.

**A5. Set up lock** (Form, centered)
- Title *Lock AuCourant*. Body: *Choose how to unlock the app on this shared phone.*
- Label *Lock type*, radio: *4-digit PIN* (selected by default), *6-digit PIN*, *Password*.
- PIN choice: labels *Create PIN*, *Confirm PIN*, dots and number keypad.
- Password choice: labels *Create password*, *Confirm password*, text fields with a show or hide control, helper *Use at least 6 characters.*
- Helper for both: *You can't recover a forgotten PIN or password.*
- Button *Save lock* is **never disabled**. If the two entries differ, tapping it shows: *The two entries don't match. Enter them again.* A password under 6 characters shows: *Use at least 6 characters.*
- Text button *Set up later*.
- Then **A5b Save recovery code**, then *Use fingerprint*: *Unlock with your fingerprint. Your PIN or password still works.* Buttons *Turn on fingerprint*, *Not now*.
- The lock is never saved as a draft. The lock type can be changed later in Settings.

**A5b. Save recovery code** (Form, centered)
- Title *Save your recovery code*. Body: *If you forget your PIN or password, this code unlocks the app. Nothing is erased.*
- The code in a large block, three groups of four, Inter 500 at 20 with wide letter spacing, fake example `K7M2-9QXA-4TNR`.
- Helper: *Write it down and keep it safe, for example with a church leader. It is shown only once.*
- Buttons: *Copy code* (outline), *Finish setup* (filled, never disabled).
- Not shown when lock setup is skipped. Shown again for a new code when the lock is reset or the code is remade.

**A6. Lock screen** (Form, centered): shown when the app opens. Two variants.
- **PIN variant:** *Enter your PIN*, 4 or 6 dots, keypad.
- **Password variant:** *Enter your password*, a text field with a show or hide control, button *Unlock app*.
- Both: *Use fingerprint* when on.
- Wrong entry: *That PIN doesn't match. Try again.* or *That password doesn't match. Try again.*
- Too many tries: *Too many tries. Wait 30 seconds, then try again.*
- Link *Forgot PIN or password* opens A7 Reset lock.

**A7. Reset lock** (Form, centered)
- Title *Reset your lock*. Label *Recovery code*, placeholder `XXXX-XXXX-XXXX`. Button *Reset lock*, never disabled.
- Wrong code: *That code doesn't match. Check it and try again.* Too many tries: *Too many tries. Wait 30 seconds, then try again.*
- Success goes to A5 titled *Set a new lock*, then A5b with a **new** recovery code. The old code stops working. No data is erased.
- Text link *I lost my recovery code* opens the last-resort dialog: *Erase all AuCourant data from this phone? Payments come back from your messages after a new scan, but your group names, merges, reference codes and sessions are lost. Exported reports stay in your files.* Buttons *Erase data* (error red), *Cancel* (default focus).

### B. Home (Dashboard)
Priority order, top to bottom: 1 total, 2 needs attention, 3 top groups.
- Service selector at the top: *Sunday, 26 Oct 2026* (opens the service picker sheet).
- **Total card** (gradient with noise), thin gold line under the number: **GHS 4,310.00 received**, *38 payments*.
- **Needs attention** card on `bg-decision`: *4 need a decision*, lines *2 suggested merges*, *1 code to name*, *1 message not read*, button *Review now*. When nothing needs attention it becomes one quiet row: *Everything is sorted*.
- **Top groups** list on `bg-1`: Offering, Tithe, Harvest, Thanksgiving, Welfare, amounts right-aligned. Last row *View all groups*.
- No Export button here. The Export tab covers it.
- Coach marks (first use only, one at a time): service selector, then Review now, then Export tab. Dismiss with *Dismiss*.
- States: loading (skeleton), first-use empty, populated.

### C. Groups (List / Index)
- Search field labelled *Search groups*.
- List on `bg-1`: name left, count under the name, total right-aligned. Hairline dividers.
- Pinned row **No reference** with small text *System group*.
- Empty: *No groups yet*, *Groups appear when MoMo payments arrive.*, button *Scan messages again*.

### D. Group detail (Detail)
- Header: group name (**inline rename**, see below), total, payment count.
- When the group also counts other wordings, a line in secondary text under the name: *Also counted: Offertory, 1* (wordings and number codes that join this group), with a text link *Manage* that opens Merge history.
- Menu: *Merge into another group*. Not available for No reference.
- Payments as a timeline: date headers with day totals, rows with sender and amount.
- **Inline rename:** tap the pencil beside the name. The title turns into an input in the **same box**, nothing around it moves. Enter saves, Escape cancels. No sheet, no Save row.

### E. Transactions (List / Index)
- Search labelled *Search payments*.
- Filter chips: *This service*, *All groups*, *No reference*.
- **Timeline:** sticky date headers (*Sunday, 26 Oct 2026*, with day total right-aligned). Rows: sender (truncated), time and group in secondary text, amount right-aligned.
- After 50 rows: button *Show more payments*.
- Swipe a row to reveal *Change group*. The same action is always in the row's detail screen.
- First-use empty: *No payments yet*, *Received MoMo payments show up here.*, button *Scan messages again*.
- Filtered empty: *No payments match your filters*, *Try a wider period or clear filters.*, button *Clear all filters*.

### F. Transaction detail (Detail)
- Top: amount (Inter 600, 32), sender name, time.
- **Group** row, tappable as a whole: *Offering*, with a chevron. Opens the Change group sheet.
- Section *Payment*: *Reference* (or *No reference*, helper *The giver did not type a note.*; a number shows as *1, counted as Offering*), *Service*.
- Section *Sender*: name, phone number.
- Collapsed section *More details*: Transaction ID, Fee, Original message (raw SMS).
- Sections are separated by space, not lines.
- **Change group sheet:** list of groups plus a *Group name* field labelled *Create new group*, all inside the one sheet. Choosing a group closes the sheet and shows the Undo message *Moved to Offering. Undo*.

### G. Review queue (Inbox / queue)
Three tabs: **Merges (2)**, **Codes (1)** and **Not read (1)**.

**G1. Merge suggestions** (stacked cards, one at a time)
- Counter *1 of 2*. The card on `bg-decision`: *Thanksgiving* (12 payments, GHS 840.00) and *Thanks giving* (3 payments, GHS 120.00), text *Looks like the same group*.
- Sticky bottom bar: *Keep separate* (outline), *Confirm merge* (filled).
- Swipe right confirms, swipe left keeps separate. The buttons always stay.
- After *Confirm merge*, the change happens at once and the Undo message shows: *Merged Thanks giving into Thanksgiving. Undo*. No dialog (it can be undone).
- Empty: *No merges to review*, *Similar group names will be suggested here.*, button *Go to Home*.

**G2. Messages not read**
- List of raw messages the app could not understand. Rows shaded as inactive.
- Row actions: *Copy message*, *Skip message* (shows Undo message).
- Helper: *We couldn't read this message. Copy it and send it to support so we can add it.*

**G3. Name a code** (a number a giver typed as a reference, like 5)
- List of unnamed codes, each row: the number, payment count, total, and a text button *Name this code*. Until named, its payments sit in a group called *Code 5*, so every payment still has a group.
- *Name this code* opens a **bottom sheet** (one field plus a choice): label *Group name*, a short list of existing groups to pick from, or type a new name. Button *Save name*, never disabled.
- If the name matches an existing group (for example Offering), the code joins it. Otherwise a new group is made. It happens at once with the Undo message: *Named code 5 as Welfare. Undo*.
- Naming a code is **not** a manual fix, same as confirming a merge.
- Empty: *No codes to name*, *Numbers used as references will show up here once.*, button *Go to Home*.

### H. Export (Form)
- *Service* dropdown, pre-selected to the current service.
- *Format* radio *PDF*, *Excel (CSV)*, pre-selected to the last used.
- Switch *Hide member names and numbers*, off by default, remembered.
- Collapsed row *Customize fields* opens the checklist (Group, Date, Time, Amount, Reference, Transaction ID, Sender name, Sender number) with the last used set pre-checked.
- Summary line: *38 payments, GHS 4,310.00*.
- Sticky button *Export report*, **never disabled**. While working: inline spinner and *Exporting…*.
- Success: gold check **and** *Report is ready*. Buttons *Share file*, *Open file*.
- Error: *We couldn't create the report. Check that the phone has free storage and try again.* Button *Try again*.

### I. Services
- **Service picker** (bottom sheet): recent weekly services, special sessions (each with its payment count), *Choose dates*, *Create special session*. A special session on a Sunday sits beside that Sunday, and each shows only its own payments.
- **Create special session** (a full page, Form, because it has four fields): *Session name* (placeholder `Harvest thanksgiving`), *Date* (defaults to today, past dates allowed), *Start time*, *End time*. Helper under the times: *Payments inside this session count here, not in the weekly service.* Button *Save session*. Draft is kept if you leave.
- **Weekly service** (a full page, Form, in Settings): *Day of week* (Sunday selected), *Start time*, *End time*, button *Save weekly service*.

### J. Settings (Settings)
- Rows: *Used for* (opens a bottom sheet with the same three choices as A1b), *Weekly service*, *Appearance* (*Dark*, *Light*, *Match phone*), *App lock* (*Lock type*, *Change PIN or password*, *Use fingerprint* switch), *Recovery code* (button *Make a new recovery code*, opens A5b after the lock is checked), *Reference codes*, *Merge history*, *Scan messages again*, *Networks supported* (MTN), *About AuCourant*, *Delete all data*.
- *Delete all data* opens a dialog: *Delete all AuCourant data from this phone? Reports you exported stay in your files.* Buttons *Delete data* (error red), *Cancel* (default focus).

### J2. Merge history (List / Index)
- List on `bg-1`: *Thanks giving into Thanksgiving*, date, payment count, and a text button *Undo merge*. Built-in pairs appear too, for example *Offertory into Offering, built in*. Named codes appear as *Code 5 into Welfare*.
- After *Undo merge* the change happens at once with the Undo message: *Split Thanks giving from Thanksgiving. Undo*. No dialog (it can be undone).
- Empty: *No merges yet*, *Merged groups show up here so you can undo them.*, button *Go to Groups*.

### J3. Reference codes (List / Index, in Settings)
- Helper at the top: *Some givers type a number as the reference. Say what each number means for your church.*
- List on `bg-1`: number left, group name right, for example *1, Offering*, *2, Tithe*, *3, Harvest*. Hairline dividers.
- Tap a row opens a **bottom sheet**: *Code* (number, read-only) and *Group name*, button *Save name*. Changing the group moves every payment with that code, shown with an Undo message.
- Button *Add a code* (bottom sheet with two fields, *Code* and *Group name*, button *Save code*, never disabled). A code that is already listed shows: *This number already has a group. Edit it from the list.*
- Empty: *No codes yet*, *Add a number here, or name it when it first shows up.*, button *Add a code*.
- Codes mean the same thing in every service. They differ from one church to another, so the list starts empty.

## 9. Flows to prototype (design flows, not lone screens)

Each flow is one Figma section with a start frame and links wired.

| Flow | Path |
|---|---|
| F1 First run | A1, A1b, A1c, A2 (denied branch), A3, A4, A5 (choose lock type), A5b, fingerprint step, B |
| F2 Review merges | B, Review now, G1 stack, Confirm merge, Undo message, next card, Everything is sorted |
| F3 Fix one payment | E, tap row, F, Group row, Change group sheet, pick group, Undo message |
| F4 Export | Export tab, H (defaults), Customize fields, Export report, success, Share file |
| F5 Forgot lock | A6, wrong entry, Forgot PIN or password, A7, enter recovery code, A5 new lock, A5b new code, B. Branch: I lost my recovery code, erase dialog, A1 |
| F6 Name a code | B, Review now, Codes tab, Name this code, sheet, Save name, Undo message |

Use Smart Animate keyed to matching layer names. Link transitions use the tokens in section 10.

## 10. Motion

- Durations **100, 150, 200, 300ms only**. Enter ease-out `cubic-bezier(0.16, 1, 0.3, 1)`, exit ease-in `cubic-bezier(0.7, 0, 0.84, 0)`.
- Only **transform and opacity** animate. No bounce, spring or overshoot on product screens.
- Bottom sheet: slide up 200ms, exit 150ms. Undo message: 8px up plus fade, 200ms in, 150ms out, visible about 8 seconds.
- Merge stack: card slides sideways and fades 200ms. The next card comes up 8px, 200ms.
- Progress bar: a masked reveal on transform, no layout animation.
- Export success: the gold check is static with a 100ms fade, with the words beside it.
- **Reduced motion:** instant or opacity-only (100ms). No slides, no swipe motion. State is always also shown in text or an icon. Skeletons are static blocks.
- No looping decoration. Functional loops only (progress, exporting).

## 11. Loading and states

| Wait | What shows |
|---|---|
| Under 100ms | Nothing |
| 100ms to 1s | Inline spinner on the button, label becomes *Exporting…* |
| Over 1s | Skeleton that matches the layout (Home, lists), no full-page spinner |
| Inbox scan | Determinate progress with a count |

| State | Required on |
|---|---|
| Loading | Home, Groups, Transactions, scan, export |
| First-use empty | Home, Groups, Transactions, Review |
| Filtered empty | Transactions, Groups search |
| Error | Scan, export, lock, message not read |
| Populated | All |

Empty and loading states keep the same frame (list surface, header, search) as the populated screen. No layout jump.

## 12. Components to build in Figma

App bar, bottom navigation, total card (gradient), attention card (decision), group row, payment row with date header, search field, filter chip, checkbox row, radio, switch, text field with visible label, PIN dots and keypad, password field, recovery code block, primary, secondary (outline), text and destructive buttons, bottom sheet, confirmation dialog, merge stack card, Undo message (snackbar), coach mark, progress bar, skeleton row, inline error, empty state block, expandable section.

Each component needs: default, pressed, focused, error where it applies, in **Dark and Light**. Submit buttons have no disabled state.

## 13. Sample data (fake, use in mockups)

Groups: Offering GHS 2,450.00 (22), Tithe GHS 980.00 (9), Harvest GHS 420.00 (4), Thanksgiving GHS 840.00 (12), Welfare GHS 200.00 (3), No reference GHS 120.00 (3).
Senders: Akosua Mensah, Kofi Boateng, Ama Owusu, Yaw Darko, Efua Quaye. Include one very long name and one GHS 12,500.00 amount to test truncation and alignment.
Never use a real person's name or number.

## 14. Out of scope for this design

Personal budgeting, spending categories, charts, fee warnings, accounts and login, cloud sync, tablet layouts, iPhone, website.

## 15. Process and handoff

1. **Reference set:** collect 3 screenshots from real shipped finance or utility apps, not Dribbble shots. Note what to take from each (layout only).
2. **Frankenstein wireframe:** combine layouts from the references in grey boxes. Discard their styling.
3. **Two Home variants.** Pick one before touching other screens. Early drafts are allowed to be bad.
4. **Apply the identity:** tokens first, then components, then screens.
5. **States, then flows, then both themes.**
6. **Preview at real size:** open on a phone with Figma Mirror at 360 wide.
7. **Show the treasurer a clickable prototype**, not a stylised collage.

Handoff:
- Frame size **360 by 800**. Name frames like `A1 Welcome`, `B Home`, `G1 Merge suggestions`. Light frames end with ` Light`.
- Figma variables with **Dark and Light modes** for every token. No loose hex values. Auto layout everywhere. Nudge amount 8.
- Text styles only Instrument Serif (400) and Inter (400, 500, 600).
- Mark each screen's pattern name in the frame description.
- Share the Figma link or exported frames. The build then starts with the parser and database.

## 16. Decided and open

**Decided**
- The user chooses the lock: 4-digit PIN, 6-digit PIN or password (4-digit PIN selected by default). Setup can be done later.
- A **recovery code** resets a forgotten lock without erasing data. Erase is only the last resort.
- Special sessions can be created at any time. A special session wins for payments inside its window.
- Undo: a message for about 8 seconds, plus Merge history in Settings for merges.
- "offering" and "Offering" are one group. "Offertory" counts as "Offering", "Tithes" counts as "Tithe", shown as *Also counted: Offertory*.
- No database encryption.
- **Purple removed.** Identity is now Midnight Emerald Gold. Decision surfaces are Deep Umber (dark) and Soft Champagne (light).
- **Fonts:** Instrument Serif for the wordmark, onboarding titles and screen titles. Inter for everything else.
- **Welcome screen:** drawn illustration instead of a photo. Welcome has one button, *Get started*. The trust row and permission helper moved to the new message access screen A1c.
- **Use type:** first run asks *Church* or *Organisation* (A1b). *Personal* is shown as coming soon. Changeable later in Settings under *Used for*.
- **Number references:** a per-church code list (code to group name). Codes mean the same every week. Naming a code is not a manual fix.

**Open**
- Logo and app icon (wordmark **AuCourant** in Instrument Serif, "Au" in gold, on midnight and emerald).
- How long a number can be before it stops counting as a code (see architecture).
- What *Personal* should do when it is built.
- Whether leadership reports need a fixed layout.
