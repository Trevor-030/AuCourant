package com.aucourant.sorting;

import com.aucourant.sorting.Model.ChurchData;
import com.aucourant.sorting.Model.CategoryRule;
import com.aucourant.sorting.Model.CodeName;
import com.aucourant.sorting.Model.PTx;
import com.aucourant.sorting.Model.Row;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Test helper for scripts/java-sorter.js: reads `{ op, ...args }` from a UTF-8 JSON file, runs the
 * Java sorter and prints the result as JSON, so scripts/test-inbox.js checks the code the phone runs.
 */
public final class SortDump {
    private SortDump() {
    }

    public static void main(String[] args) throws Exception {
        Map<String, Object> in = Model.asMap(Json.parse(new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8)));
        Object out;
        switch (Model.str(in, "op")) {
            case "emptyChurch": {
                List<CodeName> names = new ArrayList<>();
                for (Object o : Model.list(in, "codeNames")) names.add(CodeName.fromJson(Model.asMap(o)));
                out = ChurchSorter.emptyChurch(names).toJson();
                break;
            }
            case "addChurchRows":
                out = ChurchSorter.addChurchRows(ChurchData.fromJson(Model.obj(in, "prev")), rows(in), Boolean.TRUE.equals(Model.bool(in, "builtInPairs"))).toJson();
                break;
            case "toPersonalTxs":
                out = ptxJson(PersonalReader.toPersonalTxs(rows(in), ptxs(in, "known")));
                break;
            case "categoriseAll": {
                List<CategoryRule> rules = new ArrayList<>();
                for (Object o : Model.list(in, "rules")) rules.add(CategoryRule.fromJson(Model.asMap(o)));
                out = ptxJson(Categoriser.categoriseAll(ptxs(in, "list"), rules));
                break;
            }
            default:
                throw new IllegalArgumentException("Unknown op " + Model.str(in, "op"));
        }
        new PrintStream(System.out, true, "UTF-8").println(Json.write(out));
    }

    static List<PTx> ptxs(Map<String, Object> in, String key) {
        List<PTx> list = new ArrayList<>();
        for (Object o : Model.list(in, key)) list.add(PTx.fromJson(Model.asMap(o)));
        return list;
    }

    static List<Object> ptxJson(List<PTx> list) {
        List<Object> out = new ArrayList<>();
        for (PTx t : list) out.add(t.toJson());
        return out;
    }

    static List<Row> rows(Map<String, Object> in) {
        List<Row> rows = new ArrayList<>();
        for (Object o : Model.list(in, "rows")) rows.add(Row.fromJson(Model.asMap(o)));
        return rows;
    }
}
