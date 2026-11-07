# Architecture: AuCourant

> High-level decision doc, version 7 (use type choice added, number references, fonts changed to Instrument Serif and Inter). Intent lives in `aucourant.prd.md`. Visual design lives in `figma-brief.md`. Task-level plans come later.
> Constraints from the founder: **Java**, **Android only**, **free resources only**, **everything on the phone**, **direct APK install** (not Play Store).

## Problem & goals

Church financial staff sort MoMo payment SMS by hand. AuCourant reads the SMS on one phone, groups received money by reference, suggests merges of similar references, and exports a report. Target: 0 manual fixes per service and a report in about 3 minutes. Every decision below is judged against that and against "free, private, simple."

## Approaches considered

**A. Native Android in Java, parse SMS on device (recommended).**
Reads SMS directly, stores locally, no server. Free, private, works offline. Needs SMS permission, so it cannot go on the Play Store (see Boundaries).

**B. Share or import messages into the app.**
User forwards or imports SMS instead of auto-reading. May be Play-friendly, but loses the "it just works" promise and adds work for staff. Kept as a later fallback.

**C. Pull data from a MoMo business statement or merchant export.**
Cleaner data, possibly typed references included, but needs setup and not every church has it. Possible later. Not in MVP.

**Why A:** it is the only option that gives automatic sorting with zero running cost, which is what the hypothesis tests.

## Recommended approach

An Android app with seven parts that all live on the phone:

1. **SMS intake:** a receiver catches new MoMo SMS and a one-time scan reads the existing inbox.
2. **Parser:** one template per message type and network turns raw SMS into a clean transaction. Unknown messages are kept, never dropped.
3. **Reference cleaner:** decides whether the Reference field holds a typed purpose, a number code, or nothing (rules below).
4. **Grouping:** a typed purpose becomes a group. A number code is looked up in the church's **code book**. Similar references are *suggested* as merges and the treasurer confirms. No reference means the "No reference" group, so every payment has a group.
5. **Review and reports:** totals per group for a chosen service, a review queue (merges, codes to name, messages not read), and Excel and PDF export.
6. **Services:** a weekly service on a chosen weekday, plus special sessions for one-off dates.
7. **App lock:** the user's choice of 4-digit PIN, 6-digit PIN or password, with optional fingerprint, plus dark and light themes.

### Reference cleaning rules (from real samples)

Real MTN "Payment received" SMS show the Reference field in four ways, and the founder reports a fifth: some churches give a short number instead of a word.

| What the field holds | Example (shape) | Treated as |
|---|---|---|
| Typed purpose | `Reference: offering.` | **Reference** |
| Short number | `Reference: 1.` (reported by the founder, no sample yet) | **Code** |
| Blank | `Reference: .` | No reference |
| Dash | `Reference: -` (seen on payments sent) | No reference |
| Auto-filled by the network | `Reference: NAME ,2335xxxxxxx,tf from VODAFONE.` | No reference |

Rules, applied in order:
1. Trim spaces and trailing full stop.
2. Empty, `-`, or only punctuation: **no reference**.
3. Matches the auto-fill shape (a name, then a phone number, then short text with "from" and a network name): **no reference**. *Provisional: built from 2 samples, confirm with more samples and other networks.*
4. Only digits, 1 to 3 of them: a **code**. Leading zeros are dropped, so "01" and "1" are the same code. *Provisional: no real sample yet.*
5. Anything else: a typed purpose. Collapse repeated spaces. This includes a code with words ("1 offering"): **the words win**, because they already say the purpose. Digit-only values of 4 or more digits are also treated as typed text for now (open question below).

The original field is always stored untouched next to the cleaned value, so a wrong rule can be fixed later without losing data.

### Grouping rules

