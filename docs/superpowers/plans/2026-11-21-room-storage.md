# Room Storage and Java Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AuCourant's data, settings and lock survive a restart. Reading, sorting and categorising new messages runs in Java.

**Architecture:**
- **`com.aucourant.sorting`** is a plain-Java port of the TypeScript sorter, with no Android imports. It is checked with the JDK through `SortDump` and the existing `scripts/test-inbox.js` checks.
- **`com.aucourant.store`** holds the Room tables. `StoreModule` exposes them to React Native as JSON strings.
- **TypeScript keeps every edit.** A small persistence layer diffs each saved list against what was last written and queues the changes to Room in order. Scans wait for that queue to empty.

**Tech Stack:**
- Java 17 (Android Studio JBR), Room with `annotationProcessor`.
- Expo SDK 58 with React Native 0.88 and TypeScript.
- Plain-JDK checks driven by Node.

**Spec:** `docs/superpowers/specs/2026-11-21-room-storage-design.md`

## Global Constraints

- Java only for native code: no Kotlin, KSP or kapt. Room's compiler runs through `annotationProcessor`.
- `com.aucourant.sorting` and `com.aucourant.parser` import nothing from `android.*`, `androidx.*` or `com.facebook.*`.
- Never edit `android/` by hand. Gradle changes go through `plugins/with-aucourant-native.js`, then `npx expo prebuild --platform android --no-install`.
- The build is 64-bit only (`reactNativeArchitectures=arm64-v8a`). Keep the line the plugin already writes.
- Room database version 1, with no migrations.
- A scan is saved in one Room transaction. The transaction ID stays the unique key: `t:<txId>`, `r:<txId>` for reversals, `s:<smsId>` when there is no ID.
- The secret and the recovery code are never stored or returned in plain text. They are stored as PBKDF2 via `LockModule`'s parameters (`PBKDF2WithHmacSHA256`, 120000 iterations, 256 bits, 16-byte salt).
- Sample data, Developer flows and Expo Go stay in memory and are never written.
- Copy follows the PRD wording. New copy: save failure *"Couldn't save. Try again."*
- Run Gradle with `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` and `-Dorg.gradle.internal.http.socketTimeout=300000 -Dorg.gradle.internal.http.connectionTimeout=300000`.
- Commit one file per commit with a Conventional Commit message, and push only when the founder asks.

## Review Focus

1. **The app is killed in the middle of the first scan.** On the next launch there is no partial data and no payment appears twice. *Test in Task 5 (transaction) and on the phone checklist (Task 9).*
2. **An edit lands while a 20-second check is running.** The edit is kept and the new payment is added. Applying the scan result never puts back an older version of a row the user changed. *Test in Task 7 (`mergeScan` keeps local rows).*
3. **A large inbox (5,000 messages).** The first scan shows progress, the UI stays responsive, and launch `load()` takes under 2 s on the phone. *Covered by the Task 9 checklist, with timings logged by `StoreNative`.*
4. **Erase all, then scan again.** Nothing old comes back, because the record of message IDs already read is cleared too. *Test in Task 5 (`eraseAll` clears `seen_sms`).*
5. **Expo Go, or a build without `AuCourantStore`.** The app runs on sample data without crashing. *Test in Task 7 (`persistEnabled()` false: no native calls).*

---

## File map

