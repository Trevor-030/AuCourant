package com.aucourant.sorting;

import com.aucourant.sorting.Model.ChurchData;
import com.aucourant.sorting.Model.CodeName;
import com.aucourant.sorting.Model.Group;
import com.aucourant.sorting.Model.Merge;
import com.aucourant.sorting.Model.Parsed;
import com.aucourant.sorting.Model.Row;
import com.aucourant.sorting.Model.Suggestion;
import com.aucourant.sorting.Model.Tx;
import com.aucourant.sorting.Model.Unread;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sorts received payments into groups (architecture.md, grouping rules): match key, built-in pairs,
 * the code book, following merges, and suggest-and-confirm. A port of src/lib/inbox.ts with the
 * same results, checked by `npm run test:inbox`. No Android imports, so it runs under plain JDK.
 */
public final class ChurchSorter {
    public static final String NO_REFERENCE = "noref";

    /** Church only: wordings that count as another group at once (architecture.md, grouping rule 3). */
    private static final Map<String, String> BUILT_IN_PAIRS = new HashMap<>();

    static {
        BUILT_IN_PAIRS.put("offertory", "Offering");
        BUILT_IN_PAIRS.put("tithes", "Tithe");
    }

    /** Message types that count as a payment to a church or organisation (founder decision, 2026-11-15). */
    private static final List<String> CHURCH_TYPES = Arrays.asList("RECEIVED", "CASH_IN");

    private ChurchSorter() {
    }

    /** A church with no payments yet: the system group, plus the numbers named at first run. */
    public static ChurchData emptyChurch(List<CodeName> codeNames) {
        ChurchData data = new ChurchData();
        Group none = new Group(NO_REFERENCE, "No reference");
        none.system = true;
        data.groups.add(none);
        for (CodeName c : codeNames) {
            String key = Text.matchKey(c.name);
            if (key.isEmpty()) continue;
            Group g = null;
            for (Group x : data.groups) if (!x.isSystem() && Text.matchKey(x.name).equals(key)) { g = x; break; }
            if (g == null) {
                g = new Group("g:" + key, c.name.trim());
                data.groups.add(g);
            }
            data.codes.put(codeKey(c.code), g.id);
        }
        return data;
    }

    /** String(Number(code)): leading zeros dropped. */
    private static String codeKey(String code) {
        String t = code.trim();
        try {
            return String.valueOf(Long.parseLong(t));
        } catch (NumberFormatException e) {
            return t;
        }
    }

    /** Messages no template could read, or with the amount missing. Newest first. */
    public static List<Unread> unreadOf(List<Row> rows) {
        List<Unread> out = new ArrayList<>();
        for (Row r : rows) {
            if ("PARSED".equals(r.parsed.status)) continue;
            Unread u = new Unread();
            u.id = "u:" + r.sms.id;
            u.raw = r.sms.body;
            String[] s = Text.stamp(r.sms.date);
            u.date = s[0];
            u.time = s[1];
            out.add(u);
        }
        return Text.newestFirst(out);
    }

    /**
     * Adds received payments to the groups. Rows already present are skipped, so a rescan only adds
     * what is new, and everything the treasurer did (renames, merges, moved payments) stays.
     * `prev` is not changed.
     */
    public static ChurchData addChurchRows(ChurchData prev, List<Row> rows, boolean builtInPairs) {
        return new Pass(prev, builtInPairs).run(rows);
    }

    /** One sorting pass over a copy of `prev`. */
    private static final class Pass {
        final List<Group> groups = new ArrayList<>();
        /** Lookups by id and by name key, so each payment costs no regex work per group. */
        final Map<String, Group> byId = new HashMap<>();
        final Map<Group, String> keys = new java.util.IdentityHashMap<>();
        final List<Merge> merges = new ArrayList<>();
        final Map<String, String> codes;
        final List<Tx> txs;
        final Set<String> have = new HashSet<>();
        final Set<String> haveUnread = new HashSet<>();
        final List<String> created = new ArrayList<>();
        final ChurchData prev;
        final boolean builtInPairs;

