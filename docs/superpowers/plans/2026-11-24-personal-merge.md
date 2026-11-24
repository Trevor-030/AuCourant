# Personal merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge people and categories in Personal, and pair refunds with the payments they give back so totals stop counting returned money.

**Architecture:** The rules live in one pure TypeScript module (`src/lib/personal-merge.ts`, no React Native, tested under plain Node) that `usePersonalState` calls. People merges are saved as a new list (`person_merge`) that the Java scan also reads, so new messages from a merged number land on the merged person. Refunds are one new payment field, `refundOf`, set by Java for reversals and by hand on screen.

**Tech Stack:** Expo 58 / React Native 0.88 / TypeScript; Java (plain JDK for `sorting/`), Room storage via `StoreModule`.

**Spec:** `docs/superpowers/specs/2026-11-24-personal-merge-design.md`

## Global Constraints

- Every saved list: a `useSaved` line in `store.tsx`, a kind in `store/Kinds.java` (and in `Kinds.WRITABLE`), and a line in `hydrate`.
- A field added to `PTx` in TypeScript is added to `Model.PTx` (`fromJson` and `toJson`) in Java.
- `sorting/` has no Android imports; its checks run with `npm run test:parser`.
- Copy uses *person*, *category*, *money in*, *money out*. Buttons: *Merge with…*, *Separate*, *Merge into…*, *This is a refund of…*, *Not a refund*. Tags: *Refunded*, *Partly refunded, GHS 40.00 back*, *Refund of* {name}, {date}.
- Built-in categories (`builtIn: true`) can be a merge target, never merged away.
- A refund never counts in money in; a refunded payment counts `max(0, amount − refunds)` in money out; fees always count.
- Erase all and the first scan clear `person_merge`; sample data and developer flows never save it.
- Commits only when the founder asks; then one commit per file, conventional messages, pushed to `origin master`. "Commit each file" steps below mean: ready to commit, not committed.

## Review Focus

1. A refund larger than its payment: money out for that payment is 0, never negative (Task 2 test `refund larger than payment`).
2. A refund in another period than its payment: the payment's period still shows the reduced amount (Task 2 test `refund in a later month`).
3. Merging a person into someone they were already merged with, and chains B→A then A→C: new messages from B resolve to C (Task 3 test `chain resolves to last`, Task 5 JDK check).
4. Separating after a later scan added payments from the merged-away number: those go back too (Task 3 test `separate takes later payments`).
5. Deleting the payment a refund points at is impossible today, but a `refundOf` pointing at an id that no longer exists must be ignored, not crash (Task 2 test `refund of a missing payment`).

---

### Task 1: The `refundOf` field

**Files:**
- Modify: `src/lib/personal-data.ts` (`PTx`), `native/android/java/com/aucourant/sorting/Model.java` (`PTx`)
- Test: `native/android/test/com/aucourant/sorting/SortCheck.java` (`model()`)

**Interfaces:**
- Produces: `PTx.refundOf: string | null` (TypeScript, optional in old saved data: read as `null`); `Model.PTx.refundOf` (Java, `str(m, "refundOf")`, written by `toJson`).

- [ ] **Step 1:** In `SortCheck.model()`, add `eq("ptx refundOf round trip", "p:1", Model.PTx.fromJson(map("{...,\"refundOf\":\"p:1\"}")).toJson().get("refundOf"))` using an existing PTx JSON from that method plus the field.
- [ ] **Step 2:** `npm run test:parser`. Expected: that check FAILs (`got <null>`).
- [ ] **Step 3:** Add the field in both places; in `personal-data.ts` seed data set `refundOf: null`, and on the seeded reversal set it to the reversed payment's id (the seed already finds `orig`).
- [ ] **Step 4:** `npm run test:parser`, `npm run test:inbox`, `npx tsc --noEmit`. Expected: all pass except the known `speed` check.
- [ ] **Step 5:** Commit each file.

### Task 2: Totals that know refunds

**Files:**
- Create: `src/lib/personal-merge.ts`, `scripts/test-personal-merge.js`
- Modify: `src/lib/personal.ts` (`totalsOf` moves out, re-exported), `package.json` (`"test:merge": "node scripts/test-personal-merge.js"`), every `totalsOf(` caller (`grep -rn "totalsOf(" src`)

