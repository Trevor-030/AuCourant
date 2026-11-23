package com.aucourant.parser;

import java.util.Locale;

/**
 * Which messages are read: sender IDs of MoMo payment messages, for the inbox scan and the live
 * receiver. Provisional for MTN MoMo. Confirm against real phones (architecture spike 2).
 */
public final class MomoSenders {
    /** Lower case. A message counts when its sender contains one of these. */
    private static final String[] SENDERS = {"mobilemoney", "mtn momo", "mtnmomo"};

    private MomoSenders() {
    }

    public static boolean matches(String address) {
        if (address == null) return false;
        String a = address.toLowerCase(Locale.ROOT);
        for (String s : SENDERS) if (a.contains(s)) return true;
        return false;
    }
}
