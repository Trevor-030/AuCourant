# AuCourant: Paste-ready Figma prompt (v6)

Copy everything below the line into Figma (Make or AI design). Attach `figma-brief.md` and 2 or 3 clean screenshots of real shipped apps (not Dribbble shots) for layout reference only.

This version changes from v5: **purple removed**, **Instrument Serif added**, **Welcome and Scan complete reworked**, **number references added** (Codes tab, Name a code sheet, Reference codes in Settings).

---

**Task: update the existing AuCourant design in Figma** (editable frames, Android, 360 by 800). If starting fresh, design every screen below. Keep Dark (default) and Light with Figma variables in two modes. The app is **AuCourant**. Tagline: "Stay au courant with your MoMo."

**What changes in an existing file (do these first):**
1. **Remove all purple.** Delete Royal Aubergine `#35204A`, Imperial Purple, Velvet Violet, Black Plum `#201629` and Soft Orchid `#E5D9EB` from the variables. Nothing in the file may be purple, violet or plum.
2. Swap fonts: **Instrument Serif** (400 only) for the wordmark, onboarding titles and screen titles. **Inter** for everything else. Section titles and the 32 big number become Inter 600. Remove Manrope.
3. Redraw **Welcome** and **Scan complete** (below).
4. Add the **number reference** screens (below).
5. Update the decision surfaces and the gradient to the new colours.

**Purpose:** A church treasurer uses it on one shared phone. It reads mobile money (MoMo) payment messages, groups received money by reference (Offering, Tithe, Harvest, Thanksgiving, Welfare), puts payments with no typed reference in a "No reference" group, suggests merging similar groups (like "Thanksgiving" and "Thanks giving") for the treasurer to confirm, and exports a PDF or Excel (CSV) report for a service. Some givers type a **number** as the reference (1, 2, 3). Each church decides what its numbers mean, and the treasurer names each number once. A service is a day of the week (usually Sunday) plus special sessions. The user chooses a 4-digit PIN, 6-digit PIN or password to lock the app, with optional fingerprint. Everything stays on the phone. Goal: a sorted report in about 3 minutes.

**Identity: Midnight Emerald Gold.** Quiet luxury through restraint. Calm, plain, trustworthy. Church money, so no hype. **No purple.**

**Icons:** Phosphor Regular only (24 navigation, 20 inline, 16 meta). **No emoji anywhere.** Icons are neutral grey. Colour only for status and the active tab.

**Fonts:** Instrument Serif 400 for the AuCourant wordmark, onboarding titles (Welcome, Scan complete) and screen titles. Inter for everything else, with tabular figures for amounts. Inter weights 400, 500, 600. Sizes 12 (meta only), 14, 16, 20, 24, 32. Big number is Inter 600, 32, -1% letter spacing. Never fake bold on Instrument Serif.

**Dark colour layers (4 backgrounds, 2 strokes, 3 text):**
bg-0 `#080D0C`, bg-1 `#0E1A16`, bg-2 `#13241E`, bg-3 `#1A2F27` (sheets, dialogs, menus, the lightest layer), **decision surface Deep Umber `#1C1910`**. Strokes: ivory at 10% and 18%. Text `#E8EEE9`, secondary `#A3B1AA`, tertiary `#8A988F`.
**Light:** canvas `#F3F6F2`, cards `#FFFFFF`, inset `#EAF0EC`, **decision surface Soft Champagne `#F3ECDB`**, text `#1D2321`, secondary `#46534C`, tertiary `#5F6C66`, selected `#DDEBE5`.
**Accent:** button fill Emerald `#0D5A40`, pressed `#0A4733`, label ivory (dark) or white (light). Links, active tab, active icon and focus ring in **Jade `#35A879`** on dark and Emerald on light. **Never use Emerald `#0D5A40` as text, icon or focus on dark backgrounds** (contrast 2.4).
**Brand extras:** Forest Mid `#0F4636` and Deep Teal `#0A2A26` (gradient only), Champagne Gold `#C8AA72`. Gold only for the "Au" in the wordmark, a thin line under the big total, the success check and hairlines.
**Status (off-brand on purpose):** error `#FF9A92` on `#2A1513` (dark), `#B3261E` on `#FCEDEB` (light). Warning `#E8B54A` on `#2B2108`, `#8A5A00` on `#FFF4DB`. Destructive buttons `#B3261E`. Success is a gold check plus the words.
**Dark mode is its own palette, not an inversion.** No shadows in dark: use lighter layers and a 1px top highlight.

