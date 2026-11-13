package com.aucourant.parser;

// PROVISIONAL: no real sample yet. "Payment of GHS 45.50 to merchant SHOP NAME has been completed."
final class MtnMerchantParser extends MtnTemplate {
    MtnMerchantParser() {
        super(TxType.MERCHANT, "\\bto merchant\\b|\\bMerchant ID\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        amountAndMerchant(b, body, "Payment of", "to merchant", "(?:has been|was|\\(|\\.)");
    }
}
