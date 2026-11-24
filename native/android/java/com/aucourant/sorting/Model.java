package com.aucourant.sorting;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Plain mirrors of the TypeScript types the sorter reads and writes (src/lib/data.ts,
 * src/lib/personal-data.ts, src/native/index.ts). Field names and key order match the TS objects,
 * and optional fields are left out when unset, so JSON from Java equals JSON from the old TS code.
 */
public final class Model {
    private Model() {
    }

    /** Anything listed newest first. */
    public interface Dated {
        String date();

        String time();
    }

    // ---- Messages ------------------------------------------------------------------

    /** SmsNative.readInbox row. */
    public static final class Sms {
        public String id;
        public String address;
        public String body;
        public long date;

        public static Sms fromJson(Map<String, Object> m) {
            Sms s = new Sms();
            s.id = str(m, "id");
            s.address = str(m, "address");
            s.body = str(m, "body");
            Double d = dbl(m, "date");
            s.date = d == null ? 0 : d.longValue();
            return s;
        }
    }

    /** SmsModule.toMap / ParseDump fields. */
    public static final class Parsed {
        public String type;
        public String direction;
        public String status;
        public Double amount;
        public Double fee;
        public Double tax;
        public Double balance;
        public String counterpartyName;
        public String counterpartyNumber;
        public String merchant;
        public String rawReference;
        public String reference;
        public String referenceKind;
        public String txId;
        public String raw;

        public static Parsed fromJson(Map<String, Object> m) {
            Parsed p = new Parsed();
            p.type = str(m, "type");
            p.direction = str(m, "direction");
            p.status = str(m, "status");
            p.amount = dbl(m, "amount");
            p.fee = dbl(m, "fee");
            p.tax = dbl(m, "tax");
            p.balance = dbl(m, "balance");
            p.counterpartyName = str(m, "counterpartyName");
            p.counterpartyNumber = str(m, "counterpartyNumber");
            p.merchant = str(m, "merchant");
            p.rawReference = str(m, "rawReference");
            p.reference = str(m, "reference");
            p.referenceKind = str(m, "referenceKind");
            p.txId = str(m, "txId");
            p.raw = str(m, "raw");
            return p;
        }
    }

    /** inbox.ts InboxRow: one message and what the parser read from it. */
    public static final class Row {
        public Sms sms;
        public Parsed parsed;

        public Row(Sms sms, Parsed parsed) {
            this.sms = sms;
            this.parsed = parsed;
        }

        public static Row fromJson(Map<String, Object> m) {
            return new Row(Sms.fromJson(obj(m, "sms")), Parsed.fromJson(obj(m, "parsed")));
        }
    }

    // ---- Church and organisation ---------------------------------------------------

    public static final class Tx implements Dated {
        public String id;
        public String sender;
        public String phone;
        public double amount;
        public double fee;
        public String groupId;
        public String reference;
        public String date;
        public String time;
        public String txId;
        public String raw;

        public String date() {
            return date;
        }

        public String time() {
            return time;
        }

        public static Tx fromJson(Map<String, Object> m) {
            Tx t = new Tx();
            t.id = str(m, "id");
            t.sender = str(m, "sender");
            t.phone = str(m, "phone");
            t.amount = num(m, "amount");
            t.fee = num(m, "fee");
            t.groupId = str(m, "groupId");
            t.reference = str(m, "reference");
            t.date = str(m, "date");
            t.time = str(m, "time");
            t.txId = str(m, "txId");
            t.raw = str(m, "raw");
            return t;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("sender", sender);
            m.put("phone", phone);
            m.put("amount", amount);
            m.put("fee", fee);
            m.put("groupId", groupId);
            m.put("reference", reference);
            m.put("date", date);
            m.put("time", time);
            m.put("txId", txId);
            m.put("raw", raw);
            return m;
        }
    }

    /** `code` marks a holding group for an unnamed number reference, like Code 5. Null flags are absent. */
    public static final class Group {
        public String id;
        public String name;
        public Boolean system;
        public Boolean hidden;
        public String code;

        public Group(String id, String name) {
            this.id = id;
            this.name = name;
        }

        public boolean isHidden() {
            return Boolean.TRUE.equals(hidden);
        }

        public boolean isSystem() {
            return Boolean.TRUE.equals(system);
        }

