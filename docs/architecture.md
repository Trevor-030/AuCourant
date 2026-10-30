# Architecture: AuCourant

> High-level decision doc. Intent lives in `aucourant.prd.md`. Task-level plans come later.
> Constraints from the founder: **Java**, **Android only**, **free resources only**, **everything on the phone**, **direct APK install** (not Play Store).

## Problem & goals

Church financial staff sort MoMo payment SMS by hand. AuCourant reads the SMS on one phone, groups received money by reference, suggests merges of similar references, and exports a report. Target: 0 manual fixes per service and a report in about 3 minutes. Every decision below is judged against that and against "free, private, simple."

## Approaches considered

**A. Native Android in Java, parse SMS on device (recommended).**
Reads SMS directly, stores locally, no server. Free, private, works offline. Needs SMS permission, so it cannot go on the Play Store (see Boundaries).

**B. Share or import messages into the app.**
User forwards or imports SMS instead of auto-reading. May be Play-friendly, but loses the "it just works" promise and adds work for staff. Kept as a later fallback.

**C. Pull data from a MoMo business statement or merchant export.**
Cleaner data, possibly typed references included, but needs setup and not every church has it. Founder says possible later. Not in MVP.

**Why A:** it is the only option that gives automatic sorting with zero running cost, which is what the hypothesis tests.

## Recommended approach

An Android app with five parts that all live on the phone:

1. **SMS intake:** a receiver catches new MoMo SMS and a one-time scan reads the existing inbox.
2. **Parser:** one template per message type and network turns raw SMS into a clean transaction. Unknown messages are kept, never dropped.
3. **Grouping:** the reference becomes a group. Similar references are *suggested* as merges and the treasurer confirms. No reference means the "No reference" group.
4. **Review screens:** totals per group for a chosen service or period, with an Untagged and No reference list.
5. **Export:** Excel and PDF, staff choose the fields, hiding member names and numbers is an option.

## Key decisions

**Stack & libraries (all free)**

| Need | Choice | Alternatives |
|---|---|---|
| Language | Java (founder requirement) | Kotlin (not chosen, Java required) |
| IDE and build | Android Studio, Gradle, free emulator | none needed |
| UI | XML layouts with Material Components, ViewBinding | Jetpack Compose (poor fit with Java) |
| Storage | Room on SQLite, app-private | raw SQLite |
| Parsing | Java regex, one parser class per message type | ML (overkill, not explainable) |
| Similarity | Hand-written normalization plus Levenshtein or Jaro-Winkler | Apache Commons Text (free, adds a dependency) |
| PDF | Android built-in `PdfDocument` | third-party PDF library |
| Excel | **CSV first** (opens in Excel, zero dependency), then real `.xlsx` after a spike | Apache POI (free but heavy on Android) |
| Distribution | APK on GitHub Releases or direct file share | Play Store ($25 fee and blocked by SMS policy) |
| Design | Figma free tier | none needed |

**Data model (shape only)**

- **Transaction:** transaction ID (unique), network, type (received, sent, cash in, cash out, other), amount, fee, counterparty name and number, raw reference, timestamp, balance, raw SMS text, parse status (parsed, partial, unparsed), group, how the group was set (auto, confirmed suggestion, manual).
- **Group:** name, plus system groups "No reference" and "Untagged".
- **ReferenceAlias:** a normalized reference mapped to a group, created when a merge is confirmed, so the same wording never needs deciding twice.
- **MergeSuggestion:** two groups, similarity score, status (pending, accepted, rejected). Rejected pairs are never suggested again.
- **ReportingPeriod:** a named window for a service (start and end).

The **transaction ID is the unique key.** Importing the same SMS twice does nothing, so rescanning the inbox is always safe. This is also the fix for phones that kill background apps: if a message is missed live, the next inbox scan recovers it.

**Boundaries & contracts**

- **Play Store policy:** Google restricts SMS permissions to default messaging apps, so AuCourant ships as a direct APK. Church installs it from a link and allows installs from outside the store. Policy was checked in this planning session. Recheck before any Play submission.
- **Permissions:** RECEIVE_SMS and READ_SMS only. No internet permission is needed, which is also a trust message to churches.
- **Privacy:** no network, no cloud, no analytics. Turn off Android auto-backup for the database so member data is not uploaded. The export file is the backup.
- **Sensitive data:** the phone holds members' names and numbers. An optional app lock is an open question.
- **Signing key:** the APK must always be signed with the same key to update. Generate once, back it up safely. **One-way door.**
- **Sideloaded SMS permission:** newer Android versions may add extra steps before a sideloaded app can use SMS permission. Verify on a real phone (see spikes).

**Other**

- **Parsing is template-per-type, not one regex.** MTN already shows at least three message shapes. A registry of parsers makes adding Telecel and AirtelTigo a new class, not a rewrite.
- **Empty reference is a real value.** MTN prints "-" for none. The parser treats "-" as no reference.
- **Merging is suggest-and-confirm.** Church money means a wrong silent merge breaks trust. Confirming a merge is a one-time decision that is remembered.
- **Always keep the raw SMS** next to the parsed fields, so any parser mistake can be traced and fixed later without losing data.

## Missing pieces

- A library of **real SMS samples** (typed purposes, all three networks) to build parser tests from.
- A **reference cleaning step** to separate a typed purpose from auto-filled name, number, or network text.
- A defined meaning of "service" (named period) from the founder.
- App lock decision.
- Figma frontend (next step).

## Spikes & experiments

**Spike 1: Does a typed purpose show up, and where?**
```
Question:      When a giver types "offering", where does it appear in the SMS?
Spike:         Collect 20+ real received-payment SMS (several senders, 3 networks) and map the Reference field, over 1 to 2 days
Decision rule: go with reference-from-SMS if a typed purpose appears in most; if the Reference field is mostly name and number, rework (option C or ask givers to use a fixed format)
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

## Open questions

- How is a "service" defined, and can staff create and name them?
- Does the phone need a PIN or fingerprint lock?
- What exactly counts as a manual fix (does confirming a merge)?
- Do exports need a fixed layout for leadership, or fully free fields?
- Which Android versions must be supported (affects permissions and the oldest phones)?
- Telecel and AirtelTigo message formats: unknown until samples arrive.
- Personal-use features (budgets, fee warnings) are deferred to a later phase and will need their own architecture pass.
