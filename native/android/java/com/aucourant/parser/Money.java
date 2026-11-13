package com.aucourant.parser;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads amounts like "50.00", "1,234.50", "GHS4,360.00" or "GHS 12,500.00". */
public final class Money {
    private static final Pattern AMOUNT = Pattern.compile(
            "(?:GHS|GHC|GH\\u00A2)?\\s*(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)", Pattern.CASE_INSENSITIVE);

    private Money() {
    }

    /** @return the amount, or null when the text does not start with a number */
    public static Double parse(String text) {
        if (text == null) return null;
        Matcher m = AMOUNT.matcher(text.trim());
        if (!m.lookingAt()) return null;
        try {
            return Double.parseDouble(m.group(1).replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
