package com.aucourant.crash;

import java.io.PrintWriter;
import java.io.StringWriter;

/** The text of a problem report. Plain Java, no Android. */
public final class CrashText {
    private CrashText() {
    }

    /**
     * Hides phone numbers and transaction IDs, which an error message may quote. Positions in the
     * JavaScript bundle have at most 7 or 8 digits and are kept.
     */
    public static String redact(String s) {
        if (s == null) return "";
        return s.replaceAll("\\b0\\d{2} \\d{3} \\d{4}\\b", "#").replaceAll("\\d{9,}", "#");
    }

    /** Keeps both ends of a long text: the error is at the start, its cause often at the end. */
    public static String trim(String s, int max) {
        if (s.length() <= max) return s;
        int half = max / 2;
        return s.substring(0, half) + "\n...\n" + s.substring(s.length() - half);
    }

    public static String stack(Throwable t) {
        StringWriter out = new StringWriter();
        t.printStackTrace(new PrintWriter(out, true));
        return redact(out.toString().trim());
    }
}
