package com.aucourant.store;

import com.aucourant.sorting.Categoriser;
import com.aucourant.sorting.ChurchSorter;
import com.aucourant.sorting.Json;
import com.aucourant.sorting.Model;
import com.aucourant.sorting.Model.ChurchData;
import com.aucourant.sorting.Model.CodeName;
import com.aucourant.sorting.Model.PTx;
import com.aucourant.sorting.Model.Row;
import com.aucourant.sorting.PersonMerges;
import com.aucourant.sorting.PersonalReader;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * One scan: sorts messages against the saved lists and saves what changed, all inside one Room
 * transaction, so a scan is saved whole or not at all. Returns only the rows it added or changed;
 * the screens merge those into what they show (src/lib/persist.ts mergeScan).
 *
 * The first scan (data source not yet "messages") starts clean: church lists from the codes named
 * at first run, Personal from the default categories, and nothing seen.
 */
public final class Scanner {
    /** Lists cleared by the first scan. Settings and the lock stay. */
    private static final String[] FIRST_SCAN_CLEARS = {
        Kinds.TXS, Kinds.GROUPS, Kinds.MERGES, Kinds.SUGGESTIONS, Kinds.UNREAD, Kinds.CODES, Kinds.SPECIALS,
        Kinds.PTXS, Kinds.CATEGORIES, Kinds.RULES, Kinds.NICKNAMES, Kinds.SEEN, Kinds.CHANGES, Kinds.PERSON_MERGES,
    };

    private static final String[] CHURCH = {
        Kinds.TXS, Kinds.GROUPS, Kinds.MERGES, Kinds.SUGGESTIONS, Kinds.UNREAD, Kinds.CODES,
    };
    private static final Map<String, List<RecordEntity>> NOTHING_SAVED = Collections.emptyMap();

    private Scanner() {
    }

    /** What a scan needs when the screens are not running (the live receiver). */
    public static final class Resume {
        public final long newestSms;
        public final Map<String, Object> opts;

        Resume(long newestSms, Map<String, Object> opts) {
            this.newestSms = newestSms;
            this.opts = opts;
        }
    }

    /** Null before the first scan: the user has to start that one, so nothing is read before it. */
    public static Resume resume(AuCourantDatabase db) {
        StoreDao dao = db.dao();
        if (!"messages".equals(setting(dao, "dataSource"))) return null;
        Object useType = setting(dao, "useType");
        Map<String, Object> opts = new LinkedHashMap<>();
        opts.put("useType", useType instanceof String ? useType : "church");
        return new Resume((long) number(setting(dao, "newestSms")), opts);
    }

