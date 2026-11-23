package com.aucourant.lock;

/**
 * The wait after wrong tries on the lock: 5 wrong tries, then 30 seconds. Plain Java, no Android.
 *
 * Times are milliseconds since the phone started (SystemClock.elapsedRealtime), not the clock, so
 * changing the phone's time does not skip the wait. When the phone restarts they begin again at
 * zero; a restart takes about as long as the wait, so a wait from before it is dropped.
 */
public final class TryLimit {
    public static final int MAX_TRIES = 5;
    public static final long WAIT_MS = 30_000;

    public final int failedTries;
    /** When the wait ends. 0 for none. */
    public final long blockedUntil;

    public TryLimit(int failedTries, long blockedUntil) {
        this.failedTries = failedTries;
        this.blockedUntil = blockedUntil;
    }

    /** Seconds still to wait, rounded up; 0 when a try is allowed. */
    public int waitSeconds(long now) {
        long left = blockedUntil - now;
        // More than a whole wait cannot be: it was saved before the phone restarted, or is an old clock time.
        if (left <= 0 || left > WAIT_MS) return 0;
        return (int) ((left + 999) / 1000);
    }

    /** After a wrong try. The fifth starts the wait, and the count starts again after it. */
    public TryLimit wrong(long now) {
        return failedTries + 1 >= MAX_TRIES ? new TryLimit(0, now + WAIT_MS) : new TryLimit(failedTries + 1, 0);
    }

    public TryLimit right() {
        return new TryLimit(0, 0);
    }
}
