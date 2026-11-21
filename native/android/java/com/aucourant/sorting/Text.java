package com.aucourant.sorting;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Text and ordering helpers, ported from src/lib/inbox.ts and src/lib/format.ts. Same results. */
public final class Text {
    /** Similar names at or above this score are suggested as a merge. Tune with real references (spike 3). */
    static final double SUGGEST_AT = 0.8;

    private static final Pattern PUNCT = Pattern.compile("[.,;:!?'\"`()\\[\\]{}\\-_/\\\\*&@#+=<>|~^%$]");
    private static final Pattern SPACES = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern WORD_START = Pattern.compile("(^|[\\s\\-'.])([a-z])", Pattern.UNICODE_CHARACTER_CLASS);

    private Text() {
    }

    /** Lower case, punctuation removed, single spaces. Two references with the same key are one group. */
    public static String matchKey(String reference) {
        String v = PUNCT.matcher(reference.toLowerCase(Locale.ROOT)).replaceAll(" ");
        return SPACES.matcher(v).replaceAll(" ").trim();
    }

    /** format.ts normalize: trimmed, lower case, single spaces. */
    public static String normalize(String s) {
        return SPACES.matcher(s.trim().toLowerCase(Locale.ROOT)).replaceAll(" ");
    }

    /** "KOFI BOATENG" becomes "Kofi Boateng". MTN writes names in capitals; other wording is kept. */
    public static String titleCase(String name) {
        String n = SPACES.matcher(name.trim()).replaceAll(" ");
        if (!n.equals(n.toUpperCase(Locale.ROOT))) return n;
        Matcher m = WORD_START.matcher(n.toLowerCase(Locale.ROOT));
        StringBuffer out = new StringBuffer();
        while (m.find()) m.appendReplacement(out, Matcher.quoteReplacement(m.group(1) + m.group(2).toUpperCase(Locale.ROOT)));
        m.appendTail(out);
        return out.toString();
    }

    /** "0241234567" and "233241234567" become "024 123 4567". Other shapes are kept as written. */
    public static String formatPhone(String number) {
        String d = number.replaceAll("\\D", "");
        if (d.length() == 12 && d.startsWith("233")) d = "0" + d.substring(3);
        return d.length() == 10 ? d.substring(0, 3) + " " + d.substring(3, 6) + " " + d.substring(6) : number.trim();
    }

    /** personal-data.ts personKeyOf: the digits of the number, or "m:" and the lower-case name. */
    public static String personKeyOf(String phone, String name) {
        return phone != null && !phone.isEmpty() ? phone.replaceAll("\\D", "") : "m:" + name.trim().toLowerCase(Locale.ROOT);
    }

    /** True for spacing differences ("Thanks giving") and near spellings ("Havest"). Never joins by itself. */
    public static boolean similarNames(String a, String b) {
        return similarKeys(similarityKey(a), similarityKey(b));
    }

    /** The match key without spaces: what similarNames compares. Work it out once per name. */
    public static String similarityKey(String name) {
        return matchKey(name).replace(" ", "");
    }

    /** similarNames on keys from similarityKey. */
    public static boolean similarKeys(String x, String y) {
        if (x.isEmpty() || y.isEmpty()) return false;
        if (x.equals(y)) return true;
        if (Math.min(x.length(), y.length()) < 4) return false;
        int max = Math.max(x.length(), y.length());
        // 1 - d / max >= SUGGEST_AT  <=>  d <= (1 - SUGGEST_AT) * max. The distance is at least the length gap.
        int limit = (int) Math.floor((1 - SUGGEST_AT) * max + 1e-9);
        if (Math.abs(x.length() - y.length()) > limit) return false;
        int d = levenshtein(x, y, limit);
        return d <= limit && 1 - (double) d / max >= SUGGEST_AT;
    }

    /**
     * Edit distance, or limit + 1 as soon as it must be larger than `limit`. Only cells within
     * `limit` of the diagonal can stay within the limit, so the rest are skipped (Ukkonen's band).
     */
    private static int levenshtein(String a, String b, int limit) {
        int n = b.length();
        int over = limit + 1;
        int[] prev = new int[n + 1];
        int[] row = new int[n + 1];
        for (int j = 0; j <= n; j++) prev[j] = j <= limit ? j : over;
        for (int i = 1; i <= a.length(); i++) {
            int from = Math.max(1, i - limit);
            int to = Math.min(n, i + limit);
            row[0] = i <= limit ? i : over;
            if (from > 1) row[from - 1] = over;
            int best = row[0];
            char ca = a.charAt(i - 1);
            for (int j = from; j <= to; j++) {
                int v = Math.min(Math.min(prev[j] + 1, row[j - 1] + 1), prev[j - 1] + (ca == b.charAt(j - 1) ? 0 : 1));
                if (v > over) v = over;
                row[j] = v;
                if (v < best) best = v;
            }
            if (to < n) row[to + 1] = over;
            // Every later row is at least this row's smallest value.
            if (best > limit) return over;
            int[] t = prev;
            prev = row;
            row = t;
        }
        return Math.min(prev[n], over);
    }

    /** Phone time of the message as { "2026-10-28", "09:05" }, in the phone's own time zone. */
    public static String[] stamp(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        String date = String.format(Locale.ROOT, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
        String time = String.format(Locale.ROOT, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
        return new String[] {date, time};
    }

    static String capital(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    /**
     * The transaction ID is the unique key, so reading the same message twice does nothing.
     * A reversal quotes the ID of the payment it reverses, so it gets its own key.
     */
    public static String rowKey(Model.Row r) {
        String txId = r.parsed.txId;
        if (txId == null || txId.isEmpty()) return "s:" + r.sms.id;
        return ("REVERSAL".equals(r.parsed.type) ? "r:" : "t:") + txId;
    }

    /** Oldest first, one row per transaction. */
    public static List<Model.Row> ordered(List<Model.Row> rows) {
        List<Model.Row> sorted = new ArrayList<>(rows);
        Collections.sort(sorted, (a, b) -> Long.compare(a.sms.date, b.sms.date));
        Set<String> seen = new HashSet<>();
        List<Model.Row> out = new ArrayList<>();
        for (Model.Row r : sorted) if (seen.add(rowKey(r))) out.add(r);
        return out;
    }

    /** Newest first by date, then time. Stable, like Array.prototype.sort. */
    public static <T extends Model.Dated> List<T> newestFirst(List<T> list) {
        Collections.sort(list, (a, b) -> a.date().equals(b.date()) ? b.time().compareTo(a.time()) : b.date().compareTo(a.date()));
        return list;
    }
}
