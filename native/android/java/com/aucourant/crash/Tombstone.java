package com.aucourant.crash;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads Android's record of a native crash (a protobuf, Android 12 and later): the signal, the abort
 * message and the stack of the thread that crashed. Memory, registers, logs and other threads are
 * skipped, because they can hold the user's data. Plain Java, no Android.
 *
 * Field numbers: system/core/debuggerd/proto/tombstone.proto in the Android source.
 */
public final class Tombstone {
    private static final int MAX_FRAMES = 40;

    private Tombstone() {
    }

    /** Empty when there is nothing readable. Never throws: a report must not cause a problem of its own. */
    public static String summary(byte[] bytes) {
        try {
            return read(bytes);
        } catch (RuntimeException e) {
            return "";
        }
    }

    private static String read(byte[] bytes) {
        long crashed = -1;
        String signal = "";
        String message = "";
        List<byte[]> threads = new ArrayList<>();
        Reader r = new Reader(bytes);
        while (r.next()) {
            if (r.field == 6) crashed = r.number;
            else if (r.field == 10) signal = textField(r.bytes, 2);
            else if (r.field == 14) message = text(r.bytes);
            else if (r.field == 16) threads.add(r.bytes);
        }
        StringBuilder out = new StringBuilder();
        if (!signal.isEmpty()) out.append("Signal: ").append(signal).append('\n');
        if (!message.isEmpty()) out.append("Message: ").append(CrashText.redact(message)).append('\n');
        for (byte[] entry : threads) {
            // A map entry: key 1 is the thread id, value 2 is the thread.
            long id = -1;
            byte[] thread = null;
            Reader e = new Reader(entry);
            while (e.next()) {
                if (e.field == 1) id = e.number;
                else if (e.field == 2) thread = e.bytes;
            }
            if (id == crashed && thread != null) out.append(thread(thread));
        }
        return out.toString().trim();
    }

    private static String thread(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        int n = 0;
        Reader r = new Reader(bytes);
        while (r.next()) {
            if (r.field == 2) out.insert(0, "Thread: " + text(r.bytes) + "\n");
            else if (r.field == 4 && n < MAX_FRAMES) out.append('#').append(n++).append(' ').append(frame(r.bytes)).append('\n');
        }
        return out.toString();
    }

    private static String frame(byte[] bytes) {
        long pc = 0;
        long offset = 0;
        String function = "";
        String file = "";
        Reader r = new Reader(bytes);
        while (r.next()) {
            if (r.field == 1) pc = r.number;
            else if (r.field == 4) function = text(r.bytes);
            else if (r.field == 5) offset = r.number;
            else if (r.field == 6) file = text(r.bytes);
        }
        file = file.substring(file.lastIndexOf('/') + 1);
        return file + (function.isEmpty() ? "" : " " + function + "+" + offset) + " (0x" + Long.toHexString(pc) + ")";
    }

    private static String textField(byte[] bytes, int field) {
        Reader r = new Reader(bytes);
        while (r.next()) if (r.field == field) return text(r.bytes);
        return "";
    }

    private static String text(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }

    /** One protobuf message, field by field. Throws when it is cut off or not a protobuf. */
    private static final class Reader {
        private final byte[] in;
        private int at;
        int field;
        long number;
        byte[] bytes = new byte[0];

        Reader(byte[] in) {
            this.in = in;
        }

        boolean next() {
            if (at >= in.length) return false;
            long tag = varint();
            field = (int) (tag >>> 3);
            number = 0;
            bytes = new byte[0];
            switch ((int) (tag & 7)) {
                case 0:
                    number = varint();
                    return true;
                case 1:
                    skip(8);
                    return true;
                case 2:
                    long len = varint();
                    if (len < 0 || len > in.length - at) throw new IllegalArgumentException("cut off");
                    bytes = new byte[(int) len];
                    System.arraycopy(in, at, bytes, 0, (int) len);
                    at += (int) len;
                    return true;
                case 5:
                    skip(4);
                    return true;
                default:
                    throw new IllegalArgumentException("not a record");
            }
        }

        private void skip(int n) {
            if (n > in.length - at) throw new IllegalArgumentException("cut off");
            at += n;
        }

        private long varint() {
            long v = 0;
            for (int shift = 0; shift < 64; shift += 7) {
                if (at >= in.length) throw new IllegalArgumentException("cut off");
                byte b = in[at++];
                v |= (long) (b & 0x7f) << shift;
                if (b >= 0) return v;
            }
            throw new IllegalArgumentException("not a number");
        }
    }
}
