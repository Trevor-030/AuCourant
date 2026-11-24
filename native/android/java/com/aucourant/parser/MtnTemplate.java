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
    /** One word of a name: letters, with dots, apostrophes and hyphens inside ("J.", "O'NEIL", "OFORIWAA-BOATEMAA"). */
    private static final String WORD = "[A-Za-z][A-Za-z.'\\-]*";
    /** Words that start the next part of the message, so a name never runs into them. */
    private static final String NOT_FIELD =
            "(?!(?i:current|new|balance|bal|reference|ref|transaction|trxn|financial|fee|tax|e-?levy|your|on|at|for|with|has|was|is)\\b)";
    /** The whole name, any case: every word up to a number, punctuation or the next field. */
    private static final String NAME = "(" + NOT_FIELD + WORD + "(?: +" + NOT_FIELD + WORD + ")*)";
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

    /**
     * "{lead} GHS 50.00 {joiner} NAME 0241234567". Name and number are each optional; the number may be in
     * brackets. A number with hidden digits ("054****172") is not a number, but the name before it is kept.
     */
    static void amountAndParty(ParsedSms.Builder b, String body, String lead, String joiner) {
        b.amount = money(Pattern.compile(lead + "\\s*" + AMT, Pattern.CASE_INSENSITIVE), body);
        Matcher m = Pattern.compile("\\b" + joiner + "\\s+" + NAME + "?(?:\\s*\\(?\\s*" + NUMBER + "\\)?)?").matcher(body);
        while (m.find()) {
            if (m.group(1) == null && m.group(2) == null) continue;
            // A name at the end of a sentence keeps its full stop as part of the last word ("BOATENG.").
            b.counterpartyName = m.group(1) == null ? null : m.group(1).replaceAll("[.'\\-]+$", "");
            b.counterpartyNumber = m.group(2);
            return;
        }
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
