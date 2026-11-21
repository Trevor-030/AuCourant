# Room storage, with grouping in Java: design

Date: 2026-11-21. Status: draft for the founder's approval.

## Why

Everything in AuCourant lives in React state today, so every launch starts at first run and scans the inbox again. Named codes, merges, moved payments, Personal categories, the lock and the settings are all lost. A treasurer cannot use the app across services until the data survives a restart.

The founder also chose to move the automatic sorting into Java now (option B). The reason is the live SMS receiver that comes next: it runs in Java, possibly with the app closed, and should be able to read, sort and save a new payment without the React Native screens.

## Goals

1. **Everything the user owns survives a restart, an app update and a phone reboot.** That means:
   - Church: payments, groups (including hidden and code holding groups), merges with the payments each one moved, suggestions, pairs kept separate, *Not read* messages and the ones skipped, the code book, special sessions, the weekly service.
   - Personal: payments, categories, rules, nicknames.
   - Settings: use type, theme, both export preferences, and whether first run is finished.
   - Scan state: whether data comes from messages, the message IDs already read, the time of the newest message.
   - The lock.
2. **Java does the work that happens without a person.** Java reads the inbox, parses it, and sorts new payments into groups, including built-in pairs, the code book, following merges, merge suggestions and *Not read*. It also turns payments into Personal payments, and categorises new ones with the saved rules. All of this is in a plain Java package with no Android imports, checked with only the JDK like the parser.
3. **The treasurer's edits stay in TypeScript** (founder, option 1): merge, move, rename, name a code, *Not a code*, keep separate, skip, special sessions, categories, rules, nicknames, and every Undo. Each edit still updates the screen at once, then is saved to Room.
4. **The lock is real.** The PIN or password and the recovery code are saved as salted PBKDF2 hashes made by `LockModule`, never as plain text. The lock screen checks through `LockModule.verifySecret`. After a restart the app opens on the lock screen when a lock is set.

## Non-goals

- The live SMS receiver. It is the next piece; this design only makes sure it can reuse the Java sorter and the database.
- Fingerprint unlock (AndroidX Biometric). The `fingerprint` flag is saved, but nothing reads it yet.
- Full-text search (`architecture-personal.md`). Search keeps running over the payments in memory.
- Database encryption. Decided against in `architecture.md`; the lock only.
- Saving the sample data. Sample data, the Developer flows (F1 to F6) and screen states stay in memory and are never written.
- Migrations. There are no users, so the database starts at version 1.

## Anti-goals (a failure even if it works)

- **A payment counted twice** after a rescan or a crash in the middle of a scan. The transaction ID stays the unique key, and a scan is saved in one database transaction or not at all.
- **An edit lost or undone by a scan**, for example a payment moved by hand going back to its old group because a scan saved older state over it.
- **Saved data reachable without the lock** after a restart, or the PIN kept in plain text.
- **Java and TypeScript sorting differently.** The TypeScript sorter is deleted once Java takes over. Where one rule must exist in both (the categoriser, see below), the same checks run against both.

## Approaches

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| A | Room only stores the data; sorting stays in TypeScript | About half the Java, and the logic stays under the existing 196 checks. But the receiver could only save raw messages, and sorting would wait until the app opens. | Not chosen |
| **B** | **Room, and the automatic sorting moves to Java** | Matches the architecture doc and lets the receiver sort with the app closed. About 340 lines of tested TypeScript are rewritten in Java. | **Chosen by the founder** |

Within B, who handles the edits:

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| **1** | **Java does the automatic work, TypeScript keeps the edits and saves them** | Every screen keeps working as it does. Two writers to the same tables, so the order of writes must be fixed (below). | **Chosen by the founder** |
| 2 | Java does everything; every edit is a native call | One owner of the data and the cleanest end state. Rewrites most of `store.tsx` and `personal.ts` (about 900 lines) on top of the sorting. | Not chosen |

## How it fits together

```
 launch ──> StoreModule.load() ──> one snapshot of every table ──> store.tsx / personal.ts state
                                                                    │
 edit (move, merge, Undo...) ──> React state at once ──> save queue ─┘──> StoreModule.save(...)
                                                                                    │
 scan (first run, every 20 s, Scan again) ──> wait for the save queue to empty ──> StoreModule.scan(since)
        Java: read inbox -> parse -> sort against the saved tables -> write, all in one transaction
        <── returns the changed rows and the counts ──> merged into React state
```

### Java packages

