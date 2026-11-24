package com.aucourant.sorting;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Person merges made on screen (list person_merge), followed by the scan. Same rule as resolveKey in personal-merge.ts. */
public final class PersonMerges {
    private PersonMerges() {
    }

    /** The person a key belongs to after every merge (B into A, then A into C gives C). Stops on a loop. */
    public static String resolve(String key, List<Map<String, Object>> merges) {
        Set<String> seen = new HashSet<>();
        seen.add(key);
        while (true) {
            String to = null;
            for (Map<String, Object> m : merges) {
                if (key.equals(m.get("fromKey"))) {
                    to = (String) m.get("toKey");
                    break;
                }
            }
            if (to == null || !seen.add(to)) return key;
            key = to;
        }
    }
}
