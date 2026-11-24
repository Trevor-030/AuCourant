package com.aucourant.nativebridge;

import android.content.Context;
import android.os.SystemClock;

import androidx.annotation.NonNull;

import com.aucourant.lock.TryLimit;
import com.aucourant.parser.ParserRegistry;
import com.aucourant.sorting.Json;
import com.aucourant.sorting.Model;
import com.aucourant.store.AuCourantDatabase;
import com.aucourant.store.Kinds;
import com.aucourant.store.LockEntity;
import com.aucourant.store.RecordEntity;
import com.aucourant.store.Scanner;
import com.aucourant.store.StoreDao;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Saved data (docs/superpowers/specs/2026-11-21-room-storage-design.md). The screens keep their
 * edits in TypeScript and send them here; scans read, sort and save in Java. Everything crosses the
 * bridge as JSON strings. List work runs on one thread, so calls run in the order they arrive; lock
 * checks have their own, so a PIN never waits behind a scan.
 */
public class StoreModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantStore";
    static final String PROGRESS_EVENT = "AuCourantScanProgress";
    /** Messages handed to the parser between progress events. */
    private static final int PROGRESS_EVERY = 100;
    /** A MoMo message arrived while the screens are running: they scan it in, since they hold unsaved edits. */
    static final String NEW_MESSAGE_EVENT = "AuCourantNewMessage";
    /** Same overlap as src/lib/store.tsx: a message can reach the inbox a little after its own timestamp. */
    private static final long OVERLAP_MS = 10 * 60 * 1000;

    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    private static final ExecutorService LOCK_WORKER = Executors.newSingleThreadExecutor();

    /** The module whose screens have loaded the saved data, or null. Set and read on WORKER; see messageArrived. */
    private static volatile StoreModule live;

    StoreModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    private StoreDao dao() {
        return AuCourantDatabase.get(getReactApplicationContext()).dao();
    }

    private interface Job {
        Object run() throws Exception;
    }

    /** Runs on the worker thread; resolves the result, or rejects with a plain message. */
    private void work(Promise promise, String code, String message, Job job) {
        work(WORKER, promise, code, message, job);
    }

    private void work(ExecutorService worker, Promise promise, String code, String message, Job job) {
        worker.execute(() -> {
            // Steps for the problem report: which call, and how long it took. A step with no end is where it stopped.
            String call = code.substring(2).toLowerCase(Locale.ROOT);
            long start = SystemClock.elapsedRealtime();
            CrashLog.step(call + " started");
            try {
                promise.resolve(job.run());
                CrashLog.step(call + " done in " + (SystemClock.elapsedRealtime() - start) + " ms");
            } catch (Throwable e) {
                // Errors too (a class that fails to load is an Error): the screens get a message instead of the app closing.
                CrashLog.step(call + " failed: " + e.getClass().getSimpleName());
                promise.reject(code, message, e);
                // Out of memory and similar leave the process unsafe: still let those reach the crash recorder.
                if (e instanceof VirtualMachineError) throw (VirtualMachineError) e;
            }
        });
    }

    // ---- Load and save -------------------------------------------------------------

    /**
     * Everything saved, as JSON: { lists: { kind: [item...] }, settings: { key: value }, lock: { type, fingerprint } | null }.
     * Lists come in saved order; the screens sort payments by date.
     */
    @ReactMethod
    public void load(Promise promise) {
        work(promise, "E_LOAD", "Couldn't load your data.", () -> {
            // From here on these screens hold the data, so the receiver leaves scanning to them.
            live = this;
            StringBuilder lists = new StringBuilder("{");
            StringBuilder settings = new StringBuilder("{");
            String kind = null;
            boolean firstItem = true;
            for (RecordEntity r : dao().allExcept(Kinds.SEEN)) {
                if (Kinds.SETTINGS.equals(r.kind)) {
                    if (settings.length() > 1) settings.append(',');
                    settings.append(Json.write(r.id)).append(':').append(r.json);
                    continue;
                }
                if (!r.kind.equals(kind)) {
                    if (kind != null) lists.append("],");
                    lists.append(Json.write(r.kind)).append(":[");
                    kind = r.kind;
                    firstItem = true;
                }
                if (!firstItem) lists.append(',');
                lists.append(r.json);
                firstItem = false;
            }
            if (kind != null) lists.append(']');
            lists.append('}');
            settings.append('}');
            LockEntity lock = dao().lock();
            String lockJson = lock == null ? "null" : "{\"type\":" + Json.write(lock.type) + ",\"fingerprint\":" + lock.fingerprint + "}";
            return "{\"lists\":" + lists + ",\"settings\":" + settings + ",\"lock\":" + lockJson + "}";
        });
    }

    /** Saves edits: [{ table, upsert: [{ id, position, json }], remove: [id] }], in one transaction. */
    @ReactMethod
    public void save(String changesJson, Promise promise) {
        work(promise, "E_SAVE", "Couldn't save. Try again.", () -> {
            List<Object> changes = asList(Json.parse(changesJson));
            AuCourantDatabase db = AuCourantDatabase.get(getReactApplicationContext());
            db.runInTransaction(() -> {
                for (Object o : changes) {
                    Map<String, Object> c = Model.asMap(o);
                    String table = Model.str(c, "table");
                    if (!Kinds.WRITABLE.contains(table)) throw new IllegalArgumentException("Unknown list " + table);
                    List<RecordEntity> rows = new ArrayList<>();
                    for (Object u : Model.list(c, "upsert")) {
                        Map<String, Object> m = Model.asMap(u);
                        Double pos = Model.dbl(m, "position");
                        rows.add(new RecordEntity(table, Model.str(m, "id"), pos == null ? 0 : pos.intValue(), Model.str(m, "json")));
                    }
                    if (!rows.isEmpty()) db.dao().upsert(rows);
                    List<String> remove = Model.strings(c.get("remove"));
                    if (!remove.isEmpty()) db.dao().delete(table, remove);
                }
            });
            return null;
        });
    }

    /** Saves settings: { key: value }. */
    @ReactMethod
    public void saveSettings(String json, Promise promise) {
        work(promise, "E_SAVE", "Couldn't save. Try again.", () -> {
            List<RecordEntity> rows = new ArrayList<>();
            for (Map.Entry<String, Object> e : Model.asMap(Json.parse(json)).entrySet()) {
                rows.add(new RecordEntity(Kinds.SETTINGS, e.getKey(), 0, Json.write(e.getValue())));
            }
            dao().upsert(rows);
            return null;
        });
    }

    /** The last-resort erase: every list, every setting and the lock. */
    @ReactMethod
    public void eraseAll(Promise promise) {
        work(promise, "E_ERASE", "Couldn't erase. Try again.", () -> {
            AuCourantDatabase.get(getReactApplicationContext()).clearAllTables();
            return null;
        });
    }

    // ---- Scan ----------------------------------------------------------------------

    /**
     * Reads the inbox from `sinceMillis`, parses, sorts and saves in one transaction.
     *
     * @param optsJson { useType, firstRunCodes, defaultCategories }
     * @return JSON { messages, newPayments, first, changed: {...} }. Emits AuCourantScanProgress { read, total }.
     */
    @ReactMethod
    public void scan(double sinceMillis, String optsJson, Promise promise) {
        if (!SmsModule.granted(getReactApplicationContext())) {
            promise.reject("E_PERMISSION", "Message access is off.");
            return;
        }
        work(promise, "E_SCAN", "We couldn't finish reading messages.", () -> {
            Map<String, Object> opts = Model.asMap(Json.parse(optsJson));
            List<Model.Sms> inbox = SmsModule.readInbox(getReactApplicationContext(), (long) sinceMillis);
            List<Model.Row> rows = new ArrayList<>();
            progress(0, inbox.size());
            for (Model.Sms sms : inbox) {
                rows.add(new Model.Row(sms, SmsModule.parsedOf(ParserRegistry.forSender(sms.address).parse(sms.body))));
                if (rows.size() % PROGRESS_EVERY == 0) progress(rows.size(), inbox.size());
            }
            progress(rows.size(), inbox.size());
            return Json.write(Scanner.scan(AuCourantDatabase.get(getReactApplicationContext()), rows, opts));
        });
    }

    private void progress(int read, int total) {
        WritableMap m = Arguments.createMap();
        m.putInt("read", read);
        m.putInt("total", total);
        getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(PROGRESS_EVENT, m);
    }

    // ---- Messages as they arrive (SmsReceiver) ---------------------------------------

    /**
     * A MoMo message is in the inbox. While screens are running they are told and scan it in
     * themselves; otherwise it is read, sorted and saved here, so it is there when the app opens.
     * The check runs on WORKER, where `load` also marks the screens as running: a message is either
     * saved before they load, or they are told about it.
     */
    static Future<?> messageArrived(Context context) {
        return WORKER.submit(() -> {
            StoreModule screens = live;
            if (screens != null) {
                ReactApplicationContext react = screens.getReactApplicationContext();
                if (react.hasActiveReactInstance()) react.emitDeviceEvent(NEW_MESSAGE_EVENT);
                return null;
            }
            if (!SmsModule.granted(context)) return null;
            AuCourantDatabase db = AuCourantDatabase.get(context);
            Scanner.Resume resume = Scanner.resume(db);
            if (resume == null) return null;
            List<Model.Row> rows = new ArrayList<>();
            for (Model.Sms sms : SmsModule.readInbox(context, Math.max(0, resume.newestSms - OVERLAP_MS))) {
                rows.add(new Model.Row(sms, SmsModule.parsedOf(ParserRegistry.forSender(sms.address).parse(sms.body))));
            }
            Scanner.scan(db, rows, resume.opts);
            return null;
        });
    }

    @Override
    public void invalidate() {
        if (live == this) live = null;
        super.invalidate();
    }

    /** Required by NativeEventEmitter. */
    @ReactMethod
    public void addListener(String eventName) {
    }

    /** Required by NativeEventEmitter. */
    @ReactMethod
    public void removeListeners(double count) {
    }

    // ---- Lock ----------------------------------------------------------------------

    /** Saves a new lock. Only hashes are kept; the recovery code is checked without dashes, upper case. */
    @ReactMethod
    public void setLock(String type, String secret, String recovery, boolean fingerprint, Promise promise) {
        lockWork(promise, "E_LOCK", "Could not save the lock.", () -> {
            LockEntity l = new LockEntity();
            l.type = type;
            String[] h = LockModule.hash(secret);
            l.hash = h[0];
            l.salt = h[1];
            String[] r = LockModule.hash(recoveryKey(recovery));
            l.recoveryHash = r[0];
            l.recoverySalt = r[1];
            l.fingerprint = fingerprint;
            dao().saveLock(l);
            return null;
        });
    }

    /** Changes the PIN or password and keeps the recovery code. */
    @ReactMethod
    public void changeSecret(String type, String secret, Promise promise) {
        lockWork(promise, "E_LOCK", "Could not save the lock.", () -> {
            LockEntity l = requireLock();
            l.type = type;
            String[] h = LockModule.hash(secret);
            l.hash = h[0];
            l.salt = h[1];
            l.failedTries = 0;
            l.blockedUntil = 0;
            dao().saveLock(l);
            return null;
        });
    }

    /** A new recovery code; the old one stops working. */
    @ReactMethod
    public void setRecovery(String code, Promise promise) {
        lockWork(promise, "E_LOCK", "Could not save the lock.", () -> {
            LockEntity l = requireLock();
            String[] r = LockModule.hash(recoveryKey(code));
            l.recoveryHash = r[0];
            l.recoverySalt = r[1];
            dao().saveLock(l);
            return null;
        });
    }

    @ReactMethod
    public void setFingerprint(boolean on, Promise promise) {
        lockWork(promise, "E_LOCK", "Could not save the lock.", () -> {
            LockEntity l = requireLock();
            l.fingerprint = on;
            dao().saveLock(l);
            return null;
        });
    }

    @ReactMethod
    public void clearLock(Promise promise) {
        lockWork(promise, "E_LOCK", "Could not remove the lock.", () -> {
            dao().clearLock();
            return null;
        });
    }

    /** Seconds left of a wait the app was restarted in; 0 for none. */
    @ReactMethod
    public void lockWait(Promise promise) {
        lockWork(promise, "E_VERIFY", "Could not check the lock.", () -> {
            LockEntity l = dao().lock();
            return l == null ? 0 : limitOf(l).waitSeconds(SystemClock.elapsedRealtime());
        });
    }

    /** Resolves { ok, waitSeconds }. After 5 wrong tries, refuses for 30 seconds, also when the app restarts. */
    @ReactMethod
    public void checkLock(String secret, Promise promise) {
        lockWork(promise, "E_VERIFY", "Could not check the lock.", () -> check(secret, false));
    }

    /** Same as checkLock, for the recovery code. A right code does not unlock; it allows setting a new lock. */
    @ReactMethod
    public void checkRecovery(String code, Promise promise) {
        lockWork(promise, "E_VERIFY", "Could not check the code.", () -> check(recoveryKey(code), true));
    }

    private WritableMap check(String value, boolean recovery) throws Exception {
        LockEntity l = dao().lock();
        WritableMap out = Arguments.createMap();
        out.putBoolean("ok", false);
        out.putInt("waitSeconds", 0);
        if (l == null) return out;
        long now = SystemClock.elapsedRealtime();
        TryLimit limit = limitOf(l);
        int wait = limit.waitSeconds(now);
        if (wait > 0) {
            out.putInt("waitSeconds", wait);
            return out;
        }
        boolean ok = recovery ? LockModule.verify(value, l.recoveryHash, l.recoverySalt) : LockModule.verify(value, l.hash, l.salt);
        TryLimit next = ok ? limit.right() : limit.wrong(now);
        // A right try with nothing to clear writes nothing, so it never waits for a scan to finish saving.
        if (next.failedTries != l.failedTries || next.blockedUntil != l.blockedUntil) {
            l.failedTries = next.failedTries;
            l.blockedUntil = next.blockedUntil;
            dao().updateLock(l);
        }
        out.putInt("waitSeconds", next.waitSeconds(now));
        out.putBoolean("ok", ok);
        return out;
    }

    private static TryLimit limitOf(LockEntity l) {
        return new TryLimit(l.failedTries, l.blockedUntil);
    }

    private void lockWork(Promise promise, String code, String message, Job job) {
        work(LOCK_WORKER, promise, code, message, job);
    }

    private LockEntity requireLock() {
        LockEntity l = dao().lock();
        if (l == null) throw new IllegalStateException("No lock is set.");
        return l;
    }

    private static String recoveryKey(String code) {
        return code.replace("-", "").trim().toUpperCase(Locale.ROOT);
    }

    @SuppressWarnings("unchecked")
    private static List<Object> asList(Object o) {
        return o instanceof List ? (List<Object>) o : new ArrayList<>();
    }
}
