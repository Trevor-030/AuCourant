package com.aucourant.parser;

// PROVISIONAL: no real sample yet. "Your bill payment of GHS 150.00 to ECG PREPAID was successful."
final class MtnBillParser extends MtnTemplate {
    MtnBillParser() {
        super(TxType.BILL, "\\bbill payment\\b");
    }

    @Override
    void fill(ParsedSms.Builder b, String body) {
        amountAndMerchant(b, body, "bill payment of", "to", "(?:has been|was|\\.)");
    }
}