| File | Responsibility |
|---|---|
| `native/android/java/com/aucourant/sorting/Json.java` | Minimal JSON read and write (Map, List, String, Double, Boolean, null). Shared by `SortDump` and the bridge. |
| `.../sorting/Model.java` | Plain classes mirroring the TS types: `Tx`, `Group`, `Merge`, `Suggestion`, `Unread`, `PTx`, `CategoryRule`, `Row` (sms plus parsed), `ChurchData`. Each has `fromJson` and `toJson` with the TS field names. |
| `.../sorting/Text.java` | `matchKey`, `similarNames`, `titleCase`, `formatPhone`, `stamp`, `rowKey`, `ordered`, `newestFirst` |
| `.../sorting/ChurchSorter.java` | `emptyChurch`, `addChurchRows`, `unreadOf` |
| `.../sorting/PersonalReader.java` | `toPersonalTxs` |
| `.../sorting/Categoriser.java` | `categorise`, `categoriseAll` |
| `native/android/test/com/aucourant/sorting/SortDump.java` | CLI: `SortDump <church\|personal\|categorise> <in.json>`. Prints result JSON. |
| `native/android/test/com/aucourant/sorting/SortCheck.java` | Plain-JDK checks for `Text` and `Json` |
| `scripts/java-sorter.js` | Node wrapper with the same signatures as the TS functions. Spawns `SortDump`. |
| `.../store/*.java` | Room entities, DAOs, `AuCourantDatabase`, `Scanner` (read, parse, sort, write in one transaction) |
| `.../nativebridge/StoreModule.java` | Bridge: `load`, `scan`, `save`, `saveSettings`, `eraseAll`, lock calls |
| `src/native/store.ts` | Typed `StoreNative` wrapper and the progress event |
| `src/lib/persist.ts` | Save queue, `usePersisted` diff hook, `markSaved`, `flushSaves`, `mergeScan` |

---

### Task 0: Baseline build on the phone

**Files:** none (verification only).

- [ ] **Step 1:** The background `assembleDebug` started on 2026-11-21 has finished. Expected: `BUILD SUCCESSFUL`. If it failed, fix the cause first: timeouts mean rerun, disk space means stop and ask. Delete `C:\Users\micha\Documents\Projects\build-log.txt`.
- [ ] **Step 2:** With the phone on USB and USB debugging on, `adb devices` lists it.
- [ ] **Step 3:** `npx expo run:android --device`. Expected: the app opens on the welcome screen, and the scan reads real messages.
- [ ] **Step 4:** Note the scan time and message count in `docs/architecture.md` under *Choices made while wiring real messages*. Commit.

### Task 1: Java model, JSON and text helpers

**Files:**
- Create: `sorting/Json.java`, `sorting/Model.java`, `sorting/Text.java`, `test/.../sorting/SortCheck.java`
- Modify: `scripts/test-parser.js` (also compile `sorting/`, and run `com.aucourant.sorting.SortCheck` after `ParserCheck`)

**Interfaces:**
- Produces:
  - `Json.parse(String): Object` and `Json.write(Object): String`. Objects are `LinkedHashMap<String,Object>`, arrays are `ArrayList<Object>`, numbers are `Double`.
  - `Model.X.fromJson(Map)` and `Model.X.toJson(): Map` for each class. Absent optional fields (`hidden`, `system`, `code`, `builtIn`, `createdGroupId`) are left out of the output, never written as `false` or `null`, so the output equals the TS objects in a JSON comparison.
  - `Text.matchKey(String)`, `Text.similarNames(String,String)`, `Text.titleCase(String)`, `Text.formatPhone(String)`, `Text.stamp(long millis): String[]{date,time}` (local zone), `Text.rowKey(Row)`, `Text.ordered(List<Row>)`, `Text.newestFirst(List<T extends Dated>)`.

- [ ] **Step 1: Write `SortCheck`** with the same cases as the helper block of `scripts/test-inbox.js` (lines 77 to 88). Examples:

```java
eq("titleCase hyphen", Text.titleCase("NANA OFORIWAA-BOATEMAA"), "Nana Oforiwaa-Boatemaa");
eq("formatPhone 233", Text.formatPhone("233241234567"), "024 123 4567");
eq("matchKey spaces", Text.matchKey("  Building   fund "), "building fund");
eq("similar spelling", Text.similarNames("Harvest", "Havest"), true);
eq("short words are not suggested", Text.similarNames("Dues", "Due"), false);
eq("json round trip", Json.write(Json.parse("{\"a\":[1.5,null,true,\"x\\\"y\"]}")), "{\"a\":[1.5,null,true,\"x\\\"y\"]}");
```

