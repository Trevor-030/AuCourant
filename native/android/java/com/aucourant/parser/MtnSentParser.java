package com.aucourant.parser;

// PROVISIONAL: no real sample yet. "Payment made for GHS 120.00 to NAME 0201234567 ..."
final class MtnSentParser extends MtnTemplate {
    MtnSentParser() {
        super(TxType.SENT, "\\bPayment (?:made|sent)\\b|\\bYou have sent\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        amountAndParty(b, body, "(?:Payment (?:made|sent) for|You have sent)", "to");
    }
}
