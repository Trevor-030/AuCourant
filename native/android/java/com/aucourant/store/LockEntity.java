package com.aucourant.store;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

/**
 * The app lock: one row (id 1). The PIN or password and the recovery code are kept only as salted
 * PBKDF2 hashes (LockModule), never in plain text. Wrong tries are counted here so a restart does
 * not reset the wait.
 */
@Entity(tableName = "lock_record")
public class LockEntity {
    @PrimaryKey
    public int id = 1;
    /** pin4, pin6 or password. */
    @NonNull
    public String type = "pin4";
    @NonNull
    public String hash = "";
    @NonNull
    public String salt = "";
    @NonNull
    public String recoveryHash = "";
    @NonNull
    public String recoverySalt = "";
    public boolean fingerprint;
    public int failedTries;
    /** When the wait after too many wrong tries ends, in time since the phone started (TryLimit). */
    public long blockedUntil;
}
