package com.aucourant.parser;

/** "Cash In of GHS50.00 recd frm 0275550163 Ref Welfare. Trxn ... Bal GHS..." Built from a real sample. */
final class MtnCashInParser extends MtnTemplate {
    MtnCashInParser() {
        super(TxType.CASH_IN, "\\bCash In\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        amountAndParty(b, body, "Cash In (?:of|for)", "(?:frm|from)");
    }
}
