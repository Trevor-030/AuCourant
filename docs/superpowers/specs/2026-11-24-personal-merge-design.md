# Personal merge: people, categories and refunds

Date: 2026-11-24. Approved by the founder in conversation the same day. Status: built 2026-11-24 (plan `docs/superpowers/plans/2026-11-24-personal-merge.md`).

## Why

The founder ran the Personal use type on their own phone (2026-11-24) and asked for three merges that Church has in its own form and Personal lacks:

- **People.** A person is one phone number, or one name when there is no number (`personKeyOf` in `personal-data.ts`, `Text.personKeyOf` in Java). The same friend with two numbers, or a name spelled two ways, shows as two people, so their totals are split.
- **Categories.** Categories can be added, renamed, hidden and reordered, not combined. Two categories that mean the same thing stay two.
- **Refunds.** An MTN reversal already knows which payment it undoes (`PersonalReader` takes the person from the reversed payment), but both still count: the payment in *money out*, the reversal in *money in*. Both totals are too high. Money returned another way (a friend sending it back) has no link at all.

Success: one person per real person, one category per real meaning, and totals that do not count money that came back.

## Goals

1. Merge two people into one, choosing which name to keep. New messages from either number land on the merged person. Undo from the person's page.
2. Merge one category into another: its payments and rules move, the category goes. Undo right after.
3. Pair a refund with the payment it gives back: automatically for MTN reversals, by hand for any money received. A refund never counts as money in; the payment it refunds counts only what was not given back.

## Non-goals

- Church merging is unchanged.
- No automatic suggestions of people or categories to merge (Church has suggestions; Personal can get them later).
- No merging of payments themselves (two payments stay two).
- Payments scanned before this change are not re-linked: saved reversals have no link. After the update the founder erases and scans again (also needed for full names), which links them.

## Anti-goals

- A merge that cannot be undone, or that loses a nickname or rule silently.
- New messages from a merged number splitting off into a separate person again.
- Totals where a refund is counted twice or a payment goes below zero.

## Constraints

- Every saved list goes through `useSaved` (`store.tsx`) and has a kind in `store/Kinds.java` and a line in `hydrate` (AGENTS.md).
- A field added to `PTx` in TypeScript must be added to `Model.PTx` in Java, or a scan drops it (AGENTS.md).
- `sorting/` stays free of Android imports and is checked with only the JDK.
- The live receiver can save payments with the app closed (`StoreModule.messageArrived`), so anything that must apply to new messages has to happen in Java, not only on screen.
- Copy follows the PRD wording: *money in*, *money out*, *category*, *person*.

## Approaches considered

**People**
- **A. Rewrite the payments and remember the link (chosen).** On merge, the payments of person B get person A's key, and a saved record "B belongs to A" lets the Java scan give new payments from B the key A too. Rules, filters and totals work unchanged because every payment carries the merged key. Undo uses the record's list of moved payments.
- B. Leave payments alone and map keys when showing them. Every place that groups by `personKey` (people list, person page, filters, totals, rules, export) would need the map; easy to miss one.
- C. Rewrite payments only, no record. New messages from number B would split off again (an anti-goal).

**Categories**
- **Rewrite payments and rules, delete the category, undo from a snapshot (chosen).** The categoriser already stores the category on each payment and in each rule; there is nothing to map.
- A saved "A means B" record was rejected: it would only add a lookup to every place that reads a category, for no gain.

**Refunds**
- **A field on the refund payment, `refundOf` (chosen).** The refund points at the payment it gives back. Java sets it for reversals; the screens set it by hand. Totals read it.
- A separate saved list of pairs was rejected: the link belongs to one payment and must survive a scan the same way the payment does.

## Design

### People

- **Saved record** (new kind `person_merge`): `{ id, fromKey, toKey, txIds, nicknameBefore, date }`. `id` is the record id; `txIds` are the payments moved at merge time; `nicknameBefore` is the kept person's nickname before the merge (for undo).
- **Merge** (person page, *Merge with…*, pick a person from the people list, then pick which name to keep):
  - every payment with `personKey === fromKey` gets `toKey`;
  - person rules (`kind: 'person'`, `value === fromKey`) get `value: toKey`; if the kept person already has a rule, the kept person's rule wins and the other is removed;
  - the chosen name: if it is the merged-away person's name, it is saved as the kept person's nickname; an existing nickname on the merged-away person moves only when the kept person has none;
  - a record is saved; a snackbar confirms with Undo.
- **New messages:** the Java scan reads every `person_merge` record and, for each new payment whose key is a `fromKey`, sets `toKey` before categorising. Chains (B into A, then A into C) resolve to the last key.
- **Undo** (person page, *Merged numbers* list, *Separate*): the payments in `txIds` plus any later payment whose own number or name gives `fromKey` (`personKeyOf(phone, name)`) go back to `fromKey`; rules moved by the merge are not split back (the founder sets them again if needed); `nicknameBefore` is restored; the record is deleted.
- Reversals take the person of the payment they undo; after a merge that is the merged person, which is right.

### Categories

- **Merge** (Categories screen, a category's menu, *Merge into…*, pick another category): every payment and rule with that category moves to the target; the category is deleted; the payments' `catSource` is kept.
- Built-in categories (`builtIn: true`) can be a target but not merged away: the scan puts payments into them by type (`TYPE_CATEGORY`).
- **Undo:** snackbar, restoring the payments, rules and category from a snapshot (as `restore` does today). No saved history: once the snackbar is gone the merge stays.

### Refunds

- **Field:** `PTx.refundOf: string | null`, the id of the payment this one gives back. Saved with the payment; added to `Model.PTx` in Java.
- **Automatic:** `PersonalReader` sets `refundOf` on a reversal when it finds the reversed payment (it already looks it up by transaction ID for the person).
- **By hand:** on a payment with `direction: 'in'` that is not a reversal, *This is a refund of…* opens a list of money-out payments to the same person first, then all money out, newest first; picking one sets `refundOf`. *Not a refund* clears it. A reversal's automatic link can also be cleared.
- **Totals** (`totalsOf` and every total built on it: home, categories, category page, exports): a payment with `refundOf` never counts in *money in*. A payment that has refunds counts `max(0, amount − sum of its refunds)` in *money out*, whatever period the refunds fall in. Fees still count (a reversal does not return the fee).
- **Shown:** the refunded payment shows *Refunded* or *Partly refunded, GHS 40.00 back*; the refund shows *Refund of* and the other payment's name and date, and opens it on tap.

## Decided by the builder (my calls, open to change)

- Exact wording of buttons and snackbars, within the PRD terms.
- Where *Merge with…* and *Merge into…* sit in each screen's existing menus.
- How the person picker searches (reuse `pTxMatches` style matching on name, nickname, phone).
- Test layout: pure logic (merge, undo, refund totals) in a module free of React Native so it runs under plain Node, like `persist.ts`.
- Refund amounts are looked up across all payments, not only the list being totalled, so a refund in a later period still reduces the payment it belongs to.
- *Erase all* and the first scan clear the `person_merge` records, as they clear nicknames and rules today. Sample data and the developer flows never save them.

## Checks

- Plain Node tests for merging and undoing people, merging categories, and refund totals (full, partial, refund in another period, refund larger than the payment).
- JDK checks: the scan maps a `fromKey` to its `toKey` (including a chain) and links a reversal with `refundOf`.
- On the phone: merge two people, receive a message from the merged-away number, check it lands on the merged person; undo; merge two categories and undo; a reversal shows as *Refunded* and leaves the totals.
