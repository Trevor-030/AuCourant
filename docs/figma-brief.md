# AuCourant: Figma Design Brief

> Source of truth for the frontend design. Built from `aucourant.prd.md` and `architecture.md`.
> Platform: **Android phone, one shared phone per church, light theme only for MVP.**
> Rules applied: anti-slop, typography, spacing, colour-palette, empty-states, errors, verbs, labels, page-patterns.

---

## 1. Design goal

A treasurer opens the app after a service and, in about **3 minutes**, sees every payment sorted by reference and exports a report. The design must make three things obvious at a glance:

1. How much came in, and for what (groups).
2. What needs a decision (suggested merges, no-reference money, messages the app could not read).
3. How to export.

Tone: **calm, plain, trustworthy**. This is church money. No hype, no decoration.

## 2. Design rules (hard)

**Anti-slop**
- No gradients on buttons. Primary buttons are one solid accent colour.
- No glass or blur. No cartoon people or mascots in empty states.
- No icons inside text inputs unless they do a job (search, clear).
- No pill wrappers around plain text like dates or amounts. Chips only for tappable filters.
- Keep list frames, dividers and search. Removing decoration must never leave a bare list.

**Typography**
- One typeface: **Inter** (free). Weights **400, 500, 600 only**.
- Sizes: **12 meta, 14 secondary, 16 body, 20 section title, 24 screen title, 32 big number**.
- List rows and table cells are 14 or 16, never 12. 12 is only for timestamps and helper text.
- Line height: titles 1.2, body 1.5.

**Spacing**
- 8pt grid for components, 4pt for small gaps. Tokens: 4, 8, 12, 16, 24, 32, 48.
- Screen side padding 16. Gap between sections 24 or 32. Gap inside a group 8.
- Touch targets at least **48 by 48**.

**Colour (60-30-10)**
- 60% canvas, 30% surfaces (cards, lists), 10% accent.
- Every list sits in a visible surface with a **1px border and hairline row dividers**.
- Soft shadow only, alpha under 0.08, or none. Border first.
- Status is never colour alone. Always add text or an icon.

**Copy**
- Buttons start with a verb, sentence case: *Export report, Confirm merge, Keep separate, Assign group*.
- Banned: OK, Submit, Proceed, Continue.
- Every input has a visible label. Placeholders show format only.
- Errors never blame, are two sentences or fewer, and give a way to recover.
- Every empty state has: headline, one sentence of value, one action button.

## 3. Tokens

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F6F6F3` | Screen background (60%) |
| `surface` | `#FFFFFF` | Cards, lists, sheets (30%) |
| `border` | `#1A1A1A` at 10% | 1px borders and dividers |
| `text` | `#1A1A1A` | Primary text |
| `text-secondary` | `#5B5B57` | Supporting text (passes 4.5:1 on canvas) |
| `accent` | `#0F6B55` | Buttons, active tab, links, focus (10%) |
| `accent-soft` | `#E4F1ED` | Selected row or active filter only |
| `warning` | `#8A5A00` on `#FFF4DB` | Needs attention banner |
| `error` | `#B3261E` on `#FCEDEB` | Error banner and field errors |
| Radius | 8 for controls and cards, 12 for bottom sheets | |
| Shadow | `0 1 3` at 6% | Bottom sheets and app bar only |

Currency format: **GHS 2,450.00**. Date format: **28 Oct 2026**. Time: **6:56 pm**.

## 4. Navigation

- **Bottom navigation, 4 tabs:** Home, Groups, Transactions, Export.
- **App bar:** screen title on the left, Settings gear on the right (Home only). Other screens show a back arrow.
- **Review queue** (merges, no reference, unread messages) opens from the attention card on Home.
- Surfaces: quick choices use a **bottom sheet**. Destructive actions use a **confirmation dialog that names the thing** being removed.

## 5. Screens

Each screen names its page pattern, as the page-patterns rule requires.

### A. First run

**A1. Welcome** (Form, centered)
- Title: *Sort your MoMo money by reference*
- Body: *AuCourant reads MoMo messages on this phone and groups the money you receive. Nothing leaves the phone.*
- Button: *Allow message access*
- Text link: *How your messages stay private*

**A2. Permission denied** (Form, centered)
- Title: *Message access is off*
- Body: *AuCourant needs to read MoMo messages to sort them. You can turn this on in phone settings.*
- Buttons: *Open phone settings*, *Try again*

**A3. Scanning inbox** (Form, centered, loading)
- Progress bar with text *Reading messages… 120 of 480*
- Helper: *This only happens once. Keep the app open.*

**A4. Scan complete** (Form, centered)
- Summary rows: *Payments received 312*, *Groups found 7*, *Need your decision 5*
- Button: *Review results*

### B. Home (Dashboard)
- Period selector at top: *Sunday service, 26 Oct 2026* (tap opens bottom sheet).
- Big number card: **GHS 4,310.00 received**, with *38 payments*.
- **Top groups** list in a bordered surface: Offering, Tithe, Harvest, Thanksgiving, Welfare, each with amount. Last row *View all groups*.
- **Needs attention** card (warning style): *5 need a decision* with three lines: *2 suggested merges*, *3 with no reference*, *1 message not read*. Button: *Review now*.
- Button at bottom of content: *Export report*.
- States: loading (skeleton rows), first-use empty (no messages found), populated.