1. **Match key:** the cleaned reference, lower-cased, trimmed, punctuation removed. Two references with the same key are **the same group automatically** ("offering", "Offering", "OFFERING.").
2. **Display name:** the first wording seen, shown with a capital first letter. The treasurer can rename a group.
3. **Built-in known pairs (church type only):** a small list joins automatically and visibly. Confirmed: **"Offertory" counts as "Offering"** and **"Tithes" counts as "Tithe"**. The group shows *Also counted: Offertory*, and the join can be undone from Merge history.
4. **Everything else similar** (for example "Thanksgiving" and "Thanks giving") is **suggested** by the similarity score, and the treasurer confirms. Confirmed pairs are remembered.
5. Spacing differences are not auto-joined. They go through suggestions.
6. **Number codes use the code book.** The code book is a list on the phone: code to group name (1 is Offering, 2 is Tithe, 3 is Harvest). It starts **empty**, because every church uses its own numbers. A code means **the same thing in every service**, so there is no per-service version of the list.
   - Code found and listed: the payment goes into that group at once. The group shows *Also counted: 1*.
   - Code found and **not listed**: the payment goes into a group called *Code 5* so every payment still has a group. The code appears in the review queue under **Codes**, and the treasurer names it once (pick an existing group or type a new name). The name is remembered, so it is never asked again.
   - Naming a code is a one-time decision like confirming a merge, so it is **not a manual fix**. (Claude's decision, same logic as merges. The founder can reverse it.)
   - The treasurer can also add or edit codes ahead of time: at first run (an optional, skippable step after the use type choice and before the scan) or later in Settings, under Reference codes. Codes entered at first run are stored the same way as any other code. Editing a code's group moves all payments with that code, with Undo.
   - A code never guesses its meaning. The app does not assume "1" means offering.

## Key decisions

**Stack & libraries (all free)**

| Need | Choice | Alternatives |
|---|---|---|
| Language | Java (founder requirement) | Kotlin (not chosen, Java required) |
| IDE and build | Android Studio, Gradle, free emulator | none needed |
| UI | XML layouts with Material Components, ViewBinding, DayNight theme with custom colour tokens | Jetpack Compose (poor fit with Java) |
| Fonts | **Instrument Serif** (wordmark, onboarding titles, screen titles) and **Inter** (everything else, tabular figures for amounts), both free (open font licence), bundled in the APK | system font |
| Storage | Room on SQLite, app-private | raw SQLite |
| Parsing | Java regex, one parser class per message type | ML (overkill, not explainable) |
| Similarity | Hand-written normalization plus Levenshtein or Jaro-Winkler | Apache Commons Text (free, adds a dependency) |
| PDF | Android built-in `PdfDocument` | third-party PDF library |
| Excel | **CSV first** (opens in Excel, zero dependency), then real `.xlsx` after a spike | Apache POI (free but heavy on Android) |
| PIN or password | One salted hash from the JDK (PBKDF2), never stored in plain form. Same code for 4-digit PIN, 6-digit PIN and password (password at least 6 characters) | none needed |
| Fingerprint | AndroidX Biometric (free), the PIN or password always works as fallback. Check the library's current status when building | lock only |
| Distribution | APK on GitHub Releases or direct file share | Play Store ($25 fee and blocked by SMS policy) |
| Design | Figma free tier | none needed |

**Data model (shape only)**

- **Transaction:** transaction ID (unique), network, type (received, sent, cash in, cash out, other), amount, fee, counterparty name and number, raw reference, cleaned reference (nullable), reference kind (typed, code, none), timestamp, balance, raw SMS text, parse status (parsed, partial, unparsed), group, how the group was set (auto, code book, confirmed suggestion, manual).
- **Group:** name, plus the system group "No reference". A group made for an unnamed code is flagged *unnamed code* until the treasurer names it.
- **ReferenceAlias:** a normalized reference mapped to a group. It has a **kind** (wording or code) and a **source** (built-in, confirmed merge, named code, added in Settings). The code book is simply the aliases of kind code. Created when a merge is confirmed or a code is named, and pre-filled from the built-in known pairs, so the same wording or number never needs deciding twice.
- **MergeSuggestion:** two groups, similarity score, status (pending, accepted, rejected). Rejected pairs are never suggested again.
- **GroupChange:** payment, from group, to group, time, kind (auto, confirmed suggestion, code named, manual, undo). It powers Undo, the merge history and the manual-fix count.
- **WeeklyService:** weekday (default Sunday), start time, end time.
- **SpecialSession:** name, date, start time, end time. A payment inside a special session's window belongs to it, not to the weekly service, so no payment is counted twice.
- **Settings:** use type (church or organisation), theme (dark, light, match phone), lock type (4-digit PIN, 6-digit PIN, password) or none, fingerprint on or off, lock hash and salt, recovery code hash and salt, last export format and fields, whether to hide member names and numbers in exports.

A payment belongs to a service by its timestamp. Every payment already belongs to a group, so there is no separate "untagged" state.

The **transaction ID is the unique key.** Importing the same SMS twice does nothing, so rescanning the inbox is always safe. This also fixes phones that kill background apps: if a message is missed live, the next inbox scan recovers it.

**Manual fix tracking:** every time the treasurer moves a payment or edits a group, the app records it as a GroupChange (kind = manual). An undo is recorded too and cancels that fix out. The pilot metric "0 manual fixes per service" is read directly from this. Confirming a merge and naming a code are recorded as their own kinds and are **not counted**.

**Boundaries & contracts**

- **Play Store policy:** Google restricts SMS permissions to default messaging apps, so AuCourant ships as a direct APK. Church installs it from a link and allows installs from outside the store. Policy was checked in this planning session. Recheck before any Play submission.
- **Permissions:** RECEIVE_SMS and READ_SMS, plus biometric use for fingerprint. No internet permission is needed, which is also a trust message to churches.
- **Privacy:** no network, no cloud, no analytics. Turn off Android auto-backup for the database so member data is not uploaded. The export file is the backup.
- **App lock:** the lock stops people opening the app on the shared phone. **Decision: no database encryption**, the lock only. App data is private to the app and backups are off, but the file itself is not encrypted. Revisit if a church asks for more.
- **Forgot PIN or password:** the **recovery code** resets the lock and keeps all data. At lock setup the app makes a 12-character code from a 32-symbol alphabet with no look-alikes (no 0, O, 1, I), using the platform's secure random generator. The code is shown **once**, stored only as a salted hash (same code path as the lock), and checked with the same wrong-try delay. Using it forces a new lock and a **new recovery code**, and the old code stops working. A new code can be made from Settings after unlocking. If both the lock and the code are lost, the **last resort** is to erase the app's data and rescan the inbox. Payments come back from the SMS inbox, but custom group names, merges, **reference codes** and sessions do not.
- **Why not the phone's own screen lock as a reset:** on a shared phone other people may know it, which would defeat the app lock.
- **Signing key:** the APK must always be signed with the same key to update. Generate once, back it up safely. **One-way door.**
- **Sideloaded SMS permission:** newer Android versions may add extra steps before a sideloaded app can use SMS permission. Verify on a real phone (see spikes).

**Other**

- **Parsing is template-per-type, not one regex.** MTN already shows at least three message shapes. A registry of parsers makes adding Telecel and AirtelTigo a new class, not a rewrite.
- **Merging is suggest-and-confirm.** Church money means a wrong silent merge breaks trust. Confirming a merge is a one-time decision that is remembered. Codes follow the same idea: the app never guesses what a number means.
- **Always keep the raw SMS** next to the parsed fields, so any parser mistake can be traced and fixed later without losing data.
- **Exports show group names, not codes.** The Reference field in an export is the original text, so "1" stays "1" there while the Group column says Offering.
- **Use type (church or organisation) is a setting, not a separate app.** It is chosen on first run and can be changed in Settings. It only changes three things: the wording (strings: *service* for church, *period* for organisation), the built-in known pairs (church only), and the first-run copy. Parsing, grouping, codes, review, export and lock are identical. Switching later changes wording at once, and stops future built-in joins. Joins already made stay and remain in Merge history. **Personal** is shown as coming soon and is not selectable. (Claude's decision, founder asked for the choice.)
- **Theme tokens are shared:** one set of colour and type tokens with a dark mode and a light mode, mirrored from the Figma variables (see `figma-brief.md`). The palette has no purple.

## Missing pieces

- **More real SMS samples** when available: Telecel, AirtelTigo, messy typed references, and **a payment with a number as the reference**. The MVP supports **MTN only**, built from the samples already collected.
- A backup file for groups, merges, reference codes and sessions, so the last-resort erase costs less. Deferred, not in the MVP.
- Figma frontend (in progress).

## Spikes & experiments

**Spike 1: Reference quality (partly answered).**
```
Question:      Where does a typed purpose appear, how often is it clean, and how do number references look?
Answered:      MTN "Payment received" SMS carry a typed purpose in the Reference field (seen: "offering"). Blank and network auto-filled values also occur (4 samples).
Still open:    Telecel and AirtelTigo formats, how messy real typed references are, and how number references appear in real SMS (length, spacing, punctuation)
Spike:         Deferred. The founder chose to use the existing samples. Revisit when a pilot church provides real messages (1 to 2 days)
Decision rule: keep reference-from-SMS if most payments with a purpose are clean; otherwise strengthen the cleaner and the merge suggestions. Keep the code rule (1 to 3 digits) if real number references fit it; widen it if not
```

**Spike 2: Can a sideloaded app read SMS on real phones?**
```
Question:      Does a directly installed APK get SMS permission and receive messages on common phones?
Spike:         Build a tiny app that only lists MoMo SMS, install it on 2 to 3 real phones (different brands and Android versions), over 1 day
Decision rule: go with direct APK if permission and live receive work; if blocked, document the extra steps for the treasurer or reconsider option B
```

**Spike 3: Merge quality**
```
Question:      Can similarity scoring group real references without wrong merges?
Spike:         Run the scorer over collected references and review every suggested pair, over half a day
Decision rule: keep suggest-and-confirm in all cases; tune the threshold so wrong suggestions stay rare
```

**Spike 4: Excel export**
```
Question:      Is real .xlsx worth it, or is CSV enough?
Spike:         Ship CSV first, ask 2 treasurers whether it opens fine in Excel, over the pilot
Decision rule: stay with CSV if they are happy; add .xlsx only if they ask
```

**Spike 5: Fingerprint and lock on cheap phones**
```
Question:      Does fingerprint unlock work reliably on the phones churches actually use?
Spike:         Test on 2 to 3 real low-cost phones, half a day
Decision rule: keep fingerprint as optional if it works; PIN stays the guaranteed way in
```

## Decided in this round

- **First run asks for reference numbers** before the scan (optional, skippable), so fewer payments wait in unnamed code groups.
- **Reports:** layout is not fixed because each leader chooses. One default report plus a choice of fields. Saved layouts later.
- **Other networks:** Telecel and AirtelTigo messages are tried with the MTN template for now. Anything it cannot read goes to *Not read*. They are not promised as supported.
- **Use type:** first run asks Church or Organisation. Personal shows as coming soon. It is a setting that changes wording and built-in known pairs only.
- **Number references:** a per-church code book (code to group name). Numbers mean the same thing every week, but different churches use different numbers, so the book starts empty and is filled by naming codes as they first appear, or by adding them in Settings.
- A code is 1 to 3 digits, leading zeros ignored. A code with words ("1 offering") uses the words.
- An unnamed code goes into its own group (*Code 5*) until named. Naming a code is not a manual fix.
- Codes are lost with a last-resort erase, like group names and merges.
- **Fonts:** Instrument Serif and Inter replace Manrope and Inter.
- **No purple** in the palette. See `figma-brief.md`.
- Lock: the user chooses a 4-digit PIN, a 6-digit PIN or a password. Setup can be done later.
- **Recovery code** at setup resets a forgotten lock without erasing data. Erase is only the last resort.
- Special session overlap: the special session wins for payments inside its window.
- Case-only differences are one group automatically. Built-in pairs: "Offertory" counts as "Offering", "Tithes" counts as "Tithe".
- No database encryption.
- MTN only for the MVP, using the existing samples.
- Undo: message for about 8 seconds, plus Merge history in Settings for merges and named codes.

## Open questions

- Which Android versions must be supported (affects permissions and the oldest phones)?
- Personal-use features (budgets, fee warnings) are deferred and will need their own architecture pass.
- A giver might type an amount like "50" as the reference. Is it a code, or noise? Needs real samples.
- Should a number with 4 or more digits ever count as a code (for example 1001)? Today it is treated as typed text.
- Personal use, later: its own spending view, no services. It may also serve small businesses with transaction views and easier browsing of messages. It needs its own architecture pass.
