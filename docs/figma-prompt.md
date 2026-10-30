# AuCourant: Paste-ready Figma prompt (v3)

Copy everything below the line into Figma (Make or AI design). Attach `figma-brief.md` and 2 or 3 clean screenshots of real shipped apps (not Dribbble shots) for layout reference only.

---

**Task: design a mobile app UI in Figma** (editable frames, Android, 360 by 800). The app is **AuCourant**. Tagline: "Stay au courant with your MoMo." Design every screen in **Dark (default) and Light** with Figma variables in two modes.

**Purpose:** A church treasurer uses it on one shared phone. It reads mobile money (MoMo) payment messages, groups received money by reference (Offering, Tithe, Harvest, Thanksgiving, Welfare), puts payments with no typed reference in a "No reference" group, suggests merging similar groups (like "Thanksgiving" and "Thanks giving") for the treasurer to confirm, and exports a PDF or Excel (CSV) report for a service. A service is a day of the week (usually Sunday) plus special sessions. A PIN with optional fingerprint locks the app. Everything stays on the phone. Goal: a sorted report in about 3 minutes.

**Identity: Midnight Emerald Royal.** Quiet luxury through restraint. Calm, plain, trustworthy. Church money, so no hype.

**Icons:** Phosphor Regular only (24 navigation, 20 inline, 16 meta). **No emoji anywhere.** Icons are neutral grey. Colour only for status and the active tab.

**Fonts:** Manrope for titles, section titles and big numbers. Inter for everything else, tabular figures for amounts. Weights 400, 500, 600 only. Sizes 12 (meta only), 14, 16, 20, 24, 32. Big number 32 with -1% letter spacing.

**Dark colour layers (4 backgrounds, 2 strokes, 3 text):**
bg-0 `#080D0C`, bg-1 `#0E1A16`, bg-2 `#13241E`, bg-3 `#1A2F27` (sheets, dialogs, menus, the lightest layer), decision surface `#201629`. Strokes: ivory at 10% and 18%. Text `#E8EEE9`, secondary `#A3B1AA`, tertiary `#8A988F`.
**Light:** canvas `#F3F6F2`, cards `#FFFFFF`, inset `#EAF0EC`, decision surface `#E5D9EB`, text `#1D2321`, secondary `#46534C`, tertiary `#5F6C66`, selected `#DDEBE5`.
**Accent:** button fill Emerald `#0D5A40`, pressed `#0A4733`, label ivory (dark) or white (light). Links, active tab, active icon and focus ring in **Jade `#35A879`** on dark and Emerald on light. **Never use Emerald `#0D5A40` as text, icon or focus on dark backgrounds** (contrast 2.4).
**Brand extras:** Royal Aubergine `#35204A`, Champagne Gold `#C8AA72`, Black Plum `#201629`, Soft Orchid `#E5D9EB`. Purple only on decision surfaces. Gold only for a thin line under the big total, the success check and hairlines.
**Status (off-brand on purpose):** error `#FF9A92` on `#2A1513` (dark), `#B3261E` on `#FCEDEB` (light). Warning `#E8B54A` on `#2B2108`, `#8A5A00` on `#FFF4DB`. Destructive buttons `#B3261E`. Success is a gold check plus the words.
**Dark mode is its own palette, not an inversion.** No shadows in dark: use lighter layers and a 1px top highlight.

**Hard rules**
- No gradients on buttons. Primary button is solid emerald. Secondary is an outline. Never two filled buttons side by side.
- The signature gradient `#0D5A40 → #173D34 → #35204A` with 3% noise appears **only** on the Welcome hero and the Home total card. No mesh gradients, glass, blur, or decorative glow. Focus is a soft Jade ring.
- No cartoon people or mascots. Empty states use one simple Phosphor glyph.
- No pill wrappers around plain text. Chips only for tappable filters: 1px outline, 32 tall with a 48 tap area, padding 8 by 16, radius 8, selected = tint with Jade text, never solid emerald.
- 8pt grid (4pt for small gaps), nudge amount 8, side padding 16, touch targets 48. Radius 8 for cards, lists, inputs, buttons. Radius 12 for sheets and dialogs. Nested rule: inner radius = outer radius minus the gap. Corner smoothing 60%.
- Every element touches at least two edges of its container (names left, amounts right). No card inside a card.
- Lists sit on a bordered surface. Long lists keep hairline dividers. Inside cards and detail screens, separate groups with space, not lines.
- Submit buttons are **never disabled**. Errors appear after first blur and clear on focus. Labels always visible, placeholders only show format.
- Buttons start with a verb in sentence case. Never use OK, Submit, Proceed, Continue.
- Errors never blame, two sentences max, say how to recover. Every empty state: headline, one sentence of value, one action button.
- Edit one field in place (rename), 2 to 3 short fields in a bottom sheet, 3+ fields or several steps on a full page. Never a modal on a modal. Destructive actions open a dialog that names the item, uses a red destructive verb, and focuses Cancel. Reversible actions (merge, move payment) happen at once and show an **Undo message** at the bottom.
- Primary actions sit in the bottom third. Icon-only buttons have long-press labels.

