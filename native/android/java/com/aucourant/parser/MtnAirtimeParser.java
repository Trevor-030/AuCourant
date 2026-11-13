package com.aucourant.parser;

import java.util.regex.Pattern;

// PROVISIONAL: no real sample yet. Airtime and data bundles:
// "You have bought GHS 10.00 airtime for 0241234567." / "You have bought a data bundle of GHS 20.00 for 0241234567."
final class MtnAirtimeParser extends MtnTemplate {
    private static final Pattern FIRST_AMOUNT = Pattern.compile(AMT, Pattern.CASE_INSENSITIVE);
    private static final Pattern FOR_NUMBER = Pattern.compile("\\bfor\\s+(\\+?\\d{10,12})");

    MtnAirtimeParser() {
        super(TxType.AIRTIME, "\\bairtime\\b|\\bdata bundle\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        b.amount = money(FIRST_AMOUNT, body);
        b.counterpartyNumber = group(FOR_NUMBER, body);
    }
}
