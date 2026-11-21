package com.aucourant.store;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** The saved lists. The names match the `table` values src/lib/persist.ts sends. */
public final class Kinds {
    public static final String TXS = "church_tx";
    public static final String GROUPS = "church_group";
    public static final String MERGES = "merge_record";
    public static final String SUGGESTIONS = "suggestion";
    public static final String UNREAD = "unread";
    /** id = the code, json = { code, groupId }. */
    public static final String CODES = "code_entry";
    public static final String SPECIALS = "special";
    public static final String PTXS = "personal_tx";
    public static final String CATEGORIES = "category";
    public static final String RULES = "category_rule";
    /** id = personKey, json = { personKey, nickname }. */
    public static final String NICKNAMES = "nickname";
    /** id = setting name, json = its value. */
    public static final String SETTINGS = "setting";
    /** id = SMS id already read, json = true. */
    public static final String SEEN = "seen_sms";
    /** The manual-fix record (architecture.md, GroupChange). */
    public static final String CHANGES = "group_change";

    /** Lists the screens may write through StoreModule.save. */
    public static final Set<String> WRITABLE = new HashSet<>(Arrays.asList(
            TXS, GROUPS, MERGES, SUGGESTIONS, UNREAD, CODES, SPECIALS, PTXS, CATEGORIES, RULES, NICKNAMES, CHANGES));

    private Kinds() {
    }
}