- [ ] **Step 2:** `npm run test:parser`. Expected: compile errors (classes missing).
- [ ] **Step 3:** Implement. `matchKey` uses the same character class as `inbox.ts:79`. `similarNames` uses Levenshtein with `SUGGEST_AT = 0.8` and a 4-letter minimum. `Json.write` prints whole doubles as `20` and others as `20.5`, matching `JSON.stringify`.
- [ ] **Step 4:** `npm run test:parser`. Expected: `0 failed`.
- [ ] **Step 5:** Commit each file.

### Task 2: ChurchSorter in Java, checked by the existing inbox checks

**Files:**
- Create: `sorting/ChurchSorter.java`, `test/.../sorting/SortDump.java`, `scripts/java-sorter.js`
- Modify: `scripts/test-inbox.js` (take `addChurchRows` and `emptyChurch` from `java-sorter.js`, and compile `sorting/` as well)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `ChurchSorter.emptyChurch(List<CodeName>): ChurchData`
  - `ChurchSorter.addChurchRows(ChurchData prev, List<Row> rows, boolean builtInPairs): ChurchData` (with an `added` count)
  - `ChurchSorter.unreadOf(List<Row>): List<Unread>`
  - `ChurchSorter.NO_REFERENCE = "noref"`
  - `java-sorter.js` exports `addChurchRows(prev, rows, { builtInPairs })`, `emptyChurch(codeNames)`, `toPersonalTxs(rows, known)`, `categoriseAll(list, rules)`. Each writes `{ op, ...args }` to a temp file and runs `java -cp <tmp> com.aucourant.sorting.SortDump`.

- [ ] **Step 1:** In `test-inbox.js`, import `addChurchRows` and `emptyChurch` from `./java-sorter` in place of `lib('inbox')`. No check changes.
- [ ] **Step 2:** `npm run test:inbox`. Expected: FAIL (SortDump missing).
- [ ] **Step 3:** Port `addChurchRows` line for line from `src/lib/inbox.ts:166-270`: group lookup by `g:<key>`, built-in pairs `offertory→Offering` and `tithes→Tithe` when `builtInPairs`, codes, `settle` through hidden groups (at most 10 hops), suggestions for new groups only, and *Not read* newest first. Church types are `RECEIVED` and `CASH_IN`.
- [ ] **Step 4:** `npm run test:inbox`. Expected: every church, rescan, cash in, merged, renamed, organisation and doubtful-code check passes (same names as today).
- [ ] **Step 5:** Commit each file.

### Task 3: PersonalReader and Categoriser in Java

**Files:**
- Create: `sorting/PersonalReader.java`, `sorting/Categoriser.java`
- Modify: `SortDump.java`, `scripts/test-inbox.js`

**Interfaces:**
- Produces:
  - `PersonalReader.toPersonalTxs(List<Row> rows, List<PTx> known): List<PTx>`
  - `Categoriser.categorise(PTx, List<CategoryRule>)` returning `{categoryId, source}`
  - `Categoriser.categoriseAll(List<PTx>, List<CategoryRule>): List<PTx>`
  - `TYPE_CATEGORY` copied from `src/lib/personal-data.ts`

- [ ] **Step 1:** Switch `toPersonalTxs` and `categoriseAll` in `test-inbox.js` to `java-sorter.js`. Add a check that runs both categorisers over the same input:

```js
check('categoriser: Java and TypeScript agree', require('./java-sorter').categoriseAll(seedPersonalTxs(), SEED_RULES), lib('categorise').categoriseAll(seedPersonalTxs(), SEED_RULES))
```

- [ ] **Step 2:** `npm run test:inbox`. Expected: FAIL.
- [ ] **Step 3:** Port `toPersonalTxs` from `inbox.ts:285-343`:
  - airtime is one person `m:airtime`, named *Data bundle* when the SMS says "data bundle";
  - merchant and bill use `personKeyOf(null, name)`;
  - a reversal takes its person from `known` or an earlier row;
  - a cash in with only a number takes a known name.
  
  Port `personKeyOf` from `personal-data.ts` into `Text`.
