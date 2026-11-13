package com.aucourant.parser;

/** "Payment received for GHS 50.00 from NAME 0241234567 ..." Built from real samples. */
final class MtnReceivedParser extends MtnTemplate {
    MtnReceivedParser() {
        super(TxType.RECEIVED, "\\bPayment received\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        amountAndParty(b, body, "Payment received for", "from");
    }
}
