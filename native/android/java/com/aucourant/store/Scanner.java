package com.aucourant.store;

import com.aucourant.sorting.Categoriser;
import com.aucourant.sorting.ChurchSorter;
import com.aucourant.sorting.Json;
import com.aucourant.sorting.Model;
import com.aucourant.sorting.Model.ChurchData;
import com.aucourant.sorting.Model.CodeName;
import com.aucourant.sorting.Model.PTx;
import com.aucourant.sorting.Model.Row;
import com.aucourant.sorting.PersonalReader;

import java.util.ArrayList;
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
        Kinds.PTXS, Kinds.CATEGORIES, Kinds.RULES, Kinds.NICKNAMES, Kinds.SEEN, Kinds.CHANGES,
    };

    private Scanner() {
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

        Set<String> seen = new HashSet<>();
        if (!first) for (RecordEntity r : dao.all(Kinds.SEEN)) seen.add(r.id);
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
        ChurchData before;
        if (first) {
            List<CodeName> names = new ArrayList<>();
            for (Object o : Model.list(opts, "firstRunCodes")) names.add(CodeName.fromJson(Model.asMap(o)));
            before = ChurchSorter.emptyChurch(names);
        } else {
            before = loadChurch(dao);
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
        changed.put("txs", write(dao, Kinds.TXS, txs, false));
        changed.put("groups", write(dao, Kinds.GROUPS, groups, true));
        changed.put("merges", write(dao, Kinds.MERGES, merges, true));
        changed.put("suggestions", write(dao, Kinds.SUGGESTIONS, suggestions, true));
        changed.put("unread", write(dao, Kinds.UNREAD, unread, false));
        changed.put("codes", write(dao, Kinds.CODES, codes, false));

        // ---- Personal: every row, plus what is already saved, so a reversal finds its person.
        List<PTx> known = new ArrayList<>();
        if (!first) for (RecordEntity r : dao.all(Kinds.PTXS)) known.add(PTx.fromJson(Model.asMap(Json.parse(r.json))));
        Set<String> knownIds = new HashSet<>();
        for (PTx t : known) knownIds.add(t.id);
        List<PTx> added = new ArrayList<>();
        for (PTx t : PersonalReader.toPersonalTxs(rows, known)) if (!knownIds.contains(t.id)) added.add(t);
        List<Model.CategoryRule> rules = new ArrayList<>();
        if (!first) for (RecordEntity r : dao.all(Kinds.RULES)) rules.add(Model.CategoryRule.fromJson(Model.asMap(Json.parse(r.json))));
        List<Map<String, Object>> pTxs = new ArrayList<>();
        for (PTx t : Categoriser.categoriseAll(added, rules)) pTxs.add(t.toJson());
        changed.put("pTxs", write(dao, Kinds.PTXS, pTxs, false));
        if (first) {
            List<Map<String, Object>> categories = new ArrayList<>();
            for (Object o : Model.list(opts, "defaultCategories")) categories.add(Model.asMap(o));
            changed.put("categories", write(dao, Kinds.CATEGORIES, categories, true));
        }

        // Count what this use type shows: payments received and cash in for a church, every payment for Personal.
        out.put("newPayments", (double) ("personal".equals(useType) ? added.size() : next.added));

        // ---- What was read, so the next scan only looks at what is new.
        List<RecordEntity> seenRows = new ArrayList<>();
        long newest = first ? 0 : (long) number(setting(dao, "newestSms"));
        for (Row r : rows) {
            seenRows.add(new RecordEntity(Kinds.SEEN, r.sms.id, 0, "true"));
            newest = Math.max(newest, r.sms.date);
        }
        dao.upsert(seenRows);
        List<RecordEntity> settings = new ArrayList<>();
        settings.add(new RecordEntity(Kinds.SETTINGS, "dataSource", 0, Json.write("messages")));
        settings.add(new RecordEntity(Kinds.SETTINGS, "newestSms", 0, Json.write((double) newest)));
        dao.upsert(settings);
        out.put("newestSms", (double) newest);
        return out;
    }

    /** Saves the items of `next` that are new or differ from what is saved; returns them. */
    private static List<Object> write(StoreDao dao, String kind, List<Map<String, Object>> next, boolean ordered) {
        Map<String, String> saved = new HashMap<>();
        for (RecordEntity r : dao.all(kind)) saved.put(r.id, r.json);
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

    static ChurchData loadChurch(StoreDao dao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("txs", items(dao, Kinds.TXS));
        m.put("groups", items(dao, Kinds.GROUPS));
        m.put("merges", items(dao, Kinds.MERGES));
        m.put("suggestions", items(dao, Kinds.SUGGESTIONS));
        m.put("unread", items(dao, Kinds.UNREAD));
        Map<String, Object> codes = new LinkedHashMap<>();
        for (Object o : items(dao, Kinds.CODES)) {
            Map<String, Object> c = Model.asMap(o);
            codes.put(Model.str(c, "code"), Model.str(c, "groupId"));
        }
        m.put("codes", codes);
        return ChurchData.fromJson(m);
    }

    private static List<Object> items(StoreDao dao, String kind) {
        List<Object> out = new ArrayList<>();
        for (RecordEntity r : dao.all(kind)) out.add(Json.parse(r.json));
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