- `com.aucourant.parser`: unchanged.
- `com.aucourant.sorting` (new, no Android or Room imports): a port of `src/lib/inbox.ts` and `src/lib/categorise.ts`:
  - `ChurchSorter`: `addChurchRows`, `emptyChurch`, the match key, built-in pairs, following merges, suggestions using the 80% edit distance rule, and `unreadOf`.
  - `PersonalReader`: `toPersonalTxs`, including a reversal or a bare number taking the name from an earlier payment.
  - `Categoriser`: `categorise` and `categoriseAll`.
  - It works on plain Java objects that mirror the TypeScript types (`Tx`, `Group`, `Merge`, `Suggestion`, `Unread`, `PTx`, `CategoryRule`), so the same IDs and field values come out.
- `com.aucourant.store` (new, Android): Room entities, DAOs, `AuCourantDatabase`, and the mapping between the sorting objects and the entities.
- `com.aucourant.nativebridge.StoreModule` (new): the React Native bridge.

### StoreModule calls

| Call | What it does |
|---|---|
| `load()` | Returns everything saved, as one snapshot. Empty tables on a new install. |
| `scan(sinceMillis, opts)` | Reads the inbox from `sinceMillis`, parses it, and sorts the new messages against the saved tables. `opts` carries the use type for built-in pairs and the codes named at first run. Writes everything in one transaction. Returns the rows it added or changed, plus `{ messages, newPayments }`. Reports progress for the first-run progress bar. |
| `save(changes)` | Upserts and deletes rows for one edit: `{ table, upsert: [...], remove: [ids] }[]`, in one transaction. |
| `saveSettings(map)` | Saves settings as key and value. |
| `setLock(type, secret, recovery, fingerprint)` / `checkLock(secret)` / `checkRecovery(code)` / `clearLock()` | Hash and save the lock, and check it. The secret and recovery code never come back to TypeScript. |
| `eraseAll()` | Deletes every row: the last-resort erase. |

All database work runs on one single-thread executor, so calls run in the order they arrive.

### Order of writes (the two-writer rule)

- TypeScript keeps one save queue. Each edit adds one `save` call, and calls are sent one at a time, in order.
- Before a scan, TypeScript waits for the queue to empty. While a scan runs, edits wait their turn on the queue. This is a short hold, because a scan after first run reads only the newest messages.
- The scan reads the saved tables inside its transaction, so it always sorts against the latest edits. It returns only what it added or changed: new payments, new groups, merges that recorded a new payment, new suggestions, new *Not read* messages, and new Personal payments. TypeScript merges these into React state and never replaces a row the user changed in the meantime.
- If a save fails, the screen keeps the edit and shows *Couldn't save. Try again.* The queue retries on the next edit or the next launch. My call: nothing the user sees is rolled back silently.

### TypeScript changes

- `store.tsx` and `personal.ts` start in a *loading* state. Launch calls `load()`, and the splash screen stays up until it returns. Then the app goes to first run (nothing saved), the lock screen (a lock is set) or the app.
- `loadMessages` is replaced by `StoreModule.scan`. `addChurchRows`, `toPersonalTxs`, `emptyChurch` and `unreadOf` are removed from `src/lib/inbox.ts`. The display helpers stay (`titleCase` and `formatPhone` are only used by the sorter, so they move too; `codeDoubt` stays in TypeScript because it is a screen concern).
- Each edit action keeps its current logic, then adds a save for the rows it changed. Undo is just another edit.
- `categoriseAll` stays in TypeScript as well, because adding a rule recategorises the payments on screen at once. It exists in both languages; see Testing.
- `seenSms` and `newestSms` move into Room. The scan keeps them up to date, so TypeScript no longer tracks message IDs.
- Expo Go has no Java modules. It keeps today's sample data in memory, as now.
- `eraseAll` also calls `StoreModule.eraseAll()`.

### Lock

- The `lock` table holds one row: `type`, the secret's hash and salt, the recovery code's hash and salt, and `fingerprint`.
- The TypeScript `Lock` type loses `secret` and `recovery`. `setLock` sends the secret to `StoreModule.setLock` and keeps only `{ type, fingerprint }`.
- The recovery code is shown once at setup, as today, and only its hash is kept.
- `lock.tsx` checks the entry with `checkLock`, and the reset screen uses `checkRecovery`.
- Developer flows and Expo Go keep `DEMO_LOCK` in memory.

### Room setup

