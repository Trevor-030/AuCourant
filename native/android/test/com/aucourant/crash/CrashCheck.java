package com.aucourant.crash;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Plain-JDK checks for the problem report (no JUnit, no Android). Run with `npm run test:parser`. */
public final class CrashCheck {
    private static int passed;
    private static int failed;

    private CrashCheck() {
    }

    public static void main(String[] args) {
        text();
        steps();
        tombstone();
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }

    private static void text() {
        eq("phone number hidden", "from # ok", CrashText.redact("from 0241234567 ok"));
        eq("phone number with country code hidden", "+#", CrashText.redact("+233241234567"));
        eq("phone number with spaces hidden", "call # now", CrashText.redact("call 024 123 4567 now"));
        eq("transaction ID hidden", "t:#", CrashText.redact("t:48200000001"));
        eq("bundle position kept", "render@1:1234567", CrashText.redact("render@1:1234567"));
        eq("line number kept", "at a.b.C.d(C.java:123)", CrashText.redact("at a.b.C.d(C.java:123)"));
        eq("null is empty", "", CrashText.redact(null));
        eq("short text kept", "abc", CrashText.trim("abc", 10));
        eq("long text keeps both ends", "abcd\n...\nwxyz", CrashText.trim("abcdefghijklmnopqrstuvwxyz", 8));
        Throwable t = new IllegalStateException("outer 0241234567", new OutOfMemoryError("inner"));
        String s = CrashText.stack(t);
        eq("stack has the error", true, s.startsWith("java.lang.IllegalStateException: outer #"));
        eq("stack has the cause", true, s.contains("Caused by: java.lang.OutOfMemoryError: inner"));
        eq("stack has the place", true, s.contains("CrashCheck.text(CrashCheck.java:"));
    }

    private static void steps() {
        StepList list = new StepList(3);
        for (String x : new String[] {"a", "b", "c", "d"}) list.add(x);
        eq("the newest steps are kept, oldest first", "b\nc\nd", list.text());
        list.add("phone 0241234567\nnext");
        eq("a step is one line, numbers hidden", "c\nd\nphone # next", list.text());
    }

    // ---- Android's native crash record (a protobuf) ---------------------------------

    private static void tombstone() {
        byte[] crashed = thread(77, "mqt_v_js", frame(0x1a2bL, "facebook::jsi::foo()", 16, "/data/app/x/libhermes.so"), frame(0x99L, "", 0, "/apex/libc.so"));
        byte[] other = thread(12, "main", frame(0x1L, "other()", 0, "libother.so"));
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varintField(b, 5, 70);
        varintField(b, 6, 77);
        ByteArrayOutputStream signal = new ByteArrayOutputStream();
        varintField(signal, 1, 6);
        bytesField(signal, 2, utf8("SIGABRT"));
        bytesField(b, 10, signal.toByteArray());
        bytesField(b, 14, utf8("terminating due to uncaught exception, 0241234567"));
        bytesField(b, 16, entry(12, other));
        bytesField(b, 16, entry(77, crashed));
        bytesField(b, 18, utf8("log lines that must not be read"));
        String s = Tombstone.summary(b.toByteArray());
        eq("signal", true, s.contains("Signal: SIGABRT"));
        eq("abort message, numbers hidden", true, s.contains("Message: terminating due to uncaught exception, #"));
        eq("thread that crashed", true, s.contains("Thread: mqt_v_js"));
        eq("frame", true, s.contains("#0 libhermes.so facebook::jsi::foo()+16 (0x1a2b)"));
        eq("frame without a name", true, s.contains("#1 libc.so (0x99)"));
        eq("other threads left out", false, s.contains("other()"));
        eq("logs left out", false, s.contains("log lines"));
        eq("not a record: empty", "", Tombstone.summary(new byte[] {(byte) 0xff, (byte) 0xff, 1}));
        eq("nothing: empty", "", Tombstone.summary(new byte[0]));
        byte[] whole = b.toByteArray();
        boolean safe = true;
        for (int n = 0; n < whole.length; n++) {
            try {
                Tombstone.summary(java.util.Arrays.copyOf(whole, n));
            } catch (RuntimeException e) {
                safe = false;
            }
        }
        eq("a cut-off record never throws", true, safe);
    }

    private static byte[] thread(int id, String name, byte[]... frames) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varintField(b, 1, id);
        bytesField(b, 2, utf8(name));
        for (byte[] f : frames) bytesField(b, 4, f);
        bytesField(b, 5, utf8("memory that must not be read"));
        return b.toByteArray();
    }

    private static byte[] frame(long pc, String function, long offset, String file) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varintField(b, 1, pc);
        varintField(b, 2, 0x7fffffffffffL);
        if (!function.isEmpty()) bytesField(b, 4, utf8(function));
        varintField(b, 5, offset);
        bytesField(b, 6, utf8(file));
        return b.toByteArray();
    }

    private static byte[] entry(int key, byte[] value) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        varintField(b, 1, key);
        bytesField(b, 2, value);
        return b.toByteArray();
    }

    private static byte[] utf8(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    private static void varintField(ByteArrayOutputStream b, int field, long v) {
        varint(b, (long) field << 3);
        varint(b, v);
    }

    private static void bytesField(ByteArrayOutputStream b, int field, byte[] v) {
        varint(b, ((long) field << 3) | 2);
        varint(b, v.length);
        b.write(v, 0, v.length);
    }

    private static void varint(ByteArrayOutputStream b, long v) {
        while ((v & ~0x7fL) != 0) {
            b.write((int) ((v & 0x7f) | 0x80));
            v >>>= 7;
        }
        b.write((int) v);
    }

    private static void eq(String name, Object want, Object got) {
        if (want.equals(got)) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL " + name + ": want <" + want + "> got <" + got + ">");
        }
    }
}
