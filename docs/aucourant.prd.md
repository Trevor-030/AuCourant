# AuCourant: Product Requirements Document

> Name: AuCourant. Tagline: *Stay au courant with your MoMo.*
> Status: Draft v9 (use type choice at first run, number references, purple removed from the visual identity).
> Intent only. Engineering decisions live in `architecture.md`. Visual decisions live in `figma-brief.md`.

---

## 1. Problem Statement

Churches and similar organizations collect money all week through mobile money (MoMo). Each payment arrives as an SMS on one phone, often with a short reference written by the giver (offering, harvest, thanksgiving, welfare, and so on). Some churches give a **number** instead of a word (for example 1 or 2).

The financial staff must read these messages one by one and sort them by purpose before they can report to leadership. The work is slow, repetitive, and easy to get wrong. A mistyped reference, a missed message, or a mis-sorted amount means the numbers leadership sees may not match the money received.

**Cost of not solving it:** hours of manual sorting each reporting cycle, reports that are hard to trust, and a records process that depends on one person's patience.

## 2. Evidence

| Claim | Status |
|---|---|
| Churches sort MoMo SMS by reference by hand | **Observed** by the founder firsthand. Single observation. |
| This is painful enough that they would switch | **Assumption.** Validate by sitting with 3 to 5 church treasurers or finance secretaries and watching how they sort today. |
| Staff sort and report once per service. Services are usually on Sundays, and special sessions also happen | **Stated** by the founder. Validate with real treasurers. |
| MTN SMS come in at least 3 shapes: Cash In (no reference), Payment sent (reference shown as "-" when empty), Payment received (has a Reference field) | **Observed** from real samples. |
| In "Payment received" SMS the Reference field shows up in 3 ways: a typed purpose (for example "offering"), blank, or auto-filled by the network with the sender's name, phone number and text like "tf from VODAFONE" | **Observed** in 4 real samples. Telecel and AirtelTigo formats unknown. |
| Today's manual time for one service is about 30 to 60 minutes for about 40 payments, and 1 to 2 hours for 100 or more | **Assumption (founder guess).** Time a real treasurer to confirm. |
| Typed references vary in case, spelling and spacing ("Thanksgiving", "Thanks giving") | **Assumption.** No messy samples yet. The pilot will show how messy real references are. |
| Some churches use a number as the reference (1, 2, and so on). A number means the same thing every week, but different churches use different numbers | **Stated** by the founder. No real SMS sample with a number yet. |

## 3. Thesis (why build it)

**Why this:** The data already exists in the SMS inbox. The work is only reading and sorting, which a machine can do.

**Why now:** MoMo is now a normal way to give and pay. Volume of small, referenced payments keeps growing, and the manual process does not scale with it.

**Why it beats how they cope today:** Today staff scroll SMS and sort by eye, or by notebook or spreadsheet. The app does the sorting as messages arrive, groups similar references together, and produces the report. The switch is worth it only if staff spend clearly less time and trust the totals as much as their own count.

A second, smaller audience exists: individuals who want to understand their own MoMo spending and income, and small businesses that want their transactions easy to browse. They are not the focus of the first release.

## 4. Hypothesis

> We believe **automatically sorting incoming MoMo money by reference, with similar references grouped together**, will cause **church financial staff** to **stop reading SMS by hand and export their reports straight from the app**, resulting in **less time spent on records and fewer sorting mistakes**.
>
> We'll know we're **RIGHT** if **a treasurer uses it with real money for one full month, exports at least one report to leadership, needs to manually fix 0 transactions per service, and has the report ready in about 3 minutes.**
>
> We'll know we're **WRONG** if **most money lands in "No reference", or the treasurer keeps sorting by hand alongside the app, or grouped references are wrong often enough that they stop trusting the totals.**

**What counts as a manual fix:** moving a payment to a different group, or editing a group by hand to correct the app's work. **Confirming a suggested merge is not a manual fix** (decided by the founder), because it is a one-time decision that the app remembers. **Naming a number code is not a manual fix either** (Claude's decision, same logic, founder can reverse it): the app cannot know what a church's number means, so the treasurer says it once.

## 5. Target User & JTBD

**Primary user:** Financial staff of a church or similar organization (treasurer, finance secretary). One shared phone receives the MoMo SMS.

