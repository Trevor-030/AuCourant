package com.aucourant.nativebridge;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Registers AuCourant's Java modules with React Native.
 * Added to MainApplication by plugins/with-aucourant-native.js on every prebuild.
 */
public class AuCourantPackage implements ReactPackage {
    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext context) {
        return Arrays.<NativeModule>asList(
                new ExportModule(context),
                new LockModule(context),
                new SmsModule(context)
        );
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext context) {
        return Collections.emptyList();
    }
}