        public static Group fromJson(Map<String, Object> m) {
            Group g = new Group(str(m, "id"), str(m, "name"));
            g.system = bool(m, "system");
            g.hidden = bool(m, "hidden");
            g.code = str(m, "code");
            return g;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("name", name);
            if (system != null) m.put("system", system);
            if (hidden != null) m.put("hidden", hidden);
            if (code != null) m.put("code", code);
            return m;
        }

        Group copy() {
            Group g = new Group(id, name);
            g.system = system;
            g.hidden = hidden;
            g.code = code;
            return g;
        }
    }

    public static final class Merge {
        public String id;
        public String sourceId;
        public String targetId;
        public List<String> txIds = new ArrayList<>();
        public String date;
        public Boolean builtIn;
        public String code;
        public String createdGroupId;

        public static Merge fromJson(Map<String, Object> m) {
            Merge x = new Merge();
            x.id = str(m, "id");
            x.sourceId = str(m, "sourceId");
            x.targetId = str(m, "targetId");
            x.txIds = strings(m.get("txIds"));
            x.date = str(m, "date");
            x.builtIn = bool(m, "builtIn");
            x.code = str(m, "code");
            x.createdGroupId = str(m, "createdGroupId");
            return x;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("sourceId", sourceId);
            m.put("targetId", targetId);
            m.put("txIds", new ArrayList<Object>(txIds));
            m.put("date", date);
            if (builtIn != null) m.put("builtIn", builtIn);
            if (code != null) m.put("code", code);
            if (createdGroupId != null) m.put("createdGroupId", createdGroupId);
            return m;
        }

        Merge copy() {
            Merge x = fromJson(toJson());
            x.txIds = new ArrayList<>(txIds);
            return x;
        }
    }

    public static final class Suggestion {
        public String id;
        public String keepId;
        public String mergeId;

        public Suggestion(String id, String keepId, String mergeId) {
            this.id = id;
            this.keepId = keepId;
            this.mergeId = mergeId;
        }

        public static Suggestion fromJson(Map<String, Object> m) {
            return new Suggestion(str(m, "id"), str(m, "keepId"), str(m, "mergeId"));
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("keepId", keepId);
            m.put("mergeId", mergeId);
            return m;
        }
    }

    /** A message no template could read. Kept with its text, never dropped. */
    public static final class Unread implements Dated {
        public String id;
        public String raw;
        public String date;
        public String time;

        public String date() {
            return date;
        }

        public String time() {
            return time;
        }

        public static Unread fromJson(Map<String, Object> m) {
            Unread u = new Unread();
            u.id = str(m, "id");
            u.raw = str(m, "raw");
            u.date = str(m, "date");
            u.time = str(m, "time");
            return u;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("raw", raw);
            m.put("date", date);
            m.put("time", time);
            return m;
        }
    }

    public static final class CodeName {
        public final String code;
        public final String name;

        public CodeName(String code, String name) {
            this.code = code;
            this.name = name;
        }

        public static CodeName fromJson(Map<String, Object> m) {
            return new CodeName(str(m, "code"), str(m, "name"));
        }
    }

    /** inbox.ts ChurchData, plus how many payments the last pass added. */
    public static final class ChurchData {
        public List<Tx> txs = new ArrayList<>();
        public List<Group> groups = new ArrayList<>();
        public List<Merge> merges = new ArrayList<>();
        public List<Suggestion> suggestions = new ArrayList<>();
        public List<Unread> unread = new ArrayList<>();
        /** Code book: number code to group id. */
        public Map<String, String> codes = new LinkedHashMap<>();
        public int added;

