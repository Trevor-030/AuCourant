package com.aucourant.parser;

import java.util.regex.Pattern;

/**
 * Decides what the Reference field holds (architecture.md, "Reference cleaning rules").
 * The raw value is always returned next to the cleaned one, so a wrong rule can be fixed later.
 */
public final class ReferenceCleaner {
    public enum Kind { TYPED, CODE, NONE }

    /** Result of cleaning one Reference field. */
    public static final class Result {
        public final String raw;
        public final String cleaned;
        public final Kind kind;

        Result(String raw, String cleaned, Kind kind) {
            this.raw = raw;
            this.cleaned = cleaned;
            this.kind = kind;
        }
    }

    private static final Pattern ONLY_PUNCTUATION = Pattern.compile("^[\\p{Punct}\\s]*$");
    /** Provisional, from 2 samples: "NAME ,2335xxxxxxx,tf from VODAFONE". */
    private static final Pattern AUTO_FILL = Pattern.compile("^.+?\\s*,\\s*\\+?\\d{9,13}\\s*,.*\\bfrom\\b.*$", Pattern.CASE_INSENSITIVE);
    /** Provisional, no real sample yet: 1 to 3 digits. */
    private static final Pattern CODE = Pattern.compile("^\\d{1,3}$");

    private ReferenceCleaner() {
    }

    public static Result clean(String raw) {
        if (raw == null) return new Result(null, null, Kind.NONE);
        String v = raw.trim();
        while (v.endsWith(".")) v = v.substring(0, v.length() - 1).trim();
        if (v.isEmpty() || ONLY_PUNCTUATION.matcher(v).matches()) return new Result(raw, null, Kind.NONE);
        if (AUTO_FILL.matcher(v).matches()) return new Result(raw, null, Kind.NONE);
        if (CODE.matcher(v).matches()) return new Result(raw, String.valueOf(Integer.parseInt(v)), Kind.CODE);
        return new Result(raw, v.replaceAll("\\s+", " "), Kind.TYPED);
    }
}
