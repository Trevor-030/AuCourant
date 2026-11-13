package com.aucourant.parser;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Tries each template in order; the first match wins. A message no template reads comes back
 * as UNREAD with its raw text, so it lands in "Not read" and is never dropped.
 *
 * Order matters: the more specific wordings (reversal, cash in and out, airtime, bills,
 * merchants) go before the plain payment ones. A new network is a new list, not a rewrite.
 */
public final class ParserRegistry {
    private static final ParserRegistry MTN = new ParserRegistry(Arrays.<SmsParser>asList(
            new MtnReversalParser(),
            new MtnCashInParser(),
            new MtnCashOutParser(),
            new MtnAirtimeParser(),
            new MtnBillParser(),
            new MtnMerchantParser(),
            new MtnSentParser(),
            new MtnReceivedParser()));

    private final List<SmsParser> parsers;

    ParserRegistry(List<SmsParser> parsers) {
        this.parsers = Collections.unmodifiableList(parsers);
    }

    public static ParserRegistry mtn() {
        return MTN;
    }

    public ParsedSms parse(String body) {
        if (body != null) {
            for (SmsParser p : parsers) {
                ParsedSms r = p.parse(body);
                if (r != null) return r;
            }
        }
        return ParsedSms.unread(body);
    }
}
