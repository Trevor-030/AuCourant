package com.aucourant.nativebridge;

import android.app.Activity;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricManager.Authenticators;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.security.Key;
import java.security.KeyStore;
import java.security.UnrecoverableKeyException;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;

/**
 * Fingerprint unlock (AndroidX Biometric). The PIN or password always works as well.
 *
 * The phone is often shared, and anyone who knows its screen lock can add a fingerprint. So unlocking
 * is tied to a key in the Android Keystore that stops working when a fingerprint is added: the app
 * then asks for the PIN or password, and fingerprint has to be turned on again.
 *
 * Results: "ok", "cancelled", "locked" (too many tries), "none" (no fingerprint on the phone),
 * "changed" (the phone's fingerprints changed), "unavailable".
 */
public class FingerprintModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantFingerprint";
    private static final String STORE = "AndroidKeyStore";
    private static final String KEY = "aucourant_fingerprint";
    private static final String CIPHER = KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_CBC + "/" + KeyProperties.ENCRYPTION_PADDING_PKCS7;

    FingerprintModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /** "ready", "none" (no fingerprint saved on the phone) or "unavailable". */
    @ReactMethod
    public void status(Promise promise) {
        promise.resolve(statusNow());
    }

    /** Turning it on: makes a new key, then asks for a fingerprint once. */
    @ReactMethod
    public void enable(String title, String cancel, Promise promise) {
        String status = statusNow();
        if (!"ready".equals(status)) {
            promise.resolve(status);
            return;
        }
        try {
            KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE);
            gen.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
                    .setUserAuthenticationRequired(true)
                    .setInvalidatedByBiometricEnrollment(true)
                    .build());
            gen.generateKey();
        } catch (Exception e) {
            promise.resolve("unavailable");
            return;
        }
        ask(title, cancel, promise);
    }

    /** Unlocking. */
    @ReactMethod
    public void check(String title, String cancel, Promise promise) {
        String status = statusNow();
        // Every fingerprint was removed from the phone: the key is gone too.
        if (!"ready".equals(status)) promise.resolve("none".equals(status) ? "changed" : status);
        else ask(title, cancel, promise);
    }

    /** Turning it off. */
    @ReactMethod
    public void disable(Promise promise) {
        forgetKey();
        promise.resolve(null);
    }

    private String statusNow() {
        switch (BiometricManager.from(getReactApplicationContext()).canAuthenticate(Authenticators.BIOMETRIC_STRONG)) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "ready";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "none";
            default:
                return "unavailable";
        }
    }

    private void ask(String title, String cancel, Promise promise) {
        Cipher cipher;
        try {
            KeyStore store = KeyStore.getInstance(STORE);
            store.load(null);
            Key key = store.getKey(KEY, null);
            if (key == null) {
                promise.resolve("changed");
                return;
            }
            cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.ENCRYPT_MODE, key);
        } catch (KeyPermanentlyInvalidatedException | UnrecoverableKeyException e) {
            forgetKey();
            promise.resolve("changed");
            return;
        } catch (Exception e) {
            promise.resolve("unavailable");
            return;
        }
        Activity activity = getReactApplicationContext().getCurrentActivity();
        if (!(activity instanceof FragmentActivity)) {
            promise.resolve("cancelled");
            return;
        }
        FragmentActivity screen = (FragmentActivity) activity;
        screen.runOnUiThread(() -> show(screen, cipher, title, cancel, promise));
    }

    private void show(FragmentActivity screen, Cipher cipher, String title, String cancel, Promise promise) {
        AtomicBoolean answered = new AtomicBoolean();
        // The prompt cannot open while the app is leaving the screen; it would never answer.
        if (screen.isFinishing() || screen.isDestroyed() || screen.getSupportFragmentManager().isStateSaved()) {
            promise.resolve("cancelled");
            return;
        }
        BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                String answer = "unavailable";
                try {
                    // Only works with the key unlocked by this fingerprint.
                    BiometricPrompt.CryptoObject used = result.getCryptoObject();
                    if (used != null && used.getCipher() != null) {
                        used.getCipher().doFinal(new byte[] {1});
                        answer = "ok";
                    }
                } catch (Exception e) {
                    answer = "unavailable";
                }
                if (answered.compareAndSet(false, true)) promise.resolve(answer);
            }

            @Override
            public void onAuthenticationError(int code, @NonNull CharSequence text) {
                if (answered.compareAndSet(false, true)) promise.resolve(resultOf(code));
            }
        };
        try {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setNegativeButtonText(cancel)
                    .setAllowedAuthenticators(Authenticators.BIOMETRIC_STRONG)
                    .setConfirmationRequired(false)
                    .build();
            new BiometricPrompt(screen, ContextCompat.getMainExecutor(screen), callback)
                    .authenticate(info, new BiometricPrompt.CryptoObject(cipher));
        } catch (RuntimeException e) {
            if (answered.compareAndSet(false, true)) promise.resolve("unavailable");
        }
    }

    private static String resultOf(int code) {
        switch (code) {
            case BiometricPrompt.ERROR_LOCKOUT:
            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                return "locked";
            case BiometricPrompt.ERROR_NO_BIOMETRICS:
                return "none";
            case BiometricPrompt.ERROR_HW_NOT_PRESENT:
            case BiometricPrompt.ERROR_HW_UNAVAILABLE:
                return "unavailable";
            default:
                return "cancelled";
        }
    }

    private static void forgetKey() {
        try {
            KeyStore store = KeyStore.getInstance(STORE);
            store.load(null);
            store.deleteEntry(KEY);
        } catch (Exception e) {
            // A key that cannot be deleted is replaced the next time fingerprint is turned on.
        }
    }
}
