package com.aucourant.parser;

// PROVISIONAL: no real sample yet. "Cash Out made for GHS 200.00 to AGENT NAME 0271234567 ..."
final class MtnCashOutParser extends MtnTemplate {
    MtnCashOutParser() {
        super(TxType.CASH_OUT, "\\bCash Out\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        amountAndParty(b, body, "Cash Out (?:made )?(?:for|of)", "to");
    }
}