**Job to be done:**
> When the church receives MoMo money through the week, I want it sorted by purpose automatically, so I can report to leadership without reading every SMS.

**Secondary user (later):** An individual tracking their own MoMo money, or a small business that wants clear transaction views and easier browsing of MoMo messages.

**Non-users (agreed draft, validate with real treasurers):**
- Organizations that already receive payments through a gateway or API and get clean data
- iPhone users (the product depends on reading SMS on the phone)
- Organizations that want online card giving

## 6. MVP

**The thinnest line that proves the hypothesis end to end:**

1. The app reads existing and incoming MoMo SMS on the phone.
2. It pulls out amount, sender, date, and reference for each received payment.
3. A reference is only what the giver typed. If the Reference field is blank, "-", or filled by the network with the sender's own details, the payment has **no reference**.
4. It sorts payments into groups by reference (offering, harvest, thanksgiving, welfare, and so on). Payments with no reference go to the **No reference** group. Every payment ends up in a group.
5. References that differ only by capital letters or punctuation (for example "offering" and "Offering") are one group automatically. A small built-in list of known pairs also joins automatically for the church type, starting with **"Offertory" counted as "Offering"**, and the group always shows what it includes. Any other similar references (for example "Thanksgiving" and "Thanks giving") are **suggested** as merges and the treasurer **confirms** each one.
6. **Number references:** when a giver types a short number (1 to 3 digits) as the reference, the app looks it up in the church's **code list** (for example 1 is Offering, 2 is Tithe). The list starts empty because every church uses its own numbers. A number that is not on the list lands in its own group (*Code 5*) and is shown in the review queue, where the treasurer names it **once**. The name is remembered, and the number means the same thing in every service. The treasurer can also add or edit codes ahead of time in Settings. The app never guesses what a number means.
7. The treasurer can move any payment to another group with one tap. Moves and merges happen at once and can be **undone** right away from a short message at the bottom of the screen, or later, for merges and named codes, from **Merge history** in Settings. The Undo message stays for about 8 seconds.
8. The treasurer sees totals per group for a chosen service.
9. **Services:** a weekly service on a chosen day (default Sunday), plus **special sessions** the treasurer can create at any time. Payments inside a special session count there and not in the weekly service, so nothing is counted twice.
10. The treasurer exports the result to **Excel** and **PDF**. Staff choose which fields appear. Hiding member names and phone numbers is an **option**, not the default. Export remembers the last format and fields, so repeat exports take a few taps.
11. **App lock:** the user chooses the lock: a 4-digit PIN, a 6-digit PIN, or a password. Fingerprint can be turned on as a faster way in. Setup can be done later. At setup the app shows a **recovery code** once. If the PIN or password is forgotten, the code resets the lock **without erasing any data**.
12. **Appearance:** dark theme by default, light theme available. The colours are midnight, emerald and gold. **No purple.**
13. **First impression:** the welcome screen shows what the app does with a simple drawing (messages turning into tidy groups), says plainly that nothing leaves the phone, and has one clear button.

14. **Who it is for:** on first run the user picks **Church** or **Organisation** (Personal is shown as coming soon). Church starts with the word *service* and the built-in known pairs. Organisation starts with the word *period* and no built-in pairs. Everything else works the same. It can be changed later in Settings. After this, the app asks for message access once, with a short plain explanation.

**Not in the MVP:** personal budgeting, spending categories, fee warnings, charts, multiple users or accounts, cloud sync, database encryption, and networks other than **MTN** (the only network with real samples).

**Door check:**
- Reading and parsing SMS across networks is a **one-way door** (everything depends on it). Prove it first with real samples.
- The signing key for the app is also a **one-way door** (see architecture).
- Group names, screens, colours, fonts and export layout are **two-way doors**. Build and adjust freely.

## 7. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Manual fix rate | 0 manual fixes per service | Count of payments moved or groups edited by hand per service, over one month of real use. Very strict, founder believes it is realistic, confirm in the pilot. |
| Real-world adoption | At least 1 organization uses it for a full month with real money | Pilot with a treasurer, check-in at week 2 and week 4 |
| Reporting outcome | At least 1 export delivered to leadership | Treasurer confirms |
| Time to report | About 3 minutes from opening the app to an exported report, for one service | Timed with a real treasurer. Today's manual time is long and grows with the number of payments. |
| Trust | Treasurer reports totals match their own count | Spot check of one week against their manual count |
| No reference share | Under 10% of received money in No reference | Share of amount and count |