**Interfaces:**
- Produces: `refundsByPayment(all: PTx[]): Map<string, number>` (sum of refund amounts per refunded payment id, ignoring `refundOf` ids not in `all`); `totalsOf(list: PTx[], refunds?: Map<string, number>): Totals` (same `Totals` type, moved here from `personal.ts`); `personal.ts` exposes `refunds` (memo of `refundsByPayment(allPTxs)`) through `useApp()`.

- [ ] **Step 1:** Write `scripts/test-personal-merge.js` in the style of `test-search.js` (transpile on require, `check(name, actual, expected)`). Tests: `refund not money in` (a 40 in with `refundOf` → moneyIn 0); `full refund` (100 out + 100 refund → moneyOut 0); `partial refund` (100 out + 40 → 60); `refund larger than payment` (100 out + 150 → 0); `refund in a later month` (totalsOf over only the out payment, with refunds from all → 60); `fees still count` (fee 1 on the payment stays 1); `refund of a missing payment` (refundOf 'gone' → ignored, moneyIn still excludes it); `no refunds unchanged` (old behaviour).
- [ ] **Step 2:** `node scripts/test-personal-merge.js`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement both functions; `personal.ts` re-exports `totalsOf` and adds `refunds`; every caller passes `refunds`.
- [ ] **Step 4:** `npm run test:merge`, `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5:** Commit each file.

### Task 3: Merging and separating people (pure)

**Files:**
- Modify: `src/lib/personal-merge.ts`, `scripts/test-personal-merge.js`

**Interfaces:**
- Produces:
  - `type PersonMerge = { id: string; fromKey: string; toKey: string; txIds: string[]; nicknameBefore: string | null; date: string }`
  - `type PeopleState = { txs: PTx[]; rules: CategoryRule[]; nicknames: Record<string, string> }`
  - `mergePeople(s: PeopleState, a: { id: string; fromKey: string; toKey: string; keepName: string; date: string }): PeopleState & { record: PersonMerge }`
  - `separatePeople(s: PeopleState, r: PersonMerge): PeopleState`
  - `resolveKey(key: string, merges: PersonMerge[]): string`
- Behaviour from the spec: payments and person rules move to `toKey` (kept person's rule wins on a clash); `keepName` different from the kept person's current name becomes the kept person's nickname; the merged-away nickname moves only if the kept person has none; separate moves back `txIds` plus payments whose `personKeyOf(phone, name)` is `fromKey`, restores `nicknameBefore`, leaves rules.

- [ ] **Step 1:** Add tests: `merge moves payments`, `merge moves rules`, `kept rule wins`, `keep other name becomes nickname`, `nickname moves when kept has none`, `separate restores`, `separate takes later payments` (a payment added after the merge with phone of B goes back to B), `separate restores nickname`, `chain resolves to last` (B→A, A→C: `resolveKey('B') === 'C'`), `resolve unknown key unchanged`.
- [ ] **Step 2:** `npm run test:merge`. Expected: the new tests FAIL (functions missing).
- [ ] **Step 3:** Implement. `resolveKey` follows records newest first and stops on a loop.
- [ ] **Step 4:** `npm run test:merge`. Expected: all pass.
- [ ] **Step 5:** Commit each file.

### Task 4: Merging categories (pure)

**Files:**
- Modify: `src/lib/personal-merge.ts`, `scripts/test-personal-merge.js`

**Interfaces:**
- Produces: `mergeCategories(s: { txs: PTx[]; rules: CategoryRule[]; categories: Category[] }, fromId: string, toId: string): typeof s | null` (null when `fromId` is built-in, missing, or equals `toId`).

- [ ] **Step 1:** Tests: `payments move, catSource kept`, `rules move`, `category removed`, `built-in cannot be merged away` (null), `same category` (null).
- [ ] **Step 2:** `npm run test:merge`. Expected: new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run test:merge`. Expected: all pass.
- [ ] **Step 5:** Commit each file.

### Task 5: Java scan follows merges and links reversals

