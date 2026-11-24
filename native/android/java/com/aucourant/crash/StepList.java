package com.aucourant.crash;

import java.util.ArrayDeque;
import java.util.Deque;

/** The last few things the app did before a problem. Plain Java, no Android. */
public final class StepList {
    private final int max;
    private final Deque<String> steps = new ArrayDeque<>();

    public StepList(int max) {
        this.max = max;
    }

    public synchronized void add(String step) {
        if (steps.size() >= max) steps.removeFirst();
        steps.addLast(CrashText.redact(step).replaceAll("\\s+", " "));
    }

    public synchronized String text() {
        return String.join("\n", steps);
    }
}