    /**
     * @param opts { useType, firstRunCodes: [{code,name}], defaultCategories: [...] }
     * @return { messages, newPayments, first, newestSms, changed: { txs, groups, merges, suggestions, unread, codes, pTxs, categories } }
     */
    public static Map<String, Object> scan(AuCourantDatabase db, List<Row> rows, Map<String, Object> opts) {
        Map<String, Object>[] result = newResult();
        db.runInTransaction(() -> result[0] = run(db.dao(), rows, opts));
        return result[0];
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object>[] newResult() {
        return (Map<String, Object>[]) new Map[1];
    }

    private static Map<String, Object> run(StoreDao dao, List<Row> rows, Map<String, Object> opts) {
        boolean first = !"messages".equals(setting(dao, "dataSource"));
        String useType = Model.str(opts, "useType");

        List<String> ids = new ArrayList<>();
        for (Row r : rows) ids.add(r.sms.id);
        Set<String> seen = first ? new HashSet<>() : dao.known(Kinds.SEEN, ids);
        List<Row> fresh = new ArrayList<>();
        for (Row r : rows) if (!seen.contains(r.sms.id)) fresh.add(r);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("messages", (double) rows.size());
        out.put("first", first);
        Map<String, Object> changed = new LinkedHashMap<>();
        out.put("changed", changed);
        if (!first && fresh.isEmpty()) {
            out.put("newPayments", 0.0);
            out.put("newestSms", number(setting(dao, "newestSms")));
            return out;
        }

        if (first) for (String kind : FIRST_SCAN_CLEARS) dao.clearKind(kind);

        // ---- Church: sort the new messages against the saved groups, codes and merges.
        // Each list is loaded once: it is sorted against, then compared with what came out.
        Map<String, List<RecordEntity>> saved = new HashMap<>();
        for (String kind : CHURCH) saved.put(kind, first ? new ArrayList<>() : dao.all(kind));
        ChurchData before;
        if (first) {
            List<CodeName> names = new ArrayList<>();
            for (Object o : Model.list(opts, "firstRunCodes")) names.add(CodeName.fromJson(Model.asMap(o)));
            before = ChurchSorter.emptyChurch(names);
        } else {
            before = loadChurch(saved);
        }
        // Organisations have no built-in pairs (architecture.md, use type).
        ChurchData next = ChurchSorter.addChurchRows(before, fresh, !"organisation".equals(useType));

        List<Map<String, Object>> txs = new ArrayList<>();
        for (Model.Tx t : next.txs) txs.add(t.toJson());
        List<Map<String, Object>> groups = new ArrayList<>();
        for (Model.Group g : next.groups) groups.add(g.toJson());
        List<Map<String, Object>> merges = new ArrayList<>();
        for (Model.Merge m : next.merges) merges.add(m.toJson());
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (Model.Suggestion s : next.suggestions) suggestions.add(s.toJson());
        List<Map<String, Object>> unread = new ArrayList<>();
        for (Model.Unread u : next.unread) unread.add(u.toJson());
        List<Map<String, Object>> codes = new ArrayList<>();
        for (Map.Entry<String, String> e : next.codes.entrySet()) {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("id", e.getKey());
            c.put("code", e.getKey());
            c.put("groupId", e.getValue());
            codes.add(c);
        }
        changed.put("txs", write(dao, Kinds.TXS, saved, txs, false));
        changed.put("groups", write(dao, Kinds.GROUPS, saved, groups, true));
        changed.put("merges", write(dao, Kinds.MERGES, saved, merges, true));
        changed.put("suggestions", write(dao, Kinds.SUGGESTIONS, saved, suggestions, true));
        changed.put("unread", write(dao, Kinds.UNREAD, saved, unread, false));
        changed.put("codes", write(dao, Kinds.CODES, saved, codes, false));

        // ---- Personal: every row, plus what is already saved, so a reversal finds its person.
        List<PTx> known = new ArrayList<>();
        if (!first) for (RecordEntity r : dao.all(Kinds.PTXS)) known.add(PTx.fromJson(Model.asMap(Json.parse(r.json))));
        Set<String> knownIds = new HashSet<>();
        for (PTx t : known) knownIds.add(t.id);
        List<PTx> added = new ArrayList<>();
        for (PTx t : PersonalReader.toPersonalTxs(rows, known)) if (!knownIds.contains(t.id)) added.add(t);
        // People merged on screen: a new payment from a merged-away number goes to the person it was merged into.
        if (!first) {
            List<Map<String, Object>> personMerges = new ArrayList<>();
            for (RecordEntity r : dao.all(Kinds.PERSON_MERGES)) personMerges.add(Model.asMap(Json.parse(r.json)));
            for (PTx t : added) t.personKey = PersonMerges.resolve(t.personKey, personMerges);
        }
        List<Model.CategoryRule> rules = new ArrayList<>();
        if (!first) for (RecordEntity r : dao.all(Kinds.RULES)) rules.add(Model.CategoryRule.fromJson(Model.asMap(Json.parse(r.json))));
        List<Map<String, Object>> pTxs = new ArrayList<>();
        for (PTx t : Categoriser.categoriseAll(added, rules)) pTxs.add(t.toJson());
        // Only payments that were not saved yet, so there is nothing to compare them with.
        changed.put("pTxs", write(dao, Kinds.PTXS, NOTHING_SAVED, pTxs, false));
        if (first) {
            List<Map<String, Object>> categories = new ArrayList<>();
            for (Object o : Model.list(opts, "defaultCategories")) categories.add(Model.asMap(o));
            changed.put("categories", write(dao, Kinds.CATEGORIES, NOTHING_SAVED, categories, true));
        }

        // Count what this use type shows: payments received and cash in for a church, every payment for Personal.
        out.put("newPayments", (double) ("personal".equals(useType) ? added.size() : next.added));

        // ---- What was read, so the next scan only looks at what is new.
        List<RecordEntity> seenRows = new ArrayList<>();
        long newest = first ? 0 : (long) number(setting(dao, "newestSms"));
        for (Row r : fresh) seenRows.add(new RecordEntity(Kinds.SEEN, r.sms.id, 0, "true"));
        for (Row r : rows) newest = Math.max(newest, r.sms.date);
        dao.upsert(seenRows);
        List<RecordEntity> settings = new ArrayList<>();
        settings.add(new RecordEntity(Kinds.SETTINGS, "dataSource", 0, Json.write("messages")));
        settings.add(new RecordEntity(Kinds.SETTINGS, "newestSms", 0, Json.write((double) newest)));
        dao.upsert(settings);
        out.put("newestSms", (double) newest);
        return out;
    }

    /** Saves the items of `next` that are new or differ from what is saved; returns them. */
    private static List<Object> write(StoreDao dao, String kind, Map<String, List<RecordEntity>> lists, List<Map<String, Object>> next, boolean ordered) {
        Map<String, String> saved = new HashMap<>();
        for (RecordEntity r : lists.getOrDefault(kind, Collections.emptyList())) saved.put(r.id, r.json);
        List<RecordEntity> rows = new ArrayList<>();
        List<Object> changed = new ArrayList<>();
        for (int i = 0; i < next.size(); i++) {
            Map<String, Object> item = next.get(i);
            String id = Model.str(item, "id");
            String json = Json.write(item);
            if (json.equals(saved.get(id))) continue;
            rows.add(new RecordEntity(kind, id, ordered ? i : 0, json));
            changed.add(item);
        }
        if (!rows.isEmpty()) dao.upsert(rows);
        return changed;
    }

    private static ChurchData loadChurch(Map<String, List<RecordEntity>> saved) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("txs", items(saved.get(Kinds.TXS)));
        m.put("groups", items(saved.get(Kinds.GROUPS)));
        m.put("merges", items(saved.get(Kinds.MERGES)));
        m.put("suggestions", items(saved.get(Kinds.SUGGESTIONS)));
        m.put("unread", items(saved.get(Kinds.UNREAD)));
        Map<String, Object> codes = new LinkedHashMap<>();
        for (Object o : items(saved.get(Kinds.CODES))) {
            Map<String, Object> c = Model.asMap(o);
            codes.put(Model.str(c, "code"), Model.str(c, "groupId"));
        }
        m.put("codes", codes);
        return ChurchData.fromJson(m);
    }

    private static List<Object> items(List<RecordEntity> rows) {
        List<Object> out = new ArrayList<>();
        for (RecordEntity r : rows) out.add(Json.parse(r.json));
        return out;
    }

    private static Object setting(StoreDao dao, String key) {
        RecordEntity r = dao.one(Kinds.SETTINGS, key);
        return r == null ? null : Json.parse(r.json);
    }

    private static double number(Object v) {
        return v instanceof Number ? ((Number) v).doubleValue() : 0;
    }
}