## 8. Non-goals

- Not a payment app. It never sends, requests, or moves money.
- Not a replacement for full accounting software.
- Not a way to collect money online.
- No cloud upload of messages in the first release.
- No iPhone version in the first release.
- No user accounts, roles or approvals in the first release.
- No silent merging beyond capital letters, punctuation and the built-in known pairs. Those are always visible and can be undone.
- No guessing what a number reference means. The treasurer says it once.

## 9. Open Questions

**Resolved**
- [x] A reference should always be present, otherwise the payment is in the "No reference" group.
- [x] Confirming a merge does not count as a manual fix.
- [x] A service is a day of the week (usually Sunday), with special sessions for one-off dates.
- [x] The app has a lock chosen by the user: 4-digit PIN, 6-digit PIN or password, with fingerprint as an option.
- [x] Special sessions can be created at any time. Payments inside a special session count there, not in the weekly service (Claude's rule, founder said "allow it whenever").
- [x] "offering" and "Offering" are one group automatically. "Offertory" counts as "Offering".
- [x] No database encryption. The lock only.
- [x] Use the existing MTN samples. MTN only for the MVP.
- [x] Undo: a message for about 8 seconds, plus Merge history in Settings for merges (Claude's decision, founder said "decide").
- [x] Founder believes 0 manual fixes per service is realistic. To be proven in the pilot, not assumed.
- [x] Fix target 0, time target about 3 minutes, name AuCourant, Android only, one phone, direct APK, free resources only, export field choice and hide-names option.
- [x] Erasing all data after a forgotten PIN or password is **not acceptable** (founder). A recovery code resets the lock and keeps the data. Erase stays only as a last resort if both the lock and the code are lost.
- [x] Lock setup can be done later (offered once).
- [x] Built-in known pairs: "Offertory" counted as "Offering" and "Tithes" counted as "Tithe".
- [x] **Number references:** some churches use numbers. A number means the same thing every week, but differs between churches (founder). So each church has its own code list, empty at the start.
- [x] **Visual identity:** was Midnight Emerald Royal, now **Midnight Emerald Gold** (founder asked to remove purple). Dark theme default with a light theme.
- [x] **Fonts:** Instrument Serif for the wordmark and titles, Inter for the rest (founder picked option A).
- [x] Naming a code is not a manual fix (Claude's decision, same logic as merges).
- [x] **First run asks who the app is for:** Church or Organisation, with Personal shown as coming soon (founder asked for the choice). It changes wording and built-in known pairs only (Claude's decision).

**Resolved in this round (founder answers)**
- [x] **Report layout:** not fixed. Each church leader chooses the layout and what it contains. The app keeps one default report (totals per group, then the payment list) and lets staff choose the fields. Saved layouts can come later.
- [x] **Baseline time today:** a guess for now, to be checked with a real treasurer: about 30 to 60 minutes for a service with about 40 payments, and 1 to 2 hours for 100 or more.
- [x] **Telecel and AirtelTigo:** use the same template as MTN for now. Messages it cannot read go to *Not read*. They are not promised as supported.
- [x] **Number references** come in the same Reference field and the same plain format as typed references.
- [x] **Recovery code:** where it is kept is up to the church leader (Claude's reading of the founder's answer, correct if wrong).
- [x] **Personal use, later:** its own spending view, no services. It may also serve **small businesses**: transaction views and an easier way to look through MoMo messages. Not in the MVP.

**Still open**
- [ ] Should first run offer to enter the church's codes before the scan, so fewer payments wait in *Code 5* style groups? (See architecture: a *Code 5* group is a temporary group for a number the app has no name for yet.)

## 10. Risks (not questions)

- **Messy references:** real references can be messier than the 4 samples. The 0 manual fixes target is untested on messy data until the pilot.
- **Other networks:** Telecel and AirtelTigo may word their messages differently, so many could land in *Not read* until real samples exist.
- **Numbers that are not codes:** a giver might type an amount like "50" as the reference, or a number with 4 or more digits. Today the first is read as a code and the second as typed text. Real samples will show if this is a problem.