        public static ChurchData fromJson(Map<String, Object> m) {
            ChurchData d = new ChurchData();
            for (Object o : list(m, "txs")) d.txs.add(Tx.fromJson(asMap(o)));
            for (Object o : list(m, "groups")) d.groups.add(Group.fromJson(asMap(o)));
            for (Object o : list(m, "merges")) d.merges.add(Merge.fromJson(asMap(o)));
            for (Object o : list(m, "suggestions")) d.suggestions.add(Suggestion.fromJson(asMap(o)));
            for (Object o : list(m, "unread")) d.unread.add(Unread.fromJson(asMap(o)));
            Object codes = m.get("codes");
            if (codes instanceof Map) for (Map.Entry<?, ?> e : ((Map<?, ?>) codes).entrySet()) d.codes.put(String.valueOf(e.getKey()), String.valueOf(e.getValue()));
            return d;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            List<Object> a = new ArrayList<>();
            for (Tx t : txs) a.add(t.toJson());
            m.put("txs", a);
            a = new ArrayList<>();
            for (Group g : groups) a.add(g.toJson());
            m.put("groups", a);
            a = new ArrayList<>();
            for (Merge x : merges) a.add(x.toJson());
            m.put("merges", a);
            a = new ArrayList<>();
            for (Suggestion s : suggestions) a.add(s.toJson());
            m.put("suggestions", a);
            a = new ArrayList<>();
            for (Unread u : unread) a.add(u.toJson());
            m.put("unread", a);
            m.put("codes", new LinkedHashMap<String, Object>(codes));
            m.put("added", (double) added);
            return m;
        }
    }

    // ---- Personal or business ------------------------------------------------------

    public static final class PTx implements Dated {
        public String id;
        public String kind;
        public String direction;
        public double amount;
        public double fee;
        public Double balance;
        public String name;
        public String phone;
        public String personKey;
        public String reference;
        public String date;
        public String time;
        public String txId;
        public String raw;
        public String categoryId;
        public String catSource;
        /** The id of the payment this one gives back (a reversal, or marked by hand), or null. */
        public String refundOf;

        public String date() {
            return date;
        }

        public String time() {
            return time;
        }

        public static PTx fromJson(Map<String, Object> m) {
            PTx t = new PTx();
            t.id = str(m, "id");
            t.kind = str(m, "kind");
            t.direction = str(m, "direction");
            t.amount = num(m, "amount");
            t.fee = num(m, "fee");
            t.balance = dbl(m, "balance");
            t.name = str(m, "name");
            t.phone = str(m, "phone");
            t.personKey = str(m, "personKey");
            t.reference = str(m, "reference");
            t.date = str(m, "date");
            t.time = str(m, "time");
            t.txId = str(m, "txId");
            t.raw = str(m, "raw");
            t.categoryId = str(m, "categoryId");
            t.catSource = str(m, "catSource");
            t.refundOf = str(m, "refundOf");
            return t;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("kind", kind);
            m.put("direction", direction);
            m.put("amount", amount);
            m.put("fee", fee);
            m.put("balance", balance);
            m.put("name", name);
            m.put("phone", phone);
            m.put("personKey", personKey);
            m.put("reference", reference);
            m.put("date", date);
            m.put("time", time);
            m.put("txId", txId);
            m.put("raw", raw);
            m.put("categoryId", categoryId);
            m.put("catSource", catSource);
            m.put("refundOf", refundOf);
            return m;
        }

        PTx copy() {
            return fromJson(toJson());
        }
    }

    public static final class CategoryRule {
        public String id;
        public String kind;
        public String value;
        public String label;
        public String categoryId;

        public static CategoryRule fromJson(Map<String, Object> m) {
            CategoryRule r = new CategoryRule();
            r.id = str(m, "id");
            r.kind = str(m, "kind");
            r.value = str(m, "value");
            r.label = str(m, "label");
            r.categoryId = str(m, "categoryId");
            return r;
        }

        public Map<String, Object> toJson() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("kind", kind);
            m.put("value", value);
            m.put("label", label);
            m.put("categoryId", categoryId);
            return m;
        }
    }

    // ---- JSON access ---------------------------------------------------------------

    public static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? null : v instanceof Double ? Json.write(v) : String.valueOf(v);
    }

    public static Double dbl(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v instanceof Number ? ((Number) v).doubleValue() : null;
    }

    static double num(Map<String, Object> m, String k) {
        Double v = dbl(m, k);
        return v == null ? 0 : v;
    }

    public static Boolean bool(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v instanceof Boolean ? (Boolean) v : null;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> asMap(Object o) {
        return (Map<String, Object>) o;
    }

    public static Map<String, Object> obj(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v instanceof Map ? asMap(v) : new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    public static List<Object> list(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v instanceof List ? (List<Object>) v : new ArrayList<>();
    }

    public static List<String> strings(Object v) {
        List<String> out = new ArrayList<>();
        if (v instanceof List) for (Object o : (List<?>) v) out.add(String.valueOf(o));
        return out;
    }
}
