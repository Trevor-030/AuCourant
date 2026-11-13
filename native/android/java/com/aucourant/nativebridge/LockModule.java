package com.aucourant.nativebridge;

import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * App lock secrets (architecture.md, "PIN or password" and "Forgot PIN or password").
 * One salted PBKDF2 hash for 4-digit PIN, 6-digit PIN, password and recovery code.
 * Plain secrets are never stored.
 */
public class LockModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantLock";

    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 120_000;
    private static final int KEY_BITS = 256;
    private static final int SALT_BYTES = 16;
    /** 32 symbols, no look-alikes (no 0, O, 1, I). */
    private static final String RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecureRandom random = new SecureRandom();

    LockModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /** Resolves { hash, salt }, both Base64. Runs off the UI thread (PBKDF2 is slow on purpose). */
    @ReactMethod
    public void hashSecret(String secret, Promise promise) {
        new Thread(() -> {
            try {
                byte[] salt = new byte[SALT_BYTES];
                random.nextBytes(salt);
                byte[] hash = derive(secret, salt);
                WritableMap out = Arguments.createMap();
                out.putString("hash", b64(hash));
                out.putString("salt", b64(salt));
                promise.resolve(out);
            } catch (Exception e) {
                promise.reject("E_HASH", "Could not save the lock.", e);
            }
        }).start();
    }

    /** Resolves true when the secret matches. Compared in constant time. */
    @ReactMethod
    public void verifySecret(String secret, String hashB64, String saltB64, Promise promise) {
        new Thread(() -> {
            try {
                byte[] salt = Base64.decode(saltB64, Base64.NO_WRAP);
                byte[] expected = Base64.decode(hashB64, Base64.NO_WRAP);
                promise.resolve(MessageDigest.isEqual(expected, derive(secret, salt)));
            } catch (Exception e) {
                promise.reject("E_VERIFY", "Could not check the lock.", e);
            }
        }).start();
    }

    /** 12 characters shown as XXXX-XXXX-XXXX. Shown once, then only its hash is kept. */
    @ReactMethod
    public void makeRecoveryCode(Promise promise) {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) sb.append('-');
            sb.append(RECOVERY_ALPHABET.charAt(random.nextInt(RECOVERY_ALPHABET.length())));
        }
        promise.resolve(sb.toString());
    }

    private static byte[] derive(String secret, byte[] salt) throws Exception {
        // Recovery codes are compared without dashes and in upper case.
        KeySpec spec = new PBEKeySpec(secret.toCharArray(), salt, ITERATIONS, KEY_BITS);
        return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
    }

    private static String b64(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
    }
}
