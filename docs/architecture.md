# Architecture: AuCourant

> High-level decision doc, version 3 (adds undo history and export memory from the design pass). Intent lives in `aucourant.prd.md`. Visual design lives in `figma-brief.md`. Task-level plans come later.
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
3. **Reference cleaner:** decides whether the Reference field holds a typed purpose or not (rules below).
4. **Grouping:** a typed purpose becomes a group. Similar references are *suggested* as merges and the treasurer confirms. No reference means the "No reference" group, so every payment has a group.
5. **Review and reports:** totals per group for a chosen service, a review queue, and Excel and PDF export.
6. **Services:** a weekly service on a chosen weekday, plus special sessions for one-off dates.
7. **App lock:** PIN, with optional fingerprint, plus dark and light themes.

### Reference cleaning rules (from real samples)

Real MTN "Payment received" SMS show the Reference field in three ways:

| What the field holds | Example (shape) | Treated as |
|---|---|---|
| Typed purpose | `Reference: offering.` | **Reference** |
| Blank | `Reference: .` | No reference |
| Dash | `Reference: -` (seen on payments sent) | No reference |
| Auto-filled by the network | `Reference: NAME ,2335xxxxxxx,tf from VODAFONE.` | No reference |

Rules, applied in order:
1. Trim spaces and trailing full stop.
2. Empty, `-`, or only punctuation: **no reference**.
3. Matches the auto-fill shape (a name, then a phone number, then short text with "from" and a network name): **no reference**. *Provisional: built from 2 samples, confirm with more samples and other networks.*
4. Anything else: a typed purpose. Collapse repeated spaces.

The original field is always stored untouched next to the cleaned value, so a wrong rule can be fixed later without losing data.

## Key decisions

**Stack & libraries (all free)**

| Need | Choice | Alternatives |
|---|---|---|
| Language | Java (founder requirement) | Kotlin (not chosen, Java required) |
| IDE and build | Android Studio, Gradle, free emulator | none needed |
| UI | XML layouts with Material Components, ViewBinding, DayNight theme with custom colour tokens | Jetpack Compose (poor fit with Java) |
| Fonts | Manrope and Inter, both free (open font licence), bundled in the APK | system font |
| Storage | Room on SQLite, app-private | raw SQLite |
| Parsing | Java regex, one parser class per message type | ML (overkill, not explainable) |
| Similarity | Hand-written normalization plus Levenshtein or Jaro-Winkler | Apache Commons Text (free, adds a dependency) |
| PDF | Android built-in `PdfDocument` | third-party PDF library |
| Excel | **CSV first** (opens in Excel, zero dependency), then real `.xlsx` after a spike | Apache POI (free but heavy on Android) |
| PIN | Salted hash from the JDK (PBKDF2), never stored in plain form | none needed |
| Fingerprint | AndroidX Biometric (free), PIN always available as fallback. Check the library's current status when building | PIN only |
| Distribution | APK on GitHub Releases or direct file share | Play Store ($25 fee and blocked by SMS policy) |
| Design | Figma free tier | none needed |

**Data model (shape only)**

- **Transaction:** transaction ID (unique), network, type (received, sent, cash in, cash out, other), amount, fee, counterparty name and number, raw reference, cleaned reference (nullable), timestamp, balance, raw SMS text, parse status (parsed, partial, unparsed), group, how the group was set (auto, confirmed suggestion, manual).
- **Group:** name, plus the system group "No reference".
- **ReferenceAlias:** a normalized reference mapped to a group, created when a merge is confirmed, so the same wording never needs deciding twice.
- **MergeSuggestion:** two groups, similarity score, status (pending, accepted, rejected). Rejected pairs are never suggested again.
- **GroupChange:** payment, from group, to group, time, kind (auto, confirmed suggestion, manual, undo). It powers Undo, the merge history and the manual-fix count.
- **WeeklyService:** weekday (default Sunday), start time, end time.
- **SpecialSession:** name, date, start time, end time.
- **Settings:** theme (dark, light, match phone), lock on or off, fingerprint on or off, PIN hash and salt, last export format and fields, whether to hide member names and numbers in exports.

