package com.aucourant.nativebridge;

import androidx.annotation.NonNull;

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

/**
 * Saved data (docs/superpowers/specs/2026-11-21-room-storage-design.md). The screens keep their
 * edits in TypeScript and send them here; scans read, sort and save in Java. Everything crosses the
 * bridge as JSON strings. All database work runs on one thread, so calls run in the order they arrive.
 */
public class StoreModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantStore";
    static final String PROGRESS_EVENT = "AuCourantScanProgress";
    /** Messages handed to the parser between progress events. */
    private static final int PROGRESS_EVERY = 100;
    private static final int MAX_TRIES = 5;
    private static final long WAIT_MS = 30_000;

    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

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
        WORKER.execute(() -> {
            try {
                promise.resolve(job.run());
            } catch (Exception e) {
                promise.reject(code, message, e);
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
            StringBuilder lists = new StringBuilder("{");
            StringBuilder settings = new StringBuilder("{");
            String kind = null;
            boolean firstItem = true;
            for (RecordEntity r : dao().everything()) {
                if (Kinds.SEEN.equals(r.kind)) continue;
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
     * @param optsJson { useType, senders, firstRunCodes, defaultCategories }
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
            List<Model.Sms> inbox = SmsModule.readInbox(getReactApplicationContext(), Model.strings(opts.get("senders")), (long) sinceMillis);
            List<Model.Row> rows = new ArrayList<>();
            progress(0, inbox.size());
            for (Model.Sms sms : inbox) {
                rows.add(new Model.Row(sms, SmsModule.parsedOf(ParserRegistry.mtn().parse(sms.body))));
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
        work(promise, "E_LOCK", "Could not save the lock.", () -> {
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
        work(promise, "E_LOCK", "Could not save the lock.", () -> {
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
        work(promise, "E_LOCK", "Could not save the lock.", () -> {
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
        work(promise, "E_LOCK", "Could not save the lock.", () -> {
            LockEntity l = requireLock();
            l.fingerprint = on;
            dao().saveLock(l);
            return null;
        });
    }

    @ReactMethod
    public void clearLock(Promise promise) {
        work(promise, "E_LOCK", "Could not remove the lock.", () -> {
            dao().clearLock();
            return null;
        });
    }

    /** Resolves { ok, waitSeconds }. After 5 wrong tries, refuses for 30 seconds, also across restarts. */
    @ReactMethod
    public void checkLock(String secret, Promise promise) {
        work(promise, "E_VERIFY", "Could not check the lock.", () -> check(secret, false));
    }

    /** Same as checkLock, for the recovery code. A right code does not unlock; it allows setting a new lock. */
    @ReactMethod
    public void checkRecovery(String code, Promise promise) {
        work(promise, "E_VERIFY", "Could not check the code.", () -> check(recoveryKey(code), true));
    }

    private WritableMap check(String value, boolean recovery) throws Exception {
        LockEntity l = dao().lock();
        WritableMap out = Arguments.createMap();
        out.putBoolean("ok", false);
        out.putInt("waitSeconds", 0);
        if (l == null) return out;
        long now = System.currentTimeMillis();
        if (now < l.blockedUntil) {
            out.putInt("waitSeconds", (int) Math.ceil((l.blockedUntil - now) / 1000.0));
            return out;
        }
        boolean ok = recovery ? LockModule.verify(value, l.recoveryHash, l.recoverySalt) : LockModule.verify(value, l.hash, l.salt);
        if (ok) {
            l.failedTries = 0;
            l.blockedUntil = 0;
        } else if (++l.failedTries >= MAX_TRIES) {
            l.failedTries = 0;
            l.blockedUntil = now + WAIT_MS;
            out.putInt("waitSeconds", (int) (WAIT_MS / 1000));
        }
        dao().saveLock(l);
        out.putBoolean("ok", ok);
        return out;
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
