package com.aucourant.parser;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Telecel Cash "You have received". Built from one real message (2026-11-24), money from an MTN wallet (name, number and IDs made up here):
 * "0000012345678901 Confirmed. You have received GHS27.00 from MTN MOBILE MONEY with transaction reference:
 * Transfer From: 233545550172-ESI ADDO  on 2026-06-14 at 11:00:00. Your Telecel Cash balance is GHS43.75."
 * then "Ref: 1." on the next line. Money from another Telecel wallet may be worded differently: until a
 * sample shows it, such a message still counts as received, with whatever name and number can be found.
 */
final class TelecelReceivedParser implements SmsParser {
    private static final Pattern RECOGNISE = Pattern.compile("\\bYou have received\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT = Pattern.compile("You have received\\s*" + MtnTemplate.AMT, Pattern.CASE_INSENSITIVE);
    private static final Pattern TX_ID = Pattern.compile("^\\s*(\\d{8,})\\s+Confirmed\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern BALANCE = Pattern.compile("balance is\\s*" + MtnTemplate.AMT, Pattern.CASE_INSENSITIVE);
    /** "Transfer From: 233545550172-ESI ADDO  on 2026-06-14": number, a hyphen, then the name up to the date. */
    private static final Pattern PARTY = Pattern.compile(
            "Transfer From:\\s*(\\+?\\d{10,12})\\s*-\\s*(.+?)\\s+on\\s+\\d{4}-\\d{2}-\\d{2}", Pattern.CASE_INSENSITIVE);
    /** "Ref: 1." on its own line or before the next sentence. Capital R and a colon, so "transaction reference:" is not it. */
    private static final Pattern REFERENCE = Pattern.compile("\\bRef:\\s*(.*?)(?:\\.\\s+(?=[A-Z])|\\.?\\s*(?:\\n|$))");

    @Override
    public ParsedSms parse(String body) {
        if (body == null || !RECOGNISE.matcher(body).find()) return null;
        ParsedSms.Builder b = new ParsedSms.Builder(TxType.RECEIVED, body);
        b.amount = MtnTemplate.money(AMOUNT, body);
        b.txId = MtnTemplate.group(TX_ID, body);
        b.balance = MtnTemplate.money(BALANCE, body);
        b.rawReference = MtnTemplate.group(REFERENCE, body);
        Matcher m = PARTY.matcher(body);
        if (m.find()) {
            b.counterpartyNumber = m.group(1);
            b.counterpartyName = m.group(2).trim();
        }
        return b.build();
    }
}