**Hard rules**
- No gradients on buttons. Primary button is solid emerald. Secondary is an outline. Never two filled buttons side by side.
- The signature gradient `#0D5A40 → #0F4636 → #0A2A26` with 3% noise appears **only** on the Welcome hero and the Home total card. No mesh gradients, glass, blur, or decorative glow. The only glow is one soft emerald glow behind Welcome and Scan complete. Focus is a soft Jade ring.
- No cartoon people or mascots. No stock photos. Empty states use one simple Phosphor glyph.
- No pill wrappers around plain text. Chips only for tappable filters: 1px outline, 32 tall with a 48 tap area, padding 8 by 16, radius 8, selected = tint with Jade text, never solid emerald.
- 8pt grid (4pt for small gaps), nudge amount 8, side padding 16, touch targets 48. Radius 8 for cards, lists, inputs, buttons. Radius 12 for sheets and dialogs. Nested rule: inner radius = outer radius minus the gap. Corner smoothing 60%.
- Every element touches at least two edges of its container (names left, amounts right). No card inside a card.
- Lists sit on a bordered surface. Long lists keep hairline dividers. Inside cards and detail screens, separate groups with space, not lines.
- Submit buttons are **never disabled**. Errors appear after first blur and clear on focus. Labels always visible, placeholders only show format.
- Buttons start with a verb in sentence case. Never use OK, Submit, Proceed, Continue.
- Errors never blame, two sentences max, say how to recover. Every empty state: headline, one sentence of value, one action button.
- Edit one field in place (rename), 2 to 3 short fields in a bottom sheet, 3+ fields or several steps on a full page. Never a modal on a modal. Destructive actions open a dialog that names the item, uses a red destructive verb, and focuses Cancel. Reversible actions (merge, move payment, name a code) happen at once and show an **Undo message** at the bottom.
- Primary actions sit in the bottom third. Icon-only buttons have long-press labels.

**Navigation:** docked bottom bar with 4 tabs (Home, Groups, Transactions, Export). Active tab: filled icon, Jade label, 2px Jade line above. Settings gear in the Home app bar only.

**Screens**
1. **First run and lock:**
   - **Welcome (redesigned).** Gradient hero with noise and soft emerald glow. Wordmark **AuCourant** in Instrument Serif, "Au" in Champagne Gold, tagline under it. **Hero illustration, plain shapes only, no people:** three grey message bubbles with text lines at the top, sliding down into three tidy group cards labelled Offering, Tithe, Harvest. Title in Instrument Serif 32: "Sort your MoMo money by reference". Body: "AuCourant reads MoMo messages on this phone and groups the money you receive." Above the button, a plain row (no pill) with a lock icon and "Nothing leaves this phone. No account needed.", then a helper line: "Android will ask to read messages. Choose Allow so AuCourant can sort them." Button "Allow message access". Text link "How your messages stay private". One action only.
   - Permission denied.
   - Scanning inbox with determinate progress ("Reading messages… 120 of 480").
   - **Scan complete (redesigned).** Gold check (static, 100ms fade), soft emerald glow. Title in Instrument Serif "Your payments are sorted". Rows: Payments received 312, Groups found 7, With no reference 18, Codes to name 2. A plain text line "Offering, Tithe, Harvest and 4 more" (not chips). Tappable text link "See these" on the no-reference row. Button "Set up lock", text link "Set up later".
   - Set up lock (radio "4-digit PIN" selected by default, "6-digit PIN", "Password"; PIN dots and keypad or password fields with show or hide; "Save lock" never disabled; "Set up later"), Save recovery code (large code block like K7M2-9QXA-4TNR, "Write it down and keep it safe, for example with a church leader. It is shown only once.", buttons "Copy code" and "Finish setup"), then a fingerprint step, Lock screen in two variants (PIN dots and keypad, or a password field with "Unlock app"; "Use fingerprint"; wrong entry; too many tries; link "Forgot PIN or password"), Reset lock (field "Recovery code", button "Reset lock", wrong code error, link "I lost my recovery code" that opens a dialog explaining that data will be erased as a last resort, including group names, merges, reference codes and sessions).
2. **Home:** priority order total, needs attention, top groups. Service selector "Sunday, 26 Oct 2026". Gradient total card "GHS 4,310.00 received, 38 payments" with a thin gold line. Decision card on the Deep Umber or Soft Champagne surface: "4 need a decision" (2 suggested merges, 1 code to name, 1 message not read) with "Review now"; when empty it becomes the row "Everything is sorted". Top groups list. No Export button here (the Export tab covers it).
3. **Groups:** search "Search groups", rows with name, count under the name, total right-aligned, pinned "No reference" system group.
4. **Group detail:** inline rename (title turns into an input in the same box, no layout shift), a grey line "Also counted: Offertory, 1" with a text link "Manage" when other wordings or number codes are included, total, payment timeline with date headers and day totals, menu "Merge into another group".
5. **Transactions:** search "Search payments", filter chips (This service, All groups, No reference), a timeline with sticky date headers and day totals, rows with truncated sender, time and group in grey, amount right-aligned, swipe to reveal "Change group", button "Show more payments" after 50 rows.
6. **Transaction detail:** amount (Inter 600, 32) and sender on top, a tappable Group row, section Payment (Reference, shown as "1, counted as Offering" for a number, or "No reference, the giver did not type a note"; Service), section Sender, collapsed "More details" (Transaction ID, Fee, Original message). Sections separated by space. "Change group" sheet with a "Create new group" field inside the same sheet.
7. **Review queue:** **three tabs: Merges (2), Codes (1), Not read (1).**
   - Merges is a stack, one card at a time, counter "1 of 2", decision-surface card with the two groups, counts and totals, sticky bottom bar "Keep separate" (outline) and "Confirm merge" (filled). Swipe right confirms, left keeps separate, buttons stay visible. Undo message "Merged Thanks giving into Thanksgiving. Undo".
   - **Codes (new):** list of unnamed codes, each row with the number, payment count, total and a text button "Name this code". Until named, its payments sit in a group called "Code 5". "Name this code" opens a **bottom sheet**: field "Group name", a short list of existing groups to pick from, button "Save name" (never disabled). If the name matches an existing group, the code joins it. Undo message "Named code 5 as Welfare. Undo". Empty: "No codes to name", "Numbers used as references will show up here once.", button "Go to Home".
   - Not read list with shaded rows, "Copy message" and "Skip message".
