package com.aucourant.sorting;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Plain-JDK checks for the sorting helpers (no JUnit, no Android). Run with `npm run test:parser`.
 * The same cases as the helper block of scripts/test-inbox.js, so Java and the old TypeScript agree.
 * The sorters themselves are checked end to end by `npm run test:inbox` through SortDump.
 */
public final class SortCheck {
    private static int passed;
    private static int failed;

    private SortCheck() {
    }

    public static void main(String[] args) {
        text();
        json();
        model();
        speed();
        sameAsPlainDistance();
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    private static void text() {
        eq("titleCase capitals", "Kofi Boateng", Text.titleCase("KOFI BOATENG"));
        eq("titleCase hyphen", "Nana Oforiwaa-Boatemaa", Text.titleCase("NANA OFORIWAA-BOATEMAA"));
        eq("titleCase leaves mixed case", "Kasoa Fresh Mart", Text.titleCase("Kasoa Fresh Mart"));
        eq("formatPhone local", "024 123 4567", Text.formatPhone("0241234567"));
        eq("formatPhone 233", "024 123 4567", Text.formatPhone("233241234567"));
        eq("formatPhone +233", "024 123 4567", Text.formatPhone("+233241234567"));
        eq("formatPhone other shape kept", "12345", Text.formatPhone(" 12345 "));
        eq("matchKey case and full stop", "offering", Text.matchKey("OFFERING."));
        eq("matchKey spaces", "building fund", Text.matchKey("  Building   fund "));
        eq("similar spacing", true, Text.similarNames("Thanksgiving", "Thanks giving"));
        eq("similar spelling", true, Text.similarNames("Harvest", "Havest"));
        eq("not similar", false, Text.similarNames("Offering", "Welfare"));
        eq("short words are not suggested", false, Text.similarNames("Dues", "Due"));
        eq("normalize", "fresh mart", Text.normalize("  Fresh   MART "));
        eq("personKey phone", "0545550172", Text.personKeyOf("054 555 0172", "Kofi"));
        eq("personKey name", "m:kasoa fresh mart", Text.personKeyOf(null, " Kasoa Fresh Mart "));
        long millis = new java.util.GregorianCalendar(2026, 9, 28, 9, 5).getTimeInMillis();
        eq("stamp date", "2026-10-28", Text.stamp(millis)[0]);
        eq("stamp time", "09:05", Text.stamp(millis)[1]);
    }

    private static void json() {
        String src = "{\"a\":[1.5,null,true,\"x\\\"y\"],\"b\":20,\"c\":{}}";
        eq("json round trip", src, Json.write(Json.parse(src)));
        eq("json whole number has no decimals", "[20,0.75,-3]", Json.write(Json.parse("[20.0, 0.75, -3]")));
        eq("json unicode escape", "\u00e9", ((List<?>) Json.parse("[\"\\u00e9\"]")).get(0));
        eq("json control characters escaped", "\"a\\nb\"", Json.write("a\nb"));
    }

    private static void model() {
        String tx = "{\"id\":\"t:1\",\"sender\":\"Esi Addo\",\"phone\":\"054 555 0108\",\"amount\":20,\"fee\":0,\"groupId\":\"noref\","
                + "\"reference\":null,\"date\":\"2026-10-28\",\"time\":\"09:00\",\"txId\":\"1\",\"raw\":\"r\"}";
        eq("tx round trip", tx, Json.write(Model.Tx.fromJson(map(tx)).toJson()));
        String group = "{\"id\":\"code-5\",\"name\":\"Code 5\",\"code\":\"5\"}";
        eq("group leaves out unset flags", group, Json.write(Model.Group.fromJson(map(group)).toJson()));
        String merge = "{\"id\":\"m:offertory\",\"sourceId\":\"g:offertory\",\"targetId\":\"g:offering\",\"txIds\":[\"t:1\"],\"date\":\"\",\"builtIn\":true}";
        eq("merge round trip", merge, Json.write(Model.Merge.fromJson(map(merge)).toJson()));
        String ptx = "{\"id\":\"t:2\",\"kind\":\"cash-in\",\"direction\":\"in\",\"amount\":100,\"fee\":1.75,\"balance\":null,\"name\":\"Ama\","
                + "\"phone\":null,\"personKey\":\"m:ama\",\"reference\":null,\"date\":\"2026-10-28\",\"time\":\"10:00\",\"txId\":\"2\",\"raw\":\"r\","
                + "\"categoryId\":null,\"catSource\":null}";
        eq("personal tx round trip", ptx, Json.write(Model.PTx.fromJson(map(ptx)).toJson()));
        eq("lists", Arrays.asList("a", "b"), Model.strings(Json.parse("[\"a\",\"b\"]")));
    }

    /**
     * Final review, Important 3: sorting must stay fast with many different references, so the first
     * scan of a large inbox does not sit at 100%. 5,000 payments, about 1,700 references.
     */
    private static void speed() {
        List<Model.Row> rows = new java.util.ArrayList<>();
        String[] words = {"offering", "tithe", "welfare", "harvest", "building", "youth", "choir", "mission", "thanks", "dues"};
        for (int i = 0; i < 5000; i++) {
            Model.Sms sms = new Model.Sms();
            sms.id = String.valueOf(i);
            sms.body = "body " + i;
            sms.date = 1_700_000_000_000L + i * 60_000L;
            Model.Parsed p = new Model.Parsed();
            p.type = "RECEIVED";
            p.status = "PARSED";
            p.amount = 20.0;
            p.counterpartyName = "GIVER " + (i % 300);
            p.counterpartyNumber = "0245550" + String.format("%03d", i % 1000);
            p.referenceKind = "TYPED";
            p.reference = words[i % words.length] + " " + (char) ('a' + i % 26) + (char) ('a' + (i / 26) % 26) + (char) ('a' + (i / 676) % 3);
            p.txId = "9" + i;
            rows.add(new Model.Row(sms, p));
        }
        long start = System.nanoTime();
        Model.ChurchData out = ChurchSorter.addChurchRows(ChurchSorter.emptyChurch(new java.util.ArrayList<>()), rows, true);
        long ms = (System.nanoTime() - start) / 1_000_000;
        eq("speed: every payment sorted", 5000, out.added);
        eq("speed: 5,000 payments with ~1,700 references in under 2 s (took " + ms + " ms)", true, ms < 2000);
    }

    /** The fast similarity test must give the same answer as the plain edit distance it replaces. */
    private static void sameAsPlainDistance() {
        java.util.Random r = new java.util.Random(7);
        int differ = 0;
        for (int k = 0; k < 20000; k++) {
            String x = random(r);
            String y = r.nextInt(3) == 0 ? mutate(x, r) : random(r);
            boolean want;
            if (x.isEmpty() || y.isEmpty()) want = false;
            else if (x.equals(y)) want = true;
            else if (Math.min(x.length(), y.length()) < 4) want = false;
            else want = 1 - (double) plain(x, y) / Math.max(x.length(), y.length()) >= Text.SUGGEST_AT;
            if (want != Text.similarKeys(x, y)) differ++;
        }
        eq("similarity: banded distance agrees with the plain one on 20,000 pairs", 0, differ);
    }

    private static String random(java.util.Random r) {
        StringBuilder b = new StringBuilder();
        int n = 3 + r.nextInt(12);
        for (int i = 0; i < n; i++) b.append((char) ('a' + r.nextInt(4)));
        return b.toString();
    }

    private static String mutate(String x, java.util.Random r) {
        StringBuilder b = new StringBuilder(x);
        for (int e = r.nextInt(4); e > 0 && b.length() > 1; e--) {
            int at = r.nextInt(b.length());
            switch (r.nextInt(3)) {
                case 0: b.deleteCharAt(at); break;
                case 1: b.insert(at, (char) ('a' + r.nextInt(4))); break;
                default: b.setCharAt(at, (char) ('a' + r.nextInt(4)));
            }
        }
        return b.toString();
    }

    private static int plain(String a, String b) {
        int[] prev = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            int[] row = new int[b.length() + 1];
            row[0] = i;
            for (int j = 1; j <= b.length(); j++) row[j] = Math.min(Math.min(prev[j] + 1, row[j - 1] + 1), prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            prev = row;
        }
        return prev[b.length()];
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(String json) {
        return (Map<String, Object>) Json.parse(json);
    }

    private static void eq(String name, Object want, Object got) {
        boolean ok = want == null ? got == null : want.equals(got);
        if (ok) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL " + name + ": want <" + want + "> got <" + got + ">");
        }
    }
}