- Java only, so Room uses `annotationProcessor` (no Kotlin, KSP or kapt). The Room version is pinned to the latest stable release that supports Java.
- The Room runtime and compiler are added to `android/app/build.gradle` by `plugins/with-aucourant-native.js` (`withAppBuildGradle`), never by hand. `android/` is generated.
- A list-valued field (a merge's payment IDs, the export fields) is stored as JSON text through a Room `TypeConverter` (my call: these lists are small and only read whole).
- The database file is app-private. Backups are already off (`allowBackup: false`).

## Testing

- **Sorting in Java:**
  - A `SortDump` program, like `ParseDump`, runs `ChurchSorter`, `PersonalReader` and `Categoriser` over JSON input.
  - `scripts/test-inbox.js` switches from the TypeScript sorter to `SortDump` and keeps every one of today's checks: sample data back as the same groups, rescans, cash in, merges, renames, codes, doubtful codes, Personal.
  - The Java port is done when all of them pass. Only then is the TypeScript sorter deleted.
- **The categoriser in both languages:** the same cases run through `categorise.ts` and `Categoriser` and must agree.
- **Room and the bridge:** these can only run on a phone. The founder will build the app and test on the phone (2026-11-21). A short checklist goes in the plan:
  - First run, scan, close the app fully, reopen: same payments and groups, no second scan.
  - Move a payment, merge two groups, name a code, close and reopen: the edits are still there.
  - Undo after a restart (from Merge history): it works.
  - Set a PIN, close and reopen: the lock screen opens, the right PIN unlocks, a wrong one does not. The recovery code resets the PIN and keeps the data.
  - A new message arrives while the app is open: it is added once and survives a restart.
  - Erase all: everything is gone, and the next launch starts at first run.
- **Build order:** the first step is getting today's app to build and install on the phone, before Room is added. A build was started on 2026-11-21. After that, every step that adds Java ends with a phone build, so a compile or runtime error shows up in the step that caused it.

## Constraints

- Java only for native code (founder). `com.aucourant.sorting` and `com.aucourant.parser` must stay free of Android imports.
- `android/` is generated; Gradle and manifest changes go through `app.json` or the config plugin.
- 64-bit (arm64-v8a) build only.
- Slow connection: Room adds Gradle downloads (runtime, compiler, SQLite wrapper). Use the long Gradle timeouts already in `AGENTS.md` and the memory notes.
- Drive C: had about 15 GB free on 2026-11-21.

## Founder answers after the builder check (2026-11-21)

- **Auto-lock:** the app also locks when it has been in the background for more than **5 minutes**. Switching to the MoMo app and back within that time does not ask for the PIN. It applies only when a lock is set.
- **Manual-fix record (GroupChange):** recorded from now on, as `architecture.md` describes.
  - Each record holds: payment, from group, to group, time, and kind (`auto`, `confirmed`, `code`, `manual`, `undo`).
  - Moving a payment, creating a group for it and renaming a group are `manual`. Undoing one of those writes an `undo` that cancels it out.
  - Confirming a merge suggestion is `confirmed`. Naming a code and *Not a code* are `code`. Neither is counted as a fix.
  - Payments the scan places are not recorded: they are the starting point, not a change.
  - Nothing reads the count yet. It is kept for the pilot.
  - It is saved in a `group_change` table, written through the same save queue.

## Calls made after the builder check (Claude's, correct if wrong)

- **Edit during a scan.** Example: a merge, naming a code, or *Not a code* while a 20-second check runs. Java sorted against saved tables that do not have the edit yet, so a new payment can land in a group that is now hidden on screen.
  - When the scan result is merged in, any new payment in a group hidden on screen is passed on through the on-screen merges (the same rule as `settle`). The merge records it, and the corrected rows are saved through the queue.
  - Undo reads the merge as it is now, not the copy taken when the edit was made, so payments added since are undone too.
- **Saves keep failing.** A scan does not run while the queue holds a failed save. The app shows *Couldn't save. Try again.* and retries on the next edit or check. Edits not yet saved are lost if the app is killed while saving fails. This is accepted, because the error was shown.
- **Developer flows.**
  - F1 to F6 and the screen states switch the session to sample mode: saving stops, and the saved data is left untouched. A restart returns to the saved data.
  - F1's erase is in memory only. Only *Erase all data* in Settings, and the last-resort erase on the lock screen, empty the database.
- **First run interrupted after the scan.** The use type and the codes named at first run are saved before the scan. If messages were already saved but first run is not finished, the next launch resumes at the step after the scan (*Scan complete*), not at the welcome screen.
- **Wrong PIN tries** are counted in Java and saved, so restarting the app does not reset the 5 tries and the 30-second wait.
- **Recovery codes** come from `LockModule.makeRecoveryCode` (secure random) on real builds. The fixed `FIRST_RECOVERY_CODE` and `makeRecoveryCode()` in TypeScript stay only for sample mode and Expo Go.

## Left to the builder

- Exact entity columns, DAO methods and indexes. At least an index on payment group and payment date.
- How the snapshot crosses the bridge (`WritableMap` or one JSON string). Pick whichever is faster for about 5,000 payments.
- How far `store.tsx` and `personal.ts` are split to keep the save calls readable.
- Progress reporting from `scan` (a progress callback or events).