        Pass(ChurchData prev, boolean builtInPairs) {
            this.prev = prev;
            this.builtInPairs = builtInPairs;
            for (Group g : prev.groups) add(g.copy());
            for (Merge m : prev.merges) merges.add(m.copy());
            codes = new LinkedHashMap<>(prev.codes);
            txs = new ArrayList<>(prev.txs);
            for (Tx t : txs) have.add(t.id);
            for (Unread u : prev.unread) haveUnread.add(u.id);
        }

        void add(Group g) {
            groups.add(g);
            // The first group with an id wins, like Array.prototype.find.
            byId.putIfAbsent(g.id, g);
        }

        Group find(String id) {
            return byId.get(id);
        }

        /** The match key of a group's name. Names do not change during a pass. */
        String keyOf(Group g) {
            String k = keys.get(g);
            if (k == null) keys.put(g, k = Text.matchKey(g.name));
            return k;
        }

        /** An open, typed group with this key: by id first, then by name (a renamed group keeps its wording). */
        Group byKey(String key) {
            Group g = find("g:" + key);
            if (g != null) return g;
            for (Group x : groups) if (!x.isSystem() && x.code == null && !x.isHidden() && keyOf(x).equals(key)) return x;
            return null;
        }

        Group named(String name) {
            String key = Text.matchKey(name);
            Group g = byKey(key);
            if (g == null) {
                g = new Group("g:" + key, Text.capital(name.trim()));
                add(g);
                created.add(g.id);
            }
            return g;
        }

        /** A merged (hidden) group passes its payments on, and the merge remembers them for Undo. */
        String settle(Group start, String txId) {
            Group g = start;
            for (int hops = 0; g.isHidden() && hops < 10; hops++) {
                Merge m = null;
                for (Merge x : merges) if (x.sourceId.equals(g.id)) { m = x; break; }
                Group target = m == null ? null : find(m.targetId);
                if (m == null || target == null) {
                    g.hidden = false;
                    break;
                }
                m.txIds.add(txId);
                g = target;
            }
            return g.id;
        }

        String groupFor(Parsed p, String txId) {
            if ("NONE".equals(p.referenceKind) || p.reference == null || p.reference.isEmpty()) return NO_REFERENCE;
            if ("CODE".equals(p.referenceKind)) {
                String known = codes.get(p.reference);
                Group g = known == null ? null : find(known);
                if (g != null) return settle(g, txId);
                String id = "code-" + p.reference;
                if (find(id) == null) {
                    Group h = new Group(id, "Code " + p.reference);
                    h.code = p.reference;
                    add(h);
                }
                return id;
            }
            String key = Text.matchKey(p.reference);
            if (key.isEmpty()) return NO_REFERENCE;
            Group g = byKey(key);
            if (g == null && builtInPairs && BUILT_IN_PAIRS.containsKey(key)) {
                Group target = named(BUILT_IN_PAIRS.get(key));
                g = new Group("g:" + key, Text.capital(p.reference));
                g.hidden = true;
                add(g);
                Merge m = new Merge();
                m.id = "m:" + key;
                m.sourceId = g.id;
                m.targetId = target.id;
                m.date = "";
                m.builtIn = true;
                merges.add(m);
            }
            return settle(g != null ? g : named(p.reference), txId);
        }