- [ ] **Step 4:** `npm run test:inbox`. Expected: `0 failed`.
- [ ] **Step 5:** Commit each file.

### Task 4: Room tables and Gradle

**Files:**
- Modify: `plugins/with-aucourant-native.js` (add `withAppBuildGradle`: `implementation "androidx.room:room-runtime:<v>"` and `annotationProcessor "androidx.room:room-compiler:<v>"`)
- Create in `com/aucourant/store/`: `Entities.java`, `Dao.java`, `AuCourantDatabase.java`, `Converters.java`

**Interfaces:**
- Produces:
  - Tables, all with a text primary key `id` unless noted:
    - `church_tx`: Tx fields, indexed on `groupId` and `date`.
    - `church_group`: `position` int for order.
    - `merge_record`: `txIds` JSON.
    - `suggestion`, `unread`.
    - `code_entry`: `code` primary key, `groupId`.
    - `special`.
    - `personal_tx`: indexed on `date`.
    - `category`: `position`.
    - `category_rule`.
    - `nickname`: `personKey` primary key.
    - `setting`: `key` primary key, `json` value.
    - `seen_sms`: `smsId` primary key.
    - `lock_record`: single row with `id = 1`, holding `type`, `hash`, `salt`, `recoveryHash`, `recoverySalt`, `fingerprint`, `failedTries`, `blockedUntil`.
    - `group_change`: `id`, `txId`, `fromGroupId`, `toGroupId`, `at` (millis), `kind` (`manual`, `confirmed`, `code` or `undo`), and `undoes` (the change it cancels, or null). Indexed on `at`.
  - `Dao` has `upsert` and `deleteByIds` per table, `all<Table>()`, and `clearAll()`.
  - `AuCourantDatabase.get(Context)` is a singleton, file `aucourant.db`, `exportSchema = false`.

- [ ] **Step 1:** Choose the Room version: the newest stable release on `https://dl.google.com/android/maven2/androidx/room/room-runtime/maven-metadata.xml` whose compiler still supports Java `annotationProcessor` and the project's `compileSdk`. Record it in the plugin as `const ROOM = '<v>'`.
- [ ] **Step 2:** Prebuild, then `./gradlew :app:compileDebugJavaWithJavac` (timeouts from Global Constraints). Expected: BUILD SUCCESSFUL. Room generates `AuCourantDatabase_Impl`.
- [ ] **Step 3:** Commit each file.

### Task 5: Scanner and StoreModule

**Files:**
- Create: `store/Scanner.java`, `store/Mapper.java` (entity ↔ `Model`), `nativebridge/StoreModule.java`
- Modify: `nativebridge/AuCourantPackage.java` (register), `nativebridge/SmsModule.java` (pull the inbox read into `static List<RawSms> readInbox(Context, List<String> senders, long since)`)

**Interfaces:**
- Consumes: Tasks 2 to 4.
- Produces: `NativeModules.AuCourantStore` with these calls:
  - `load(): Promise<string>`, returning JSON `{ txs, groups, merges, suggestions, unread, codes, specials, pTxs, categories, rules, nicknames, settings, lock: {type,fingerprint}|null, scan: {dataSource, newestSms} }`
  - `scan(sinceMillis: number, optsJson: string): Promise<string>`. `opts` is `{ useType, firstRunCodes }`. Resolves `{ messages, newPayments, first, changed: { txs, groups, merges, suggestions, unread, codes, pTxs, categories? } }`. It emits `AuCourantScanProgress` events `{read, total}`.
  - `save(changesJson: string): Promise<void>`, taking `[{ table, upsert: [...], remove: [ids] }]`
  - `saveSettings(json: string): Promise<void>`
  - `eraseAll(): Promise<void>`
  - `setLock(type, secret, recovery, fingerprint): Promise<void>`
  - `setFingerprint(boolean): Promise<void>`
  - `setRecovery(code): Promise<void>`
  - `checkLock(secret): Promise<boolean>`
  - `checkRecovery(code): Promise<boolean>`. The code is compared without dashes, upper case.
  - `checkLock` and `checkRecovery` keep a wrong-try count and the time of the last wrong try in `lock_record` (`failedTries`, `blockedUntil`). The 5th wrong try blocks for 30 s, and while blocked they resolve `{ ok: false, waitSeconds }`, so the result is `{ ok: boolean; waitSeconds: number }`.
  - `makeRecoveryCode()` comes from `LockModule`.
  - All work runs on one `Executors.newSingleThreadExecutor()`.