### C. Groups (List / Index)
- Search field with visible label *Search groups*.
- Table in bordered surface: group name, payment count, total. Hairline dividers.
- Pinned row: **No reference** system group, visually standard but with a small label *System group*.
- Tap row opens Group detail.
- Empty: *No groups yet*, *Groups appear when MoMo payments arrive with a reference.*, button *Scan messages again*.

### D. Group detail (Detail)
- Title with group name, total, payment count.
- Actions in app bar menu: *Rename group*, *Merge into another group*.
- List of payments: sender name, date, amount. Reference text shown as plain secondary text.
- Tap a payment opens Transaction detail.

### E. Transactions (List / Index)
- Search with visible label *Search payments*.
- Filter chips (tappable): *This service*, *All groups*, *No reference*.
- Rows: sender, date and time, reference, amount.
- Empty first-use: *No payments yet*, *Received MoMo payments show up here.*, button *Scan messages again*.
- Filtered empty: *No payments match your filters*, *Try a wider period or clear filters.*, buttons *Clear all filters*.

### F. Transaction detail (Detail)
- Fields: Amount, From (name and number), Received, Reference, Group, Transaction ID, Fee.
- Row *Original message* expands to show raw SMS text.
- Button: *Change group* (opens bottom sheet).

### G. Review queue (Inbox / queue)
Three sections with counts, tabs at top: **Merges (2)**, **No reference (3)**, **Not read (1)**.

**G1. Merge suggestions**
- Card per pair: *Thanksgiving* (12 payments, GHS 840.00) and *Thanks giving* (3 payments, GHS 120.00), text *Looks the same*.
- Buttons: *Confirm merge*, *Keep separate*.
- Confirm merge opens a dialog: *Merge Thanks giving into Thanksgiving? All 3 payments move. You can undo this from Groups.* Buttons *Merge groups*, *Cancel*.

**G2. No reference**
- List of payments with checkboxes. Bottom action bar appears when selected: *Assign group*.
- Assign group bottom sheet: list of groups, plus *Create new group* field with visible label *Group name*.
- Empty: *Nothing to sort*, *Every payment has a reference or a group.*, button *Go to Home*.

**G3. Messages not read**
- List of raw messages the parser could not understand.
- Row actions: *Copy message* (for support), *Skip message*.
- Error-style helper: *We couldn't read this message. Copy it and send it to support so we can add it.*

### H. Export (Form)
- Label *Period*: dropdown (This service, Choose dates).
- Label *Format*: radio *PDF*, *Excel (CSV)*.
- Section *Include in report*: checkboxes for Group, Date, Time, Amount, Reference, Transaction ID, Sender name, Sender number.
- Switch with label *Hide member names and numbers* (off by default).
- Summary line: *38 payments, GHS 4,310.00*.
- Button: *Export report*.
- Success state: *Report is ready*, buttons *Share file*, *Open file*.
- Error state: *We couldn't create the report. Check that the phone has free storage and try again.* Button *Try again*.

### I. Services (Form in bottom sheet)
- Reached from the period selector: *Create service*.
- Fields: *Service name* (placeholder `Sunday service`), *Date*, *Start time*, *End time*.
- Button: *Save service*.

### J. Settings (Settings)
- Rows: *Scan messages again*, *App lock* (switch, open question), *Networks supported* (MTN now, others coming), *About AuCourant*, *Delete all data*.
- *Delete all data* opens a dialog naming the action: *Delete all AuCourant data from this phone? Reports you exported stay in your files.* Buttons *Delete data*, *Cancel*.

## 6. States checklist (design every screen in these)

| State | Required on |
|---|---|
| Loading | Home, Groups, Transactions, scan, export |
| First-use empty | Home, Groups, Transactions, Review |
| Filtered empty | Transactions, Groups search |
| Error | Scan, export, message not read |
| Populated | All |

Empty and loading states keep the same frame (list border, header, search) as the populated screen. No layout jump.

## 7. Components to build in Figma

App bar, bottom navigation, big number card, attention card (warning), group row, payment row, search field, filter chip, checkbox row, radio, switch, text field with visible label, primary button, secondary button, text button, destructive button, bottom sheet, confirmation dialog, merge suggestion card, progress bar, skeleton row, inline error, empty state block.

Each component needs: default, pressed, disabled, focused, error where it applies.

## 8. Sample data (fake, use in mockups)

Groups: Offering GHS 2,450.00 (22), Tithe GHS 980.00 (9), Harvest GHS 420.00 (4), Thanksgiving GHS 840.00 (12), Welfare GHS 200.00 (3), No reference GHS 120.00 (3).
Senders: Akosua Mensah, Kofi Boateng, Ama Owusu, Yaw Darko, Efua Quaye.
Never use a real person's name or number.

## 9. Out of scope for this design

Personal budgeting, spending categories, charts, fee warnings, accounts and login, cloud sync, dark mode, tablet layouts, iPhone.

## 10. Handoff

- Frame size **360 by 800** (Android). Name frames like `A1 Welcome`, `B Home`, `G1 Merge suggestions`.
- Use Figma styles and variables for every token above.
- Mark each screen with its pattern name in the frame description.
- Share the Figma link or an export of the frames. Then the build starts with the parser and database, and the screens are wired on top.

## 11. Open design questions

- App lock: show the switch now or hide until decided?
- How a "service" is defined: named window (as drawn in screen I) or by weekday.
- Whether exports need a fixed layout for leadership.
- Logo and app icon (name and wordmark: **AuCourant**).
