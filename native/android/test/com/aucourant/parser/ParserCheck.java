package com.aucourant.parser;

/**
 * Plain-JDK checks for the parser package (no JUnit, no Android). Run with `npm run test:parser`.
 *
 * Samples marked PROVISIONAL are best-guess MTN wording, not real messages. Replace them with
 * real samples (names and numbers hidden) as they arrive and keep these checks green.
 */
public final class ParserCheck {
    private static int passed;
    private static int failed;

    private ParserCheck() {
    }

    public static void main(String[] args) {
        money();
        referenceCleaner();
        received();
        cashIn();
        sent();
        merchant();
        bill();
        cashOut();
        airtime();
        reversal();
        unread();
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    // ---- Money -------------------------------------------------------------------

    private static void money() {
        eq("money plain", 50.0, Money.parse("50.00"));
        eq("money comma", 1234.5, Money.parse("1,234.50"));
        eq("money GHS prefix", 4360.0, Money.parse("GHS4,360.00"));
        eq("money GHS space", 12500.0, Money.parse("GHS 12,500.00"));
        eq("money garbage", null, Money.parse("abc"));
    }

    // ---- Reference cleaner (architecture.md, reference cleaning rules) -------------

    private static void referenceCleaner() {
        ref("typed purpose", "offering.", ReferenceCleaner.Kind.TYPED, "offering");
        ref("collapse spaces", "  Building   fund ", ReferenceCleaner.Kind.TYPED, "Building fund");
        ref("blank", "", ReferenceCleaner.Kind.NONE, null);
        ref("dot only", ".", ReferenceCleaner.Kind.NONE, null);
        ref("dash", "-", ReferenceCleaner.Kind.NONE, null);
        ref("null", null, ReferenceCleaner.Kind.NONE, null);
        ref("auto-fill", "KOFI BOATENG ,233545550172,tf from VODAFONE.", ReferenceCleaner.Kind.NONE, null);
        ref("code", "1", ReferenceCleaner.Kind.CODE, "1");
        ref("code leading zero", "01", ReferenceCleaner.Kind.CODE, "1");
        ref("code three digits", "105.", ReferenceCleaner.Kind.CODE, "105");
        ref("four digits stay typed", "1001", ReferenceCleaner.Kind.TYPED, "1001");
        ref("words win over code", "1 offering", ReferenceCleaner.Kind.TYPED, "1 offering");
    }

    private static void ref(String name, String raw, ReferenceCleaner.Kind kind, String cleaned) {
        ReferenceCleaner.Result r = ReferenceCleaner.clean(raw);
        eq("ref " + name + " kind", kind, r.kind);
        eq("ref " + name + " value", cleaned, r.cleaned);
        eq("ref " + name + " raw kept", raw, r.raw);
    }

    // ---- One check per message type ------------------------------------------------

    private static void received() {
        // Shape from the sample data, built from the real "Payment received" samples.
        ParsedSms p = ParserRegistry.mtn().parse(
                "Payment received for GHS 150.00 from KOFI BOATENG 0545550172. Current Balance: GHS 3,240.50. "
                        + "Reference: offering. Transaction ID: 48212345678. Fee charged: GHS 0.00. TAX charged: GHS 0.00.");
        eq("received type", TxType.RECEIVED, p.type);
        eq("received direction", TxType.Direction.IN, p.type.direction);
        eq("received amount", 150.0, p.amount);
        eq("received name", "KOFI BOATENG", p.counterpartyName);
        eq("received number", "0545550172", p.counterpartyNumber);
        eq("received reference", "offering", p.reference);
        eq("received txId", "48212345678", p.txId);
        eq("received fee", 0.0, p.fee);
        eq("received balance", 3240.5, p.balance);
        eq("received status", ParsedSms.Status.PARSED, p.status);
    }

    private static void cashIn() {
        // Shape from a real Cash In sample (number changed).
        ParsedSms p = ParserRegistry.mtn().parse(
                "Y'ello. Cash In of GHS50.00 recd frm 0275550163 Ref Welfare. Trxn 7741-0293-88 Bal GHS4,360.00. Thank you for using MTN MoMo.");
        eq("cash in type", TxType.CASH_IN, p.type);
        eq("cash in direction", TxType.Direction.IN, p.type.direction);
        eq("cash in amount", 50.0, p.amount);
        eq("cash in number", "0275550163", p.counterpartyNumber);
        eq("cash in reference", "Welfare", p.reference);
        eq("cash in txId", "7741-0293-88", p.txId);
        eq("cash in balance", 4360.0, p.balance);
    }

    private static void sent() {
        // PROVISIONAL wording.
        ParsedSms p = ParserRegistry.mtn().parse(
                "Payment made for GHS 120.00 to AMA OWUSU 0205550118. Current Balance: GHS 1,880.00. Reference: -. "
                        + "Transaction ID: 48298765432. Fee charged: GHS 1.20. TAX charged: GHS 0.00.");
        eq("sent type", TxType.SENT, p.type);
        eq("sent direction", TxType.Direction.OUT, p.type.direction);
        eq("sent amount", 120.0, p.amount);
        eq("sent name", "AMA OWUSU", p.counterpartyName);
        eq("sent number", "0205550118", p.counterpartyNumber);
        eq("sent reference dash is none", null, p.reference);
        eq("sent raw reference kept", "-", p.rawReference);
        eq("sent fee", 1.2, p.fee);
        eq("sent balance", 1880.0, p.balance);
    }

    private static void merchant() {
        // PROVISIONAL wording.
        ParsedSms p = ParserRegistry.mtn().parse(
                "Payment of GHS 45.50 to merchant KASOA FRESH MART has been completed. Current Balance: GHS 1,834.50. "
                        + "Reference: groceries. Transaction ID: 48211112222. Fee charged: GHS 0.00.");
        eq("merchant type", TxType.MERCHANT, p.type);
        eq("merchant direction", TxType.Direction.OUT, p.type.direction);
        eq("merchant amount", 45.5, p.amount);
        eq("merchant name", "KASOA FRESH MART", p.merchant);
        eq("merchant reference", "groceries", p.reference);
    }

    private static void bill() {
        // PROVISIONAL wording.
        ParsedSms p = ParserRegistry.mtn().parse(
                "Your bill payment of GHS 150.00 to ECG PREPAID was successful. Current Balance: GHS 1,684.50. "
                        + "Transaction ID: 48233334444. Fee charged: GHS 0.00.");
        eq("bill type", TxType.BILL, p.type);
        eq("bill direction", TxType.Direction.OUT, p.type.direction);
        eq("bill amount", 150.0, p.amount);
        eq("bill merchant", "ECG PREPAID", p.merchant);
    }

    private static void cashOut() {
        // PROVISIONAL wording.
        ParsedSms p = ParserRegistry.mtn().parse(
                "Cash Out made for GHS 200.00 to KWAME ASANTE 0275550163. Current Balance: GHS 1,482.50. "
                        + "Transaction ID: 48255556666. Fee charged: GHS 2.00. TAX charged: GHS 0.00.");
        eq("cash out type", TxType.CASH_OUT, p.type);
        eq("cash out direction", TxType.Direction.OUT, p.type.direction);
        eq("cash out amount", 200.0, p.amount);
        eq("cash out fee", 2.0, p.fee);
        eq("cash out name", "KWAME ASANTE", p.counterpartyName);
    }

    private static void airtime() {
        // PROVISIONAL wording, airtime and data.
        ParsedSms a = ParserRegistry.mtn().parse(
                "You have bought GHS 10.00 airtime for 0245550134. Current Balance: GHS 1,472.50. Transaction ID: 48277778888.");
        eq("airtime type", TxType.AIRTIME, a.type);
        eq("airtime direction", TxType.Direction.OUT, a.type.direction);
        eq("airtime amount", 10.0, a.amount);
        eq("airtime number", "0245550134", a.counterpartyNumber);
        ParsedSms d = ParserRegistry.mtn().parse(
                "You have bought a data bundle of GHS 20.00 for 0245550134. Current Balance: GHS 1,452.50. Transaction ID: 48277779999.");
        eq("data type", TxType.AIRTIME, d.type);
        eq("data amount", 20.0, d.amount);
    }

    private static void reversal() {
        // PROVISIONAL wording. Money coming back counts as money in.
        ParsedSms p = ParserRegistry.mtn().parse(
                "Reversal of GHS 120.00 for Transaction ID 48298765432 has been credited to your wallet. Current Balance: GHS 1,572.50.");
        eq("reversal type", TxType.REVERSAL, p.type);
        eq("reversal direction", TxType.Direction.IN, p.type.direction);
        eq("reversal amount", 120.0, p.amount);
        eq("reversal txId", "48298765432", p.txId);
    }

    private static void unread() {
        ParsedSms p = ParserRegistry.mtn().parse("Dear customer, dial *170# to check your MoMo promotions.");
        eq("unknown goes to unread", TxType.UNREAD, p.type);
        eq("unknown keeps raw", "Dear customer, dial *170# to check your MoMo promotions.", p.raw);
        ParsedSms partial = ParserRegistry.mtn().parse("Payment received from KOFI BOATENG. Transaction ID: 48200000001.");
        eq("known type without amount is partial", ParsedSms.Status.PARTIAL, partial.status);
        ParsedSms empty = ParserRegistry.mtn().parse(null);
        eq("null body is unread", TxType.UNREAD, empty.type);
    }

    // ---- Assertions --------------------------------------------------------------

    private static void eq(String name, Object want, Object got) {
        boolean ok = want == null ? got == null
                : (want instanceof Double && got instanceof Double)
                        ? Math.abs((Double) want - (Double) got) < 0.001
                        : want.equals(got);
        if (ok) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL " + name + ": want <" + want + "> got <" + got + ">");
        }
    }
}