A payment belongs to a service by its timestamp. Every payment already belongs to a group, so there is no separate "untagged" state.

The **transaction ID is the unique key.** Importing the same SMS twice does nothing, so rescanning the inbox is always safe. This also fixes phones that kill background apps: if a message is missed live, the next inbox scan recovers it.

**Manual fix tracking:** every time the treasurer moves a payment or edits a group, the app records it as a GroupChange (kind = manual). An undo is recorded too and cancels that fix out. The pilot metric "0 manual fixes per service" is read directly from this. Confirming a merge is recorded as a confirmed suggestion and is **not** counted.

**Boundaries & contracts**

- **Play Store policy:** Google restricts SMS permissions to default messaging apps, so AuCourant ships as a direct APK. Church installs it from a link and allows installs from outside the store. Policy was checked in this planning session. Recheck before any Play submission.
- **Permissions:** RECEIVE_SMS and READ_SMS, plus biometric use for fingerprint. No internet permission is needed, which is also a trust message to churches.
- **Privacy:** no network, no cloud, no analytics. Turn off Android auto-backup for the database so member data is not uploaded. The export file is the backup.
- **App lock:** the PIN stops people opening the app on the shared phone. It does not by itself encrypt the database file (see open questions).
- **Forgot PIN:** with no account or server there is no remote reset. The only recovery is to erase the app's data and rescan the inbox. Exported reports stay in the phone's files.
- **Signing key:** the APK must always be signed with the same key to update. Generate once, back it up safely. **One-way door.**
- **Sideloaded SMS permission:** newer Android versions may add extra steps before a sideloaded app can use SMS permission. Verify on a real phone (see spikes).

**Other**

- **Parsing is template-per-type, not one regex.** MTN already shows at least three message shapes. A registry of parsers makes adding Telecel and AirtelTigo a new class, not a rewrite.
- **Merging is suggest-and-confirm.** Church money means a wrong silent merge breaks trust. Confirming a merge is a one-time decision that is remembered.
- **Always keep the raw SMS** next to the parsed fields, so any parser mistake can be traced and fixed later without losing data.
- **Theme tokens are shared:** one set of colour and type tokens with a dark mode and a light mode, mirrored from the Figma variables (see `figma-brief.md`).

## Missing pieces

- **More real SMS samples:** Telecel and AirtelTigo, and messy typed references (case, spelling, extra words).
- A rule for a special session that overlaps a weekly service.
- Encryption decision for data at rest.
- Figma frontend (in progress).

## Spikes & experiments

**Spike 1: Reference quality (partly answered).**
```
Question:      Where does a typed purpose appear, and how often is it clean?
Answered:      MTN "Payment received" SMS carry a typed purpose in the Reference field (seen: "offering"). Blank and network auto-filled values also occur (4 samples).
Still open:    Telecel and AirtelTigo formats, and how messy real typed references are
Spike:         Collect 20+ more real received-payment SMS across senders and networks, 1 to 2 days
Decision rule: keep reference-from-SMS if most payments with a purpose are clean; otherwise strengthen the cleaner and the merge suggestions
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

**Spike 5: Fingerprint and PIN on cheap phones**
```
Question:      Does fingerprint unlock work reliably on the phones churches actually use?
Spike:         Test on 2 to 3 real low-cost phones, half a day
Decision rule: keep fingerprint as optional if it works; PIN stays the guaranteed way in
```

## Open questions

- Encrypt the database at rest (free options exist, they add size and complexity), or rely on the PIN and Android's own protection?
- PIN length (4 or 6 digits) and whether setup may be skipped.
- Which service wins when a special session overlaps the weekly service?
- Should group names ignore case so "offering" and "Offering" are one group automatically?
- Do exports need a fixed layout for leadership, or fully free fields?
- Which Android versions must be supported (affects permissions and the oldest phones)?
- Personal-use features (budgets, fee warnings) are deferred and will need their own architecture pass.
