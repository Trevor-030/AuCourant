package com.aucourant.sorting;

import com.aucourant.sorting.Model.PTx;
import com.aucourant.sorting.Model.Parsed;
import com.aucourant.sorting.Model.Row;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Every payment the parser read, with its direction, uncategorised (Personal or business).
 * A port of toPersonalTxs in src/lib/inbox.ts with the same results. Run Categoriser.categoriseAll
 * over the result. The fee is the MoMo fee plus any tax charged on the payment.
 */
public final class PersonalReader {
    private static final Map<String, String> KIND = new HashMap<>();
    private static final Map<String, String> DIRECTION = new HashMap<>();

    static {
        String[][] kinds = {
            {"RECEIVED", "received", "in"}, {"CASH_IN", "cash-in", "in"}, {"REVERSAL", "reversal", "in"},
            {"SENT", "sent", "out"}, {"MERCHANT", "merchant", "out"}, {"BILL", "bill", "out"},
            {"CASH_OUT", "cash-out", "out"}, {"AIRTIME", "airtime", "out"},
        };
        for (String[] k : kinds) {
            KIND.put(k[0], k[1]);
            DIRECTION.put(k[1], k[2]);
        }
    }

    private PersonalReader() {
    }

    private static double cents(double n) {
        return Math.round(n * 100) / 100.0;
    }

    private static boolean blank(String s) {
        return s == null || s.isEmpty();
    }

    /**
     * @param known payments already shown, when `rows` is only the newest part of the inbox
     */
    public static List<PTx> toPersonalTxs(List<Row> rows, List<PTx> known) {
        List<PTx> out = new ArrayList<>();
        // Payments from an earlier scan still give a reversal its person and a bare number its name.
        Map<String, PTx> byTxId = new HashMap<>();
        for (PTx t : known) if (!"reversal".equals(t.kind) && !blank(t.txId)) byTxId.put(t.txId, t);
        for (Row r : Text.ordered(rows)) {
            Parsed p = r.parsed;
            if ("UNREAD".equals(p.type) || !"PARSED".equals(p.status) || p.amount == null) continue;
            String kind = KIND.get(p.type);
            if (kind == null) continue;
            String name;
            String phone = blank(p.counterpartyNumber) ? null : Text.formatPhone(p.counterpartyNumber);
            String personKey;
            String reference = "NONE".equals(p.referenceKind) ? null : p.reference;
            String refundOf = null;
            if ("airtime".equals(kind)) {
                // The user's own top-ups are one "person", not the number that was topped up.
                name = r.sms.body.toLowerCase(Locale.ROOT).contains("data bundle") ? "Data bundle" : "Airtime";
                personKey = "m:airtime";
                reference = null;
            } else if ("merchant".equals(kind) || "bill".equals(kind)) {
                String n = (p.merchant != null ? p.merchant : p.counterpartyName != null ? p.counterpartyName : "").trim();
                name = !n.isEmpty() ? n : "bill".equals(kind) ? "Bill payment" : "Shop payment";
                phone = null;
                personKey = Text.personKeyOf(null, name);
            } else if ("reversal".equals(kind)) {
                // The message only quotes the reversed payment's ID; take the person from that payment.
                PTx original = blank(p.txId) ? null : byTxId.get(p.txId);
                name = original != null ? original.name : "Reversal";
                phone = original != null ? original.phone : null;
                personKey = original != null ? original.personKey : "m:reversal";
                refundOf = original != null ? original.id : null;
            } else {
                name = !blank(p.counterpartyName) ? Text.titleCase(p.counterpartyName) : phone != null ? phone : "Unknown";
                personKey = Text.personKeyOf(phone, name);
            }
            PTx t = new PTx();
            t.id = Text.rowKey(r);
            t.kind = kind;
            t.direction = DIRECTION.get(kind);
            t.amount = p.amount;
            t.fee = cents((p.fee == null ? 0 : p.fee) + (p.tax == null ? 0 : p.tax));
            t.balance = p.balance;
            t.name = name;
            t.phone = phone;
            t.personKey = personKey;
            t.reference = reference;
            String[] s = Text.stamp(r.sms.date);
            t.date = s[0];
            t.time = s[1];
            t.txId = p.txId == null ? "" : p.txId;
            t.raw = r.sms.body;
            t.refundOf = refundOf;
            if (!"reversal".equals(kind) && !t.txId.isEmpty()) byTxId.put(t.txId, t);
            out.add(t);
        }
        // Some messages (cash in) give only a number. Use the name another message gave for it.
        Map<String, String> names = new HashMap<>();
        List<PTx> all = new ArrayList<>(known);
        all.addAll(out);
        for (PTx t : all) if (t.phone != null && !t.name.equals(t.phone)) names.put(t.personKey, t.name);
        for (PTx t : out) if (t.phone != null && t.name.equals(t.phone) && names.containsKey(t.personKey)) t.name = names.get(t.personKey);
        return Text.newestFirst(out);
    }
}