- [ ] **Step 1:** Write `Scanner.scan(db, rows, opts)` to:
  - start from `emptyChurch(firstRunCodes)` and empty Personal data when `dataSource != "messages"`, otherwise load the saved church data and known Personal payments;
  - skip rows already in `seen_sms`;
  - run `addChurchRows` with `builtInPairs = useType != "organisation"`;
  - run `toPersonalTxs` with the saved Personal payments;
  - run `categoriseAll` with the saved rules on the new ones only;
  - write the changes, `seen_sms`, `newestSms` and `dataSource = "messages"` inside one `db.runInTransaction`.
  
  On the first scan it also clears the old church and Personal rows, then writes the default categories (from `DEFAULT_CATEGORIES`).
- [ ] **Step 2:** `eraseAll` runs `db.clearAllTables()`, which also clears `seen_sms` and the settings.
- [ ] **Step 3:** Build and install on the phone. In Settings, Developer, *Parse my inbox* still works.
- [ ] **Step 4:** Commit each file.

### Task 6: TypeScript bridge and persistence layer

**Files:**
- Create: `src/native/store.ts`, `src/lib/persist.ts`
- Test: `scripts/test-persist.js` (Node, loads `persist.ts` through the same `ts.transpileModule` hook as `test-inbox.js`), plus a `test:persist` script in `package.json`

**Interfaces:**
- Produces:
  - `StoreNative.available(): boolean`. False in Expo Go or without `AuCourantStore`.
  - `StoreNative.load()`, `.scan(since, opts, onProgress)`, `.save(changes)`, `.saveSettings(obj)`, `.eraseAll()`, `.setLock(...)`, `.checkLock(s)`, `.checkRecovery(c)`, `.setRecovery(c)`, `.setFingerprint(b)`. JSON is parsed and stringified at this boundary only.
  - `persist.ts`, pure with no React Native imports:
    - `diffRows<T extends {id:string}>(prev: T[], next: T[]): { upsert: T[]; remove: string[] }`, by reference first, then `JSON.stringify`.
    - `createSaveQueue(send: (c: Change[]) => Promise<void>)`, returning `{ push(table, prev, next), markSaved(table, rows), flush(): Promise<void>, failed: boolean }`.
    - `mergeScan<T extends {id:string}>(local: T[], changed: T[], touchedLocally: Set<string>): T[]`.

- [ ] **Step 1:** Write `test-persist.js` checks:

```js
check('diff: unchanged object is not saved', diffRows([a], [a]).upsert.length, 0)
check('diff: edited row is saved', diffRows([a], [{ ...a, groupId: 'g2' }]).upsert.map((r) => r.id), ['t:1'])
check('diff: removed row', diffRows([a, b], [a]).remove, ['t:2'])
check('queue: sends in order', sentTables, ['church_tx', 'church_group'])
check('queue: flush waits for the last send', flushedAfterSend, true)
check('queue: a failed send is retried on the next push', retried, true)
check('mergeScan: a row the user moved during the scan keeps the user version', mergeScan([moved], [stale], new Set(['t:1']))[0].groupId, 'g-user')
check('mergeScan: new rows are added, newest first', mergeScan([older], [newer], new Set()).map((r) => r.id), ['t:9', 't:1'])
// A payment Java put in group A after the user merged A into B on screen:
check('settleNew: follows the on-screen merge', settleNew([txInA], groupsWithAHidden, [mergeAtoB]).txs[0].groupId, 'B')
check('settleNew: the merge records the payment', settleNew([txInA], groupsWithAHidden, [mergeAtoB]).merges[0].txIds.includes(txInA.id), true)
```

