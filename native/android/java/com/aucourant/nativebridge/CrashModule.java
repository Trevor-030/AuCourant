package com.aucourant.nativebridge;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/** The problem report for the screens (CrashLog). */
public class CrashModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantCrash";

    CrashModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /** The report not yet dismissed, or null. */
    @ReactMethod
    public void pending(Promise promise) {
        CrashLog.pending(promise::resolve);
    }

    @ReactMethod
    public void clear(Promise promise) {
        CrashLog.clear();
        promise.resolve(null);
    }

    @ReactMethod
    public void step(String what) {
        CrashLog.step(what);
    }

    /** Waits until the report is saved: the app may be closing. */
    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean recordNow(String kind, String details) {
        CrashLog.record(kind, details);
        return true;
    }
}