**Files:**
- Create: `native/android/java/com/aucourant/sorting/PersonMerges.java`
- Modify: `sorting/PersonalReader.java` (`refundOf` on reversals), `store/Kinds.java` (`PERSON_MERGES = "person_merge"`, in `WRITABLE`), `store/Scanner.java` (read merges, map keys before `Categoriser.categoriseAll`, add to `FIRST_SCAN_CLEARS`)
- Test: `native/android/test/com/aucourant/sorting/SortCheck.java`

**Interfaces:**
- Consumes: the `PersonMerge` JSON shape from Task 3 (`fromKey`, `toKey`, `date`).
- Produces: `PersonMerges.resolve(String key, List<Map<String, Object>> merges): String` (same rule as `resolveKey`); `PersonalReader` sets `t.refundOf = original.id` when a reversal finds its payment.

- [ ] **Step 1:** SortCheck tests: `merge resolves`, `merge chain resolves to last`, `unknown key unchanged`, `reversal links refundOf` (two rows through `PersonalReader.toPersonalTxs`: a sent payment and its reversal quoting its txId; the reversal's `refundOf` equals the sent payment's id).
- [ ] **Step 2:** `npm run test:parser`. Expected: the new checks FAIL or do not compile; add a stub `resolve` returning `key` first so they FAIL.
- [ ] **Step 3:** Implement; in `Scanner`, after `toPersonalTxs`, set each added payment's `personKey = PersonMerges.resolve(...)` before categorising.
- [ ] **Step 4:** `npm run test:parser`, `npm run test:inbox`; copy `native/android/java` into `android/app/src/main/java` and run `./gradlew :app:compileDebugJavaWithJavac` in `android/`. Expected: pass (except `speed`), compile OK.
- [ ] **Step 5:** Commit each file.

### Task 6: State, saving and loading

**Files:**
- Modify: `src/lib/personal.ts` (state `personMerges`, actions), `src/lib/store.tsx` (`useSaved('person_merge', …, true)`, `hydrate`, first-scan `markSaved` list, `resetPersonal`)

**Interfaces:**
- Consumes: Tasks 2–4 functions.
- Produces on `useApp()`: `personMerges: PersonMerge[]`; `mergePerson(fromKey: string, toKey: string, keepName: string): void` (snackbar with Undo); `separatePerson(recordId: string): void`; `mergeCategory(fromId: string, toId: string): void` (snackbar with Undo restoring a snapshot, as `restore` does); `setRefundOf(txId: string, refundOf: string | null): void`; `refunds: Map<string, number>`.

- [ ] **Step 1:** Wire state and actions; `hydratePersonal` takes `personMerges`; the first-scan reset and `resetPersonal` set `[]`; `person_merge` joins the kinds in `hydrate`'s `markSaved` loop and the first-scan cleared list.
- [ ] **Step 2:** `npx tsc --noEmit` and all `npm run test:*`. Expected: pass (except `speed`).
- [ ] **Step 3:** Commit each file.

### Task 7: Screens

**Files:**
- Modify: `src/screens/personal/person.tsx` (*Merge with…* sheet: pick a person with search, then pick the name to keep; *Merged numbers* list with *Separate*), `src/screens/personal/categories.tsx` (`ManageCategories`: *Merge into…* on non-built-in categories), `src/screens/personal/transactions.tsx` (`PersonalTxDetail`: refund tags, *This is a refund of…* on money in that is not a reversal, *Not a refund* when linked), `src/screens/personal/shared.tsx` (`PTxRow`: *Refunded* / *Refund* tag)

**Interfaces:**
- Consumes: Task 6 `useApp()` additions.

- [ ] **Step 1:** Build the person page actions; the picker lists money-out payments to the same person first, then all money out, newest first.
- [ ] **Step 2:** `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 3:** Build a debug APK and check on the phone: merge two people, undo; merge two categories, undo; link a refund by hand, unlink; totals on Home change as the spec says.
- [ ] **Step 4:** Commit each file.

### Task 8: Docs

**Files:**
- Modify: `AGENTS.md` (`test:merge` command, `person_merge` saved list, `personal-merge.ts` in the layout), `docs/architecture-personal.md` (merges and refunds), `docs/superpowers/specs/2026-11-24-personal-merge-design.md` (status: built)

- [ ] **Step 1:** Update the three files.
- [ ] **Step 2:** Commit each file.