Also export `settleNew(newTxs: Tx[], groups: Group[], merges: Merge[]): { txs: Tx[]; merges: Merge[] }` from `persist.ts`. It uses the same hop rule as `ChurchSorter.settle`, with at most 10 hops.

- [ ] **Step 2:** `npm run test:persist`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run test:persist`. Expected: `0 failed`. Then run `npx tsc --noEmit`.
- [ ] **Step 5:** Commit each file.

### Task 7: Store and Personal state load from, and save to, Room

**Files:**
- Modify: `src/lib/store.tsx`, `src/lib/personal.ts`, `App.tsx` (keep the splash up until `ready`), `src/screens/onboarding.tsx` (`Scanning` calls the store's `scanMessages`), `src/AppShell.tsx` (`useNewMessages` and `Rescan` call `scanMessages`), `src/native/scan.ts` (delete, since Java reads now)

**Interfaces:**
- Consumes: Task 6.
- Produces:
  - Store fields `ready: boolean` and `saveFailed: boolean`.
  - `scanMessages(since?: number, onProgress?): Promise<ScanResult>`, replacing `loadMessages` and `newMessagesSince`.
  - `persistEnabled()`, true only when `StoreNative.available()` and the data source is not sample.

- [ ] **Step 1:** On mount:
  - with `persistEnabled()` false, `ready = true` on sample data, as today;
  - otherwise `load()` fills each state list and settings, then `markSaved` all of them;
  - phase: no `settings.onboarded` means onboarding at welcome; a lock means `{ kind: 'locked', step: 'lock' }`; otherwise the app.
- [ ] **Step 2:** One `useEffect` per saved list calls `queue.push(table, prevRef, next)`. Settings are `useType`, `themePref`, `exportPrefs`, `pExportPrefs`, `weekly`, `onboarded`, `firstRunCodes`, `serviceId`, `periodId`. They go through `saveSettings`, debounced 300 ms. `enterApp` sets `onboarded`. `saveFailed` shows `notify("Couldn't save. Try again.")` once.
- [ ] **Step 3:** `scanMessages`:
  - `await queue.flush()`, and skip the scan if the queue still holds a failed save;
  - call `StoreNative.scan`;
  - apply `changed` with `mergeScan`, run `settleNew` over the new payments against the on-screen groups and merges, `markSaved` the rows Java wrote, and let the queue save any rows `settleNew` changed;
  - on `first`, keep today's resets from `loadMessages` (specials, service, filters, demo, data source).
  
  `touchedLocally` is the set of IDs pushed to the queue since the scan started.
- [ ] **Step 3a:** Add a fix record `GroupChange = { id; txId; fromGroupId; toGroupId; at: number; kind: 'manual' | 'confirmed' | 'code' | 'undo'; undoes: string | null }`. Append it as a saved list (`group_change` table) from these actions:
  - `moveTx`, `createGroupAndMove` and `renameGroup` are `manual`. A rename has `txId = ''` and from/to both set to the group ID.
  - `mergeGroups` from a suggestion is `confirmed`, one record per moved payment.
  - `assignCode` and `notACode` are `code`.
  - Each Undo of those writes `undo`, with `undoes` set to the original's ID.
  
  Add a `test-persist.js` check that `countManualFixes(changes)` returns 1 after a move and 0 after a move plus its Undo. Export `countManualFixes(changes: GroupChange[]): number` from `persist.ts`.
- [ ] **Step 3b:** `revertMerge` and `undoMerge` read the merge by ID from current state. The Developer flows (`jumpFlow`) and the screen states set `sampleMode = true`, which stops the queue and scans. F1's reset never calls `StoreNative.eraseAll`. On launch, saved messages with no `onboarded` setting resume at `{ kind: 'onboarding', step: 'complete' }`.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run test:inbox` and `npm run test:persist`. Expected: all pass. Build on the phone: first run, scan, kill the app, reopen, and the same groups show with no scan.
- [ ] **Step 5:** Commit each file.

