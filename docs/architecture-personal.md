# Architecture: AuCourant Personal use

> High-level decision doc, version 2 (open questions answered). Covers the **Personal** use type (also small businesses). The church and organisation design lives in `architecture.md` and still applies to everything shared. Intent lives in `aucourant.prd.md`. Visual design will go in `figma-brief.md` after the decisions below are agreed.
> Same founder constraints: **Java**, **Android only**, **free resources only**, **everything on the phone**, **direct APK install**.

## Problem & goals

A person (or a small shop owner) gets a MoMo SMS for every payment they make or receive. The messages pile up, they are hard to search, and it is hard to answer simple questions: *Where did my money go this month? Who paid me today? How much did I pay in fees?*

AuCourant Personal reads the same SMS, sorts the money in and out, and shows it in a way that is easy to look through. Goals, in order:
1. **Easy to look through:** find any payment fast (by person, amount, word, date).
2. **Clear picture of a period:** totals only: money in, money out, fees paid, and spending by category. No balance.
3. **Almost no manual work:** most payments are put in a category automatically, and the user only decides the odd ones. **Success target: 0 payments left Uncategorised** when the user reviews a period.
4. **Same promises as before:** free, private, nothing leaves the phone.

Small business reading: money in is sales, the same people who pay again and again are customers, and "Today" is the end-of-day total. No separate mode is needed for this (see decisions).

## Approaches considered

**A. Same app, same data, a second set of views (recommended).**
The intake, parser, database, lock, export and themes are shared. Personal adds money direction, categories, people and period views on top. One APK, one codebase, one signing key.

**B. A separate personal app.**
Cleaner screens, but the parser, storage and lock are built twice and fixed twice. Two APKs to sign and share. Rejected: the founder asked for a choice inside one app.

**C. Connect to a bank or MoMo account service for clean data.**
Needs the internet, accounts and often fees, and breaks the "nothing leaves the phone" promise. Rejected.

**Why A:** the hard part (reading SMS into clean transactions) is already needed for churches. Personal is mostly new views and a categoriser on data the app already stores.

## Recommended approach

Shared with the church design (no change): SMS intake, parser registry, Room database, app lock and recovery code, themes, export (CSV and PDF), fonts and colours.

New for Personal, all on the phone:

1. **Wider parser:** more MTN message types are needed. Church use only needs "payment received". Personal needs sent money, payments to a merchant or bill, cash in, cash out, airtime and data, fees and reversals. One new parser class per type, same registry. Unknown messages still go to *Not read*, never dropped.
2. **Money direction:** every transaction is marked **in** or **out** from its type (received and cash in are in, the rest are out). Fees are stored on the transaction and also shown as their own total.
3. **Categoriser:** puts each payment in a category by simple rules (below). Explainable, no machine learning, works offline.
4. **People:** payments are summed per counterparty (the other side), by phone number. The user can give a person a nickname.
5. **Periods:** the church's *service* is replaced by a **period**: Today, This week, This month, Last month, or custom dates. No weekly service and no special sessions in Personal.
6. **Search:** fast search across name, number, amount, reference and the original message, using SQLite full-text search (free, built into Android).
7. **Personal views and navigation** (below).

### The categoriser

Rules are checked in this order and the first match wins:
1. **Person rule:** a counterparty number the user has put in a category (for example Kofi Boateng is Family).
2. **Word rule:** a word in the reference or merchant name the user has put in a category.
3. **Built-in type rule:** airtime and data purchases go to *Airtime and data*, bill payments to *Bills*, cash out to *Cash withdrawals*, fees to *Fees*.
4. Anything else is **Uncategorised**.

Default categories (the user can rename, add and hide): Food, Transport, Airtime and data, Bills, Family and friends, Savings, Business, Cash withdrawals, Fees, Other.

Learning is **suggest and confirm**, like merges. When the user puts a payment in a category, the app shows a message at the bottom: *Moved to Family. Also move 6 other payments to Kofi Boateng? Move them / Only this one*. A rule is only created if the user taps *Move them*, and future payments from that person then land in the category at once. Every change can be undone. The app never silently learns what a person means.

### Views (shape only)

Navigation is four tabs: **Home, Transactions, Categories, Export.** Settings is a gear on Home, same as church.

- **Home:** period selector, then *Money in*, *Money out* and *Fees paid*. Totals only, no balance. Then spending by category as simple bars (drawn by the app, no chart library). Then a *Needs attention* card: payments to categorise and messages not read.
- **Transactions:** the searchable list. Date headers with day totals, filters (In, Out, a category, a person), search box, a tap opens the detail with the original message. This is the "easier to look through" screen.
- **Transaction detail:** amount, person, category (tappable), fee, reference, and a collapsed *More details* with the balance after that payment and the original message. A link *See all with this person*.
- **Person view:** reached from a transaction. Total in, total out, count, nickname, and the list. For a shop this is the customer view.
- **Categories:** each category with its spending in the period, a tap shows its payments. Manage categories and rules here.
- **Export:** same screen as church, with the period instead of the service. CSV and PDF, choose fields, hide names option.

**Small business:** Home with the period set to *Today* is the daily total. *Money in* is sales. A person with many payments in is a repeat customer. There is no extra mode.

## Key decisions

