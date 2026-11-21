package com.aucourant.sorting;

import com.aucourant.sorting.Model.CategoryRule;
import com.aucourant.sorting.Model.PTx;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The categoriser (architecture-personal.md), ported from src/lib/categorise.ts. First match wins:
 * 1. person rule, 2. word rule (reference or shop name), 3. built-in type rule, 4. Uncategorised.
 * The TypeScript copy stays for edits on screen; `npm run test:inbox` checks the two agree.
 */
public final class Categoriser {
    /** personal-data.ts TYPE_CATEGORY. */
    private static final Map<String, String> TYPE_CATEGORY = new HashMap<>();

    static {
        TYPE_CATEGORY.put("airtime", "airtime");
        TYPE_CATEGORY.put("bill", "bills");
        TYPE_CATEGORY.put("cash-out", "cash");
    }

    private Categoriser() {
    }

    /** { categoryId, source }, both null when nothing matches. */
    public static String[] categorise(PTx t, List<CategoryRule> rules) {
        for (CategoryRule r : rules) if ("person".equals(r.kind) && r.value.equals(t.personKey)) return new String[] {r.categoryId, "person"};
        String text = Text.normalize((t.reference == null ? "" : t.reference) + " " + t.name);
        for (CategoryRule r : rules) if ("word".equals(r.kind) && text.contains(Text.normalize(r.value))) return new String[] {r.categoryId, "word"};
        String typed = TYPE_CATEGORY.get(t.kind);
        if (typed != null) return new String[] {typed, "type"};
        return new String[] {null, null};
    }

    /** Re-runs the rules over every payment the user has not placed by hand. Inputs are not changed. */
    public static List<PTx> categoriseAll(List<PTx> list, List<CategoryRule> rules) {
        List<PTx> out = new ArrayList<>();
        for (PTx t : list) {
            if ("manual".equals(t.catSource)) {
                out.add(t);
                continue;
            }
            String[] r = categorise(t, rules);
            if (Objects.equals(r[0], t.categoryId) && Objects.equals(r[1], t.catSource)) {
                out.add(t);
                continue;
            }
            PTx c = t.copy();
            c.categoryId = r[0];
            c.catSource = r[1];
            out.add(c);
        }
        return out;
    }
}
