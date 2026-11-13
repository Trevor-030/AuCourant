package com.aucourant.parser;

import java.util.regex.Pattern;

// PROVISIONAL: no real sample yet. Money coming back to the wallet counts as money in.
// "Reversal of GHS 120.00 for Transaction ID 48298765432 has been credited to your wallet."
final class MtnReversalParser extends MtnTemplate {
    private static final Pattern LEAD_AMOUNT = Pattern.compile("(?:Reversal of|reversed)\\s*" + AMT, Pattern.CASE_INSENSITIVE);
    private static final Pattern FIRST_AMOUNT = Pattern.compile(AMT, Pattern.CASE_INSENSITIVE);

    MtnReversalParser() {
        super(TxType.REVERSAL, "\\breversal\\b|\\breversed\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        b.amount = money(LEAD_AMOUNT, body);
        if (b.amount == null) b.amount = money(FIRST_AMOUNT, body);
    }
}