**Navigation:** docked bottom bar with 4 tabs (Home, Groups, Transactions, Export). Active tab: filled icon, Jade label, 2px Jade line above. Settings gear in the Home app bar only.

**Screens**
1. **First run and lock:** Welcome (gradient hero, "Sort your MoMo money by reference", button "Allow message access"), Permission denied, Scanning inbox with determinate progress ("Reading messages… 120 of 480"), Scan complete (payments, groups, with no reference) with "Set up PIN", Set PIN (Create PIN, Confirm PIN, keypad, "Save PIN" never disabled, "Set up later", then a fingerprint step), Lock screen (PIN dots, keypad, "Use fingerprint", wrong PIN, too many tries, "Forgot PIN" dialog that explains data will be erased).
2. **Home:** priority order total, needs attention, top groups. Service selector "Sunday, 26 Oct 2026". Gradient total card "GHS 4,310.00 received, 38 payments" with a thin gold line. Decision card "3 need a decision" (2 suggested merges, 1 message not read) with "Review now"; when empty it becomes the row "Everything is sorted". Top groups list. No Export button here (the Export tab covers it).
3. **Groups:** search "Search groups", rows with name, count under the name, total right-aligned, pinned "No reference" system group.
4. **Group detail:** inline rename (title turns into an input in the same box, no layout shift), total, payment timeline with date headers and day totals, menu "Merge into another group".
5. **Transactions:** search "Search payments", filter chips (This service, All groups, No reference), a timeline with sticky date headers and day totals, rows with truncated sender, time and group in grey, amount right-aligned, swipe to reveal "Change group", button "Show more payments" after 50 rows.
6. **Transaction detail:** amount and sender on top, a tappable Group row, section Payment (Reference or "No reference, the giver did not type a note", Service), section Sender, collapsed "More details" (Transaction ID, Fee, Original message). Sections separated by space. "Change group" sheet with a "Create new group" field inside the same sheet.
7. **Review queue:** tabs Merges and Not read. Merges is a stack, one card at a time, counter "1 of 2", decision-surface card with the two groups, counts and totals, sticky bottom bar "Keep separate" (outline) and "Confirm merge" (filled). Swipe right confirms, left keeps separate, buttons stay visible. Undo message "Merged Thanks giving into Thanksgiving. Undo". Not read list with shaded rows, "Copy message" and "Skip message".
8. **Export (form):** Service dropdown pre-selected, Format radio (PDF, Excel CSV) pre-selected to last used, switch "Hide member names and numbers" off by default, collapsed "Customize fields" (Group, Date, Time, Amount, Reference, Transaction ID, Sender name, Sender number), summary line, sticky "Export report" never disabled with an inline spinner "Exporting…". Success with gold check and "Report is ready", "Share file", "Open file". Error state.
9. **Services:** service picker bottom sheet (recent Sundays, special sessions, "Choose dates", "Create special session"). Full pages for "Create special session" (Session name, Date, Start time, End time, "Save session") and "Weekly service" (Day of week, Start time, End time, "Save weekly service").
10. **Settings:** Weekly service, Appearance (Dark, Light, Match phone), App lock (Change PIN, Use fingerprint), Merge history, Scan messages again, Networks supported, About AuCourant, Delete all data (named confirmation dialog).

**Flows:** wire five prototype flows as separate sections with Smart Animate: First run, Review merges, Fix one payment, Export, Forgot PIN.

**Motion:** durations 100, 150, 200, 300ms only. Ease-out on enter, ease-in on exit. Only transform and opacity. No bounce or spring. Reduced-motion variant: instant or opacity only. State is always also in text or an icon.

**States:** for each screen design loading (skeleton matching the layout, no full-page spinner), first-use empty, filtered empty where there is search, error, and populated, in Dark and Light. Empty and loading keep the same frame as populated. First use shows three coach marks, one at a time.

**Sample data (fake):** Offering GHS 2,450.00 (22 payments), Tithe GHS 980.00 (9), Harvest GHS 420.00 (4), Thanksgiving GHS 840.00 (12), Welfare GHS 200.00 (3), No reference GHS 120.00 (3). Senders: Akosua Mensah, Kofi Boateng, Ama Owusu, Yaw Darko, Efua Quaye, plus one very long name and one GHS 12,500.00 amount to test truncation. Currency "GHS 2,450.00". Date "28 Oct 2026".

**Build components** (default, pressed, focused, error, in Dark and Light): buttons, text field, search, chips, checkbox, radio, switch, PIN dots and keypad, rows, cards, bottom sheet, dialog, Undo message, coach mark, progress bar, skeleton rows. Auto layout everywhere. Variables for colour, spacing and type. Name frames `A1 Welcome`, `B Home`, and add ` Light` for light frames.

**Do not design:** budgeting, charts, login or accounts, cloud sync, tablet, iPhone, or a website.