### Task 8: Real lock

**Files:**
- Modify: `src/lib/store.tsx` (`Lock = { type: LockType; fingerprint: boolean }`), `src/screens/lock.tsx`, `src/screens/onboarding.tsx`, `src/AppShell.tsx`

**Interfaces:**
- Consumes: the `StoreNative` lock calls (Task 5 and Task 6).
- Produces:
  - `setLock(type, secret, recovery)` and `setLockOff()` in the store. Both are async. They update `lock` to `{type, fingerprint}`.
  - `checkLock(value)` and `checkRecovery(code)`, both `Promise<{ ok: boolean; waitSeconds: number }>`. Without persistence they compare against `DEMO_LOCK` in memory.
  - The recovery code to show moves from `lock.recovery` into the route or phase: `{ kind: 'locked', step: 'new-recovery', code }` and onboarding `'recovery'` with a code.

- [ ] **Step 0:** Auto-lock (founder). In `AppShell`, record the time the app goes to the background. When it returns, if a lock is set, the phase is `app`, and more than `AUTO_LOCK_MS = 5 * 60 * 1000` has passed, `setPhase({ kind: 'locked', step: 'lock' })` and keep the route stack, so unlocking returns to the same screen. Phone check: background for 1 minute, no lock. Background for more than 5 minutes, the lock shows.
- [ ] **Step 1:** `LockScreen.check` and `ResetLock.submit` await the check and show the wait from `waitSeconds`. The count lives in Java, so it survives a restart.
- [ ] **Step 2:** In every `setLock({...secret...})` call site (onboarding line 50 and line 61, AppShell lines 111, 179, 184 and 207):
  - a new lock gets a code from `LockNative.recoveryCode()`, which replaces `FIRST_RECOVERY_CODE` and `makeRecoveryCode()` on real builds;
  - `NewRecovery` calls `setRecovery(code)`;
  - fingerprint calls `setFingerprint(true)`.
- [ ] **Step 3:** `npx tsc --noEmit`. On the phone:
  - set a PIN, kill the app, reopen: the lock screen shows;
  - a wrong PIN is refused, the right one unlocks;
  - *Forgot*, then the recovery code, then a new PIN keeps the data.
- [ ] **Step 4:** Commit each file.

### Task 9: Remove the TypeScript sorter, document, phone checklist

**Files:**
- Modify: `src/lib/inbox.ts`. Keep only the types, `NO_REFERENCE` and `codeDoubt`. Delete `addChurchRows`, `emptyChurch`, `unreadOf`, `toPersonalTxs` and the helpers only they use.
- Modify: `scripts/test-inbox.js`. Use local copies of `matchKey`, `titleCase` and `formatPhone` for its comparisons, or `java-sorter.js`.
- Modify: `AGENTS.md` (layout: `sorting/`, `store/`, `persist.ts`; state of the app; commands: `test:persist`), `docs/architecture.md` (Missing pieces: storage done; receiver next), `docs/architecture-personal.md:182`.

- [ ] **Step 1:** `npx tsc --noEmit`, `npm run test:parser`, `npm run test:inbox` and `npm run test:persist`. Expected: all `0 failed`.
- [ ] **Step 2:** Phone checklist. Record the results in the PR or commit body:
  1. First run, scan, kill, reopen: same payments and groups, no second scan.
  2. Move a payment, merge two groups, name a code, mark *Not a code*, kill, reopen: all kept.
  3. Undo a merge from Merge history after a restart.
  4. Personal: set a category, add a rule, set a nickname, kill, reopen: kept.
  5. PIN set, kill, reopen: lock screen. Wrong PIN refused. Recovery code reset keeps data.
  6. A new MoMo SMS while open: added once. Kill, reopen: still there once.
  7. Kill the app during the first scan, reopen: first run again, or a complete result, with no duplicates.
  8. Erase all: next launch is at welcome, and the scan finds everything again.
  9. Log `load()` time and the first scan time for the inbox size.
- [ ] **Step 3:** Commit each file.
