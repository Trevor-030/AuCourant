# AuCourant: Product Requirements Document

> Name: AuCourant. Tagline: *Stay au courant with your MoMo.*
> Status: Draft v2 (open questions answered). Intent only. Engineering decisions live in the architecture doc.

---

## 1. Problem Statement

Churches and similar organizations collect money all week through mobile money (MoMo). Each payment arrives as an SMS on one phone, often with a short reference written by the giver (offering, harvest, thanksgiving, welfare, and so on).

The financial staff must read these messages one by one and sort them by purpose before they can report to leadership. The work is slow, repetitive, and easy to get wrong. A mistyped reference, a missed message, or a mis-sorted amount means the numbers leadership sees may not match the money received.

**Cost of not solving it:** hours of manual sorting each reporting cycle, reports that are hard to trust, and a records process that depends on one person's patience.

## 2. Evidence

| Claim | Status |
|---|---|
| Churches sort MoMo SMS by reference by hand | **Observed** by the founder firsthand. Single observation. |
| This is painful enough that they would switch | **Assumption.** Validate by sitting with 3 to 5 church treasurers or finance secretaries and watching how they sort today. |
| Reference wording is inconsistent (typos, spacing, variants) | **Assumption.** Validate by collecting real SMS samples from at least 2 organizations (names and numbers hidden). |
| Staff sort and report once per service | **Stated** by the founder. Validate with real treasurers. |
| MTN "Cash In" SMS carries amount, sender name, balance, transaction ID, fee, but **no reference** | **Observed** from a real sample. Where the reference lives for other payment types is **unknown**, see Open Questions. |

## 3. Thesis (why build it)

**Why this:** The data already exists in the SMS inbox. The work is only reading and sorting, which a machine can do.

**Why now:** MoMo is now a normal way to give and pay. Volume of small, referenced payments keeps growing, and the manual process does not scale with it.

**Why it beats how they cope today:** Today staff scroll SMS and sort by eye, or by notebook or spreadsheet. The app does the sorting as messages arrive, groups similar references together, and produces the report. The switch is worth it only if staff spend clearly less time and trust the totals as much as their own count.

A second, smaller audience exists: individuals who want to understand their own MoMo spending and income. They are not the focus of the first release.

## 4. Hypothesis

> We believe **automatically sorting incoming MoMo money by reference, with similar references grouped together**, will cause **church financial staff** to **stop reading SMS by hand and export their reports straight from the app**, resulting in **less time spent on records and fewer sorting mistakes**.
>
> We'll know we're **RIGHT** if **a treasurer uses it with real money for one full month, exports at least one report to leadership, and needs to manually fix at most 1 transaction per reporting period (one service).**
>
> We'll know we're **WRONG** if **most money lands in "Untagged", or the treasurer keeps sorting by hand alongside the app, or grouped references are wrong often enough that they stop trusting the totals.**

## 5. Target User & JTBD

**Primary user:** Financial staff of a church or similar organization (treasurer, finance secretary). One shared phone receives the MoMo SMS.

**Job to be done:**
> When the church receives MoMo money through the week, I want it sorted by purpose automatically, so I can report to leadership without reading every SMS.

**Secondary user (later):** An individual tracking their own MoMo money.

**Non-users (agreed draft, validate with real treasurers):**
- Organizations that already receive payments through a gateway or API and get clean data
- iPhone users (the product depends on reading SMS on the phone)
- Organizations that want online card giving

## 6. MVP

**The thinnest line that proves the hypothesis end to end:**

1. The app reads existing and incoming MoMo SMS on the phone.
2. It pulls out amount, sender, date, and reference for each received payment.
3. It sorts payments into groups by reference (offering, harvest, thanksgiving, welfare, and so on).
4. It **suggests** merges of similar references (for example "Thanksgiving" and "Thanks giving"). The treasurer **confirms** each merge. Nothing merges silently.
5. Anything without a usable reference goes to an **Untagged** list, where one tap assigns a group.
6. The treasurer sees totals per group for a chosen period.
7. The treasurer exports the result to **Excel** and **PDF**. Staff choose which fields appear. Hiding member names and phone numbers is an **option**, not the default.

**Not in the MVP:** personal budgeting, spending categories, fee warnings, charts, multiple users or accounts, cloud sync.

**Door check:**
- Reading and parsing SMS across networks is a **one-way door** (everything depends on it). It should be proven first with real samples.
- Group names, screens, and export layout are **two-way doors**. Build and adjust freely.

## 7. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Manual fix rate | At most 1 manual change per reporting period (per service) | Count of edited or assigned transactions per service, over one month of real use. Strict target, revisit after testing against real SMS. |
| Real-world adoption | At least 1 organization uses it for a full month with real money | Pilot with a treasurer, check-in at week 2 and week 4 |
| Reporting outcome | At least 1 export delivered to leadership | Treasurer confirms |
| Time saved | Self-reported sorting time drops noticeably versus before | Before and after question to the treasurer (baseline TBD) |
| Trust | Treasurer reports totals match their own count | Spot check of one week against their manual count |
| Untagged share | Under 10% of received money left untagged | Share of amount and count in Untagged |

## 8. Non-goals

- Not a payment app. It never sends, requests, or moves money.
- Not a replacement for full accounting software.
- Not a way to collect money online.
- No cloud upload of messages in the first release.
- No iPhone version in the first release.
- No multi-user permissions or approvals in the first release.
- No silent auto-merging of references.

## 9. Open Questions

**Resolved**
- [x] Fix target: at most 1 manual fix per reporting period.
- [x] Reporting cadence: once per service.
- [x] Non-users: as drafted in section 5.
- [x] Privacy: hiding member names and numbers in exports is an option.
- [x] Export fields: staff choose which fields to include.
- [x] One phone is enough for the first release.
- [x] Name: AuCourant (store and domain availability still to check).
- [x] Platform: Android only for now. Implementation language and tools are decided in the architecture doc.

**Still open**
- [ ] The real MTN sample received is a Cash In (deposit) and has **no reference**. Need samples of payments received from another person, and from Telecel and AirtelTigo, to learn where a reference appears, if at all.
- [ ] How often is a reference present, per network, and in what form?
- [ ] Baseline: how long does sorting take a treasurer today?
- [ ] Is 1 manual fix per service realistic once tested on real SMS? Revisit after the parser is proven.
- [ ] Store and domain availability for "AuCourant".
