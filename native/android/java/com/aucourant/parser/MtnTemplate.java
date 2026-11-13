package com.aucourant.parser;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared field readers for MTN MoMo messages. Each type is its own subclass that says how to
 * recognise the message and where the amount and the other side are. Fee, tax, balance,
 * reference and transaction ID are read the same way for every type, each on its own, so a
 * change in field order does not break the whole message.
 */
abstract class MtnTemplate implements SmsParser {
    static final String AMT = "(?:GHS|GHC|GH\\u00A2)\\s*([\\d,]+(?:\\.\\d+)?)";
    private static final String NAME = "([A-Z][A-Z .'\\-]*?[A-Z])";
    private static final String NUMBER = "(\\+?\\d{10,12})";

    private static final Pattern FEE = Pattern.compile("(?:Fee charged|Transaction Fee|Fee)\\s*:?\\s*" + AMT, Pattern.CASE_INSENSITIVE);
    private static final Pattern TAX = Pattern.compile("(?:TAX charged|E-?levy|Tax)\\s*:?\\s*" + AMT, Pattern.CASE_INSENSITIVE);
    private static final Pattern BALANCE = Pattern.compile("(?:Current Balance|New Balance|Bal)\\s*:?\\s*" + AMT, Pattern.CASE_INSENSITIVE);
    private static final Pattern TX_ID = Pattern.compile(
            "(?:Transaction ID|Financial Transaction Id|Trxn(?: ID)?)\\s*:?\\s*(\\w[\\w-]*\\d)", Pattern.CASE_INSENSITIVE);
    /** Up to a full stop followed by a space and a capital, or the end of the message. */
    private static final Pattern REFERENCE = Pattern.compile("\\b(?:Reference|Ref)\\b\\s*:?\\s*(.*?)(?:\\.\\s+(?=[A-Z])|\\.?\\s*$)");

    private final TxType type;
    private final Pattern recognise;

    MtnTemplate(TxType type, String recognise) {
        this.type = type;
        this.recognise = Pattern.compile(recognise, Pattern.CASE_INSENSITIVE);
    }

    @Override
    public final ParsedSms parse(String body) {
        if (body == null || !recognise.matcher(body).find()) return null;
        ParsedSms.Builder b = new ParsedSms.Builder(type, body);
        b.fee = money(FEE, body);
        b.tax = money(TAX, body);
        b.balance = money(BALANCE, body);
        b.txId = group(TX_ID, body);
        b.rawReference = group(REFERENCE, body);
        fill(b, body);
        return b.build();
    }

    /** Reads the amount and the other side for this type. */
    abstract void fill(ParsedSms.Builder b, String body);

    // ---- Helpers for subclasses ---------------------------------------------------

    /** "{lead} GHS 50.00 {joiner} NAME 0241234567". Name and number are each optional. */
    static void amountAndParty(ParsedSms.Builder b, String body, String lead, String joiner) {
        b.amount = money(Pattern.compile(lead + "\\s*" + AMT, Pattern.CASE_INSENSITIVE), body);
        Matcher m = Pattern.compile("\\b" + joiner + "\\s+(?:" + NAME + "\\s+)?" + NUMBER).matcher(body);
        if (m.find()) {
            b.counterpartyName = m.group(1);
            b.counterpartyNumber = m.group(2);
            return;
        }
        Matcher n = Pattern.compile("\\b" + joiner + "\\s+" + NAME + "(?=[\\s.,]|$)").matcher(body);
        if (n.find()) b.counterpartyName = n.group(1);
    }

    /** "{lead} GHS 50.00 ... {merchantLead} SHOP NAME {stop}" */
    static void amountAndMerchant(ParsedSms.Builder b, String body, String lead, String merchantLead, String stop) {
        b.amount = money(Pattern.compile(lead + "\\s*" + AMT, Pattern.CASE_INSENSITIVE), body);
        Matcher m = Pattern.compile("\\b" + merchantLead + "\\s+(.+?)\\s*" + stop, Pattern.CASE_INSENSITIVE).matcher(body);
        if (m.find()) b.merchant = m.group(1).trim();
    }

    static Double money(Pattern p, String body) {
        String g = group(p, body);
        return g == null ? null : Money.parse(g);
    }

    static String group(Pattern p, String body) {
        Matcher m = p.matcher(body);
        return m.find() ? m.group(1) : null;
    }
}