8. **Export (form):** Service dropdown pre-selected, Format radio (PDF, Excel CSV) pre-selected to last used, switch "Hide member names and numbers" off by default, collapsed "Customize fields" (Group, Date, Time, Amount, Reference, Transaction ID, Sender name, Sender number), summary line, sticky "Export report" never disabled with an inline spinner "Exporting…". Success with gold check and "Report is ready", "Share file", "Open file". Error state.
9. **Services:** service picker bottom sheet (recent Sundays, special sessions with payment counts, "Choose dates", "Create special session"). Full pages for "Create special session" (Session name, Date defaulting to today, Start time, End time, helper "Payments inside this session count here, not in the weekly service", "Save session") and "Weekly service" (Day of week, Start time, End time, "Save weekly service").
10. **Settings:** Weekly service, Appearance (Dark, Light, Match phone), App lock (Lock type, Change PIN or password, Use fingerprint), Recovery code ("Make a new recovery code"), **Reference codes (new)**, Merge history (a list of merges, each with "Undo merge"; built-in pairs like Offertory into Offering and Tithes into Tithe included; named codes shown as "Code 5 into Welfare"), Scan messages again, Networks supported (MTN), About AuCourant, Delete all data (named confirmation dialog).
11. **Reference codes (new, in Settings):** helper "Some givers type a number as the reference. Say what each number means for your church." List on a bordered surface: number left, group name right ("1, Offering", "2, Tithe", "3, Harvest"), hairline dividers. Tap a row opens a bottom sheet with "Code" (read-only) and "Group name", button "Save name"; changing the group moves every payment with that code, with an Undo message. Button "Add a code" opens a bottom sheet with "Code" and "Group name", button "Save code" (never disabled). Duplicate error: "This number already has a group. Edit it from the list." Empty: "No codes yet", "Add a number here, or name it when it first shows up.", button "Add a code".

**Flows:** wire six prototype flows as separate sections with Smart Animate: First run, Review merges, Fix one payment, Export, Forgot lock, **Name a code** (Home, Review now, Codes tab, Name this code, sheet, Save name, Undo message).

**Motion:** durations 100, 150, 200, 300ms only. Ease-out on enter, ease-in on exit. Only transform and opacity. No bounce or spring. Reduced-motion variant: instant or opacity only. State is always also in text or an icon.

**States:** for each screen design loading (skeleton matching the layout, no full-page spinner), first-use empty, filtered empty where there is search, error, and populated, in Dark and Light. Empty and loading keep the same frame as populated. First use shows three coach marks, one at a time.

**Sample data (fake):** Offering GHS 2,450.00 (22 payments), Tithe GHS 980.00 (9), Harvest GHS 420.00 (4), Thanksgiving GHS 840.00 (12), Welfare GHS 200.00 (3), No reference GHS 120.00 (3). Codes: 1 Offering, 2 Tithe, 3 Harvest, and an unnamed code 5 with 2 payments. Senders: Akosua Mensah, Kofi Boateng, Ama Owusu, Yaw Darko, Efua Quaye, plus one very long name and one GHS 12,500.00 amount to test truncation. Currency "GHS 2,450.00". Date "28 Oct 2026".

**Build components** (default, pressed, focused, error, in Dark and Light): buttons, text field, search, chips, checkbox, radio, switch, PIN dots and keypad, password field, rows, cards, bottom sheet, dialog, Undo message, coach mark, progress bar, skeleton rows, tabs. Auto layout everywhere. Variables for colour, spacing and type. Name frames `A1 Welcome`, `B Home`, `G3 Name a code`, `J3 Reference codes`, and add ` Light` for light frames.

**Do not design:** budgeting, charts, login or accounts, cloud sync, tablet, or a website. **No purple anywhere. No photos.**