**Stack:** unchanged from `architecture.md`, plus SQLite full-text search through Room (free, no dependency).

**Data model changes (shape only)**

- **Transaction** gets: direction (in or out), category (nullable), counterparty key, how the category was set (built-in rule, person rule, word rule, manual, undo). Existing fields (type, amount, fee, balance, raw SMS, parse status) already cover most of this.
- **Category:** name, whether built in, hidden or not, order.
- **CategoryRule:** kind (person or word), the number or word, category, created when the user taps *Move them*.
- **Counterparty:** normalized phone number, last seen name, nickname (optional).
- **Settings:** the use type (already there) decides which views show. Last selected period is remembered.
- **Group and references stay for church and organisation.** In Personal a reference is shown as a note on the payment and is searchable. It does not make groups. Both fields live on the same transaction, so switching the use type later loses nothing.

**Switching the use type later:** wording and screens change at once. Categories are worked out the first time Personal is opened (a quick local pass over the stored payments). Church groups and codes stay as they were.

**Boundaries & contracts**

- **No new permissions.** The contacts permission is **not** requested. Names come from the SMS and the user can type a nickname. This keeps "SMS only, no internet" as the trust message.
- **Privacy:** personal money is more private than a church's. Same rules: no network, no cloud, backups off, lock optional but suggested at setup, recovery code as before. Same lock as church: the user chooses a 4-digit PIN, 6-digit PIN or password, with optional fingerprint and a recovery code. Users set the lock up themselves, and setup can be done later. No database encryption in version 1 (founder decision, same as church).
- **No balance on Home.** Home shows totals only. The balance written in each SMS is still stored and appears only under *More details* on a payment, as the balance after that payment. The app never calculates a balance itself.
- **No budgets, no fee warnings, no line charts in version 1.** The data supports them (fees and category totals are stored), so they can be added without changing the database.
- **Other networks:** many personal users are on Telecel or AirtelTigo. They use the MTN template for now (founder decision), so expect more messages in *Not read* for them until real samples exist.
- **Parser is the one-way door again.** Directions and categories all depend on reading each type correctly. Wrong type means wrong direction and wrong totals, so the raw SMS stays next to every parsed field.

## Missing pieces

- **Real samples of every MTN message type** (sent, merchant and bill payment, cash out, airtime and data, reversal, failed). Only cash in, payment sent and payment received exist today. The founder's own inbox is the quickest source, with names and numbers hidden.
- A **PRD hypothesis for Personal.** The current PRD is built around the church treasurer. Personal needs its own problem, success target and non-goals before the Figma work.
- Telecel and AirtelTigo samples.

## Spikes & experiments

**Spike 1: How many message types does one real inbox have?**
```
Question:      Which MTN message types appear in a personal inbox, and how many parse today?
Spike:         Export the founder's own inbox (names and numbers hidden), count types, write the parser classes for the common ones, over 1 to 2 days
Decision rule: support every type that makes up most of the messages; send the rest to Not read and add them as samples arrive
```

**Spike 2: Do the category rules work?**
```
Question:      How much of a real month is categorised without the user doing anything?
Spike:         Run the rules over the same inbox and count Uncategorised, over half a day
Decision rule: keep suggest-and-confirm in every case; if most money out is Uncategorised, add smarter built-in word rules before building the learning flow
```

**Spike 3: Search speed on a cheap phone**
```
Question:      Is full-text search fast with 5,000 to 10,000 messages on a low-cost phone?
Spike:         Load a test database and time searches on 2 to 3 real phones, half a day
Decision rule: keep SQLite full-text search if results show in under half a second; otherwise search fewer fields
```

**Spike 4: Other networks**
```
Question:      Does the MTN template read Telecel and AirtelTigo messages at all?
Spike:         Try it on a few real messages from friends (names and numbers hidden), half a day
Decision rule: if most fail, add one parser class per network before promising Personal on them
```

## Decided in this round

- **First-run card says "Personal or business"** (Claude's pick, founder asked for a suggestion). One card, one use type for now. A separate Business card with its own words (sales, customers) can come later if shop owners need it.
- **Success target: 0 payments left Uncategorised** when the user reviews a period (founder). Note: this means 0 left over after the user's own review, not 0 without any user action. New people will always need one decision. The share categorised automatically is measured in the first month as a baseline, with no target yet.
- **Home shows totals only** (money in, money out, fees paid). No balance on Home.
- **Same lock as church:** PIN or password chosen by the user, optional fingerprint, recovery code, no database encryption in version 1.
- **Same app, same data, new views.** Personal is a use type, not a separate app.
- **Personal also serves small businesses** with no separate mode: the Today period is the daily total, money in is sales, repeat payers are customers.
- **Four tabs:** Home, Transactions, Categories, Export. Periods replace services. No weekly service or special sessions in Personal.
- **Easier to look through** means full-text search plus filters (in, out, category, person).
- **Categories by simple rules, learned only when the user confirms.** No machine learning.
- **No contacts permission.** Nicknames are typed by the user.
- **No budgets, fee warnings or line charts in version 1.** Fees and category totals are shown from day one.
- Church groups and codes are kept when switching use type.

## Open questions

- Personal needs its own PRD hypothesis and non-goals (see Missing pieces) before the Figma work.
