package com.aucourant.parser;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

/**
 * Test helper for scripts/test-inbox.js: parses one message per line of a UTF-8 file with the
 * MTN registry and prints a JSON array. The field names mirror SmsModule.toMap, so the
 * TypeScript side is checked against what the bridge really sends. Keep the two in step.
 */
public final class ParseDump {
    private ParseDump() {
    }

    public static void main(String[] args) throws Exception {
        List<String> bodies = Files.readAllLines(Paths.get(args[0]), StandardCharsets.UTF_8);
        StringBuilder out = new StringBuilder("[");
        for (int i = 0; i < bodies.size(); i++) {
            ParsedSms p = ParserRegistry.mtn().parse(bodies.get(i));
            if (i > 0) out.append(',');
            out.append('{');
            text(out, "type", p.type.name()).append(',');
            text(out, "direction", p.type.direction.name()).append(',');
            text(out, "status", p.status.name()).append(',');
            number(out, "amount", p.amount).append(',');
            number(out, "fee", p.fee).append(',');
            number(out, "tax", p.tax).append(',');
            number(out, "balance", p.balance).append(',');
            text(out, "counterpartyName", p.counterpartyName).append(',');
            text(out, "counterpartyNumber", p.counterpartyNumber).append(',');
            text(out, "merchant", p.merchant).append(',');
            text(out, "rawReference", p.rawReference).append(',');
            text(out, "reference", p.reference).append(',');
            text(out, "referenceKind", p.referenceKind.name()).append(',');
            text(out, "txId", p.txId).append(',');
            text(out, "raw", p.raw);
            out.append('}');
        }
        out.append(']');
        new PrintStream(System.out, true, "UTF-8").println(out);
    }

    private static StringBuilder number(StringBuilder out, String key, Double v) {
        return out.append('"').append(key).append("\":").append(v == null ? "null" : v.toString());
    }

    private static StringBuilder text(StringBuilder out, String key, String v) {
        out.append('"').append(key).append("\":");
        if (v == null) return out.append("null");
        out.append('"');
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
            else out.append(c);
        }
        return out.append('"');
    }
}
