package com.aucourant.lock;

/** Plain-JDK checks for the wrong-try wait (no JUnit, no Android). Run with `npm run test:parser`. */
public final class LockCheck {
    private static int passed;
    private static int failed;

    private LockCheck() {
    }

    public static void main(String[] args) {
        long t = 1_000_000;
        TryLimit fresh = new TryLimit(0, 0);
        eq("no wait at first", 0, fresh.waitSeconds(t));
        TryLimit four = fresh;
        for (int i = 0; i < 4; i++) four = four.wrong(t);
        eq("four wrong tries: no wait", 0, four.waitSeconds(t));
        eq("four wrong tries are counted", 4, four.failedTries);
        TryLimit five = four.wrong(t);
        eq("fifth wrong try waits 30 seconds", 30, five.waitSeconds(t));
        eq("the count starts again after the wait", 0, five.failedTries);
        eq("part of a second counts as one", 20, five.waitSeconds(t + 10_500));
        eq("just before the end", 1, five.waitSeconds(t + 29_999));
        eq("over at 30 seconds", 0, five.waitSeconds(t + 30_000));
        eq("a right try clears the wait", 0, five.right().waitSeconds(t));
        eq("a right try clears the count", 0, four.right().failedTries);
        // The time counts from the phone's start, so it goes back to zero when the phone restarts.
        eq("after the phone restarts there is no long wait", 0, new TryLimit(0, 900_000).waitSeconds(5_000));
        // Earlier builds saved the wall clock here. It must not lock anyone out.
        eq("an old wall clock value is ignored", 0, new TryLimit(0, 1_763_800_000_000L).waitSeconds(t));
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    private static void eq(String name, long want, long got) {
        if (want == got) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL " + name + ": want <" + want + "> got <" + got + ">");
        }
    }
}