        ChurchData run(List<Row> rows) {
            int added = 0;
            for (Row r : Text.ordered(rows)) {
                Parsed p = r.parsed;
                if (!CHURCH_TYPES.contains(p.type) || !"PARSED".equals(p.status) || p.amount == null) continue;
                String id = Text.rowKey(r);
                if (!have.add(id)) continue;
                String phone = p.counterpartyNumber != null && !p.counterpartyNumber.isEmpty() ? Text.formatPhone(p.counterpartyNumber) : "";
                Tx t = new Tx();
                t.id = id;
                t.sender = p.counterpartyName != null && !p.counterpartyName.isEmpty() ? Text.titleCase(p.counterpartyName) : !phone.isEmpty() ? phone : "Unknown sender";
                t.phone = phone;
                t.amount = p.amount;
                t.fee = p.fee == null ? 0 : p.fee;
                t.groupId = groupFor(p, id);
                t.reference = "NONE".equals(p.referenceKind) ? null : p.reference;
                String[] s = Text.stamp(r.sms.date);
                t.date = s[0];
                t.time = s[1];
                t.txId = p.txId == null ? "" : p.txId;
                t.raw = r.sms.body;
                txs.add(t);
                added++;
            }

            ChurchData out = new ChurchData();
            out.suggestions = suggest();
            List<Unread> unread = new ArrayList<>();
            for (Unread u : unreadOf(rows)) if (!haveUnread.contains(u.id)) unread.add(u);
            unread.addAll(prev.unread);
            out.txs = Text.newestFirst(txs);
            out.groups = groups;
            out.merges = merges;
            out.unread = unread;
            out.codes = codes;
            out.added = added;
            return out;
        }

        /**
         * Suggest and confirm: only pairs with a group that is new in this pass, so a pair the
         * treasurer kept separate is not asked about again.
         */
        List<Suggestion> suggest() {
            Map<Group, String> similar = new java.util.IdentityHashMap<>();
            for (Group g : groups) similar.put(g, Text.similarityKey(g.name));
            Map<String, Integer> count = new HashMap<>();
            for (Tx t : txs) count.merge(t.groupId, 1, Integer::sum);
            List<Group> open = new ArrayList<>();
            for (Group g : groups) if (!g.isSystem() && g.code == null && !g.isHidden()) open.add(g);
            List<Suggestion> suggestions = new ArrayList<>(prev.suggestions);
            Set<String> paired = new HashSet<>();
            for (Suggestion s : suggestions) paired.add(pair(s.keepId, s.mergeId));
            // A pair of two new groups was already compared when the earlier one was `a`.
            Map<Group, Integer> createdAt = new java.util.IdentityHashMap<>();
            for (int i = 0; i < created.size(); i++) {
                Group g = find(created.get(i));
                if (g != null) createdAt.putIfAbsent(g, i);
            }
            // Looked up once, not once per pair: with ~1,700 new groups the pairs run into the millions (speed check).
            int m = open.size();
            String[] openKey = new String[m];
            int[] openAt = new int[m];
            for (int k = 0; k < m; k++) {
                Group b = open.get(k);
                openKey[k] = similar.get(b);
                Integer bi = createdAt.get(b);
                openAt[k] = bi == null ? -1 : bi;
            }
            for (int ai = 0; ai < created.size(); ai++) {
                Group a = find(created.get(ai));
                if (a == null || a.isHidden()) continue;
                String aKey = similar.get(a);
                for (int k = 0; k < m; k++) {
                    if (openAt[k] >= 0 && openAt[k] < ai) continue;
                    Group b = open.get(k);
                    // Cheapest test first: most pairs are not alike.
                    if (b == a || b.id.equals(a.id) || !Text.similarKeys(aKey, openKey[k])) continue;
                    String key = pair(a.id, b.id);
                    if (paired.contains(key)) continue;
                    paired.add(key);
                    // Keep the one with more payments; on a tie, the one that was there first.
                    boolean aWins = count.getOrDefault(a.id, 0) > count.getOrDefault(b.id, 0);
                    Group keep = aWins ? a : b;
                    Group merge = aWins ? b : a;
                    suggestions.add(new Suggestion("s:" + keep.id + "|" + merge.id, keep.id, merge.id));
                }
            }
            return suggestions;
        }

        static String pair(String x, String y) {
            return x.compareTo(y) <= 0 ? x + "|" + y : y + "|" + x;
        }
    }
}
