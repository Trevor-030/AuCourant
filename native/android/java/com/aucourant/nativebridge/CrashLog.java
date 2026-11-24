package com.aucourant.nativebridge;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;

import androidx.annotation.RequiresApi;

import com.aucourant.crash.CrashText;
import com.aucourant.crash.StepList;
import com.aucourant.crash.Tombstone;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The problem report: what went wrong the last time the app closed by itself. Kept in app-private
 * storage, shown at the next launch, and shared only if the user shares it.
 *
 * Three sources: errors in JavaScript (CrashModule), uncaught errors in Java (the handler set here),
 * and Android's own record of how the app ended, which is the only one that knows about native
 * crashes, freezes and being closed for memory. The last steps before it are kept as well.
 *
 * Nothing here may throw: the recorder must never be the problem.
 */
final class CrashLog {
    private static final int MAX_REPORT = 30_000;
    private static final int MAX_PART = 12_000;
    private static final int MAX_TRACE_BYTES = 8 * 1024 * 1024;
    private static final int MAX_STEPS = 60;
    /** A report written this long before Android says the app ended is about that ending. */
    private static final long SAME_END_MS = 60_000;

    /** Looks at how the app ended before. `pending` waits behind it. */
    private static final ExecutorService COLLECTOR = Executors.newSingleThreadExecutor();
    private static final StepList STEPS = new StepList(MAX_STEPS);

    private static volatile Context app;
    private static boolean recorded;

    private CrashLog() {
    }

    /** Called by CrashProvider, before anything else in the app starts. */
    static void install(Context context) {
        try {
            app = context.getApplicationContext() == null ? context : context.getApplicationContext();
            String before = read(file("steps.txt"));
            Thread.UncaughtExceptionHandler next = Thread.getDefaultUncaughtExceptionHandler();
            Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
                try {
                    record("Java error on " + thread.getName(), CrashText.stack(error));
                } catch (Throwable ignored) {
                    // Out of memory, most likely: let Android close the app as usual.
                }
                if (next != null) next.uncaughtException(thread, error);
            });
            step("app process started");
            COLLECTOR.execute(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) collectExits(before);
                } catch (Throwable ignored) {
                    // No record of how the app ended: the other two sources still work.
                }
            });
        } catch (Throwable ignored) {
            // The app starts without the recorder.
        }
    }

    /** One thing the app did. Counts and names of screens only, never payments or people. */
    static void step(String what) {
        try {
            STEPS.add(new SimpleDateFormat("HH:mm:ss.SSS", Locale.ROOT).format(new Date()) + " " + what);
            if (app != null) write(file("steps.txt"), STEPS.text(), false);
        } catch (Throwable ignored) {
            // A missing step costs nothing.
        }
    }

    /** Saves a problem. The first one in a run starts the report; later ones are added under it. */
    static synchronized void record(String kind, String details) {
        try {
            if (app == null) return;
            String part = kind + "\n" + CrashText.trim(CrashText.redact(details), MAX_PART);
            String text = recorded ? read(file("report.txt")) + "\n\nThen: " + part : header(new Date()) + part + steps(STEPS.text());
            recorded = true;
            write(file("report.txt"), CrashText.trim(text, MAX_REPORT), true);
        } catch (Throwable ignored) {
            // Nothing more can be done here.
        }
    }

    interface Answer {
        void report(String text);
    }

    /** The report not yet dismissed, or null. Answers after the look at how the app ended. */
    static void pending(Answer answer) {
        COLLECTOR.execute(() -> {
            String text = null;
            try {
                text = read(file("report.txt"));
            } catch (Throwable ignored) {
                // Answered with null below.
            }
            answer.report(text == null || text.isEmpty() ? null : text);
        });
    }

    static synchronized void clear() {
        try {
            recorded = false;
            file("report.txt").delete();
        } catch (Throwable ignored) {
            // It is shown once more.
        }
    }

    // ---- How Android says the app ended ----------------------------------------------

    @RequiresApi(Build.VERSION_CODES.R)
    private static void collectExits(String stepsBefore) throws IOException {
        ActivityManager am = (ActivityManager) app.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return;
        long seen = 0;
        try {
            seen = Long.parseLong(read(file("seen.txt")));
        } catch (NumberFormatException ignored) {
            // First look.
        }
        List<ApplicationExitInfo> exits = am.getHistoricalProcessExitReasons(app.getPackageName(), 0, 10);
        ApplicationExitInfo problem = null;
        long newest = seen;
        StringBuilder list = new StringBuilder();
        for (ApplicationExitInfo e : exits) {
            newest = Math.max(newest, e.getTimestamp());
            if (problem == null && e.getTimestamp() > seen && isProblem(e)) problem = e;
            list.append(time(new Date(e.getTimestamp()))).append(' ').append(reason(e)).append(" status ").append(e.getStatus());
            if (e.getDescription() != null) list.append(": ").append(CrashText.redact(e.getDescription()));
            list.append('\n');
        }
        if (newest > seen) write(file("seen.txt"), String.valueOf(newest), true);
        if (problem == null) return;

        String android = "Android says: " + reason(problem) + "\nMemory used: " + problem.getPss() / 1024 + " MB\n" + trace(problem);
        File report = file("report.txt");
        long gap = problem.getTimestamp() - report.lastModified();
        synchronized (CrashLog.class) {
            String own = report.exists() && !recorded && Math.abs(gap) < SAME_END_MS ? read(report) : "";
            String text = own.isEmpty()
                    ? header(new Date(problem.getTimestamp())) + android.trim() + steps(stepsBefore)
                    : own + "\n\n" + android.trim();
            // A problem in this run, already recorded, is newer.
            if (!recorded) write(report, CrashText.trim(text + "\n\nHow the app ended before\n" + list.toString().trim(), MAX_REPORT), true);
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private static boolean isProblem(ApplicationExitInfo e) {
        switch (e.getReason()) {
            case ApplicationExitInfo.REASON_CRASH:
            case ApplicationExitInfo.REASON_CRASH_NATIVE:
            case ApplicationExitInfo.REASON_ANR:
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE:
                return true;
            case ApplicationExitInfo.REASON_LOW_MEMORY:
            case ApplicationExitInfo.REASON_SIGNALED:
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE:
            case ApplicationExitInfo.REASON_EXIT_SELF:
                // In the background Android may close any app; only on screen is it a problem.
                return e.getImportance() <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
            default:
                return false;
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private static String reason(ApplicationExitInfo e) {
        switch (e.getReason()) {
            case ApplicationExitInfo.REASON_CRASH:
                return "Java crash";
            case ApplicationExitInfo.REASON_CRASH_NATIVE:
                return "native crash";
            case ApplicationExitInfo.REASON_ANR:
                return "not responding";
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE:
                return "failed to start";
            case ApplicationExitInfo.REASON_LOW_MEMORY:
                return "closed for memory";
            case ApplicationExitInfo.REASON_SIGNALED:
                return "closed by a signal";
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE:
                return "closed for using too much";
            case ApplicationExitInfo.REASON_EXIT_SELF:
                return "closed itself";
            case ApplicationExitInfo.REASON_USER_REQUESTED:
                return "closed by the user";
            default:
                return "reason " + e.getReason();
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private static String trace(ApplicationExitInfo e) {
        try (InputStream in = e.getTraceInputStream()) {
            if (in == null) return "";
            byte[] bytes = readAll(in);
            if (e.getReason() == ApplicationExitInfo.REASON_CRASH_NATIVE) return CrashText.trim(Tombstone.summary(bytes), MAX_PART);
            // A freeze: only what the main thread was doing.
            String text = new String(bytes, StandardCharsets.UTF_8);
            int from = text.indexOf("\"main\"");
            if (from < 0) return "";
            int to = text.indexOf("\n\n", from);
            return CrashText.trim(CrashText.redact(text.substring(from, to < 0 ? text.length() : to)), MAX_PART);
        } catch (IOException | RuntimeException ex) {
            return "";
        }
    }

    // ---- Text and files ---------------------------------------------------------------

    private static String header(Date when) {
        String version = "";
        try {
            PackageInfo p = app.getPackageManager().getPackageInfo(app.getPackageName(), 0);
            version = p.versionName + " (installed " + time(new Date(p.lastUpdateTime)) + ")";
        } catch (Exception ignored) {
            // Left empty.
        }
        Runtime rt = Runtime.getRuntime();
        return "AuCourant problem report\nVersion " + version
                + "\nAndroid " + Build.VERSION.RELEASE + " (" + Build.VERSION.SDK_INT + "), " + Build.MANUFACTURER + " " + Build.MODEL
                + "\nWhen: " + time(when)
                + "\nJava memory now: " + (rt.totalMemory() - rt.freeMemory()) / 1_048_576 + " of " + rt.maxMemory() / 1_048_576 + " MB\n\n";
    }

    private static String steps(String text) {
        return text.isEmpty() ? "" : "\n\nSteps before\n" + text;
    }

    private static String time(Date d) {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.ROOT).format(d);
    }

    private static File file(String name) {
        File dir = new File(app.getFilesDir(), "crash");
        dir.mkdirs();
        return new File(dir, name);
    }

    private static String read(File f) throws IOException {
        if (!f.exists()) return "";
        try (InputStream in = new FileInputStream(f)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] part = new byte[16 * 1024];
        int n;
        while ((n = in.read(part)) > 0 && out.size() < MAX_TRACE_BYTES) out.write(part, 0, n);
        return out.toByteArray();
    }

    /** @param sync waits until it is on the disk, for a report written as the app dies */
    private static void write(File f, String text, boolean sync) throws IOException {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
            if (sync) out.getFD().sync();
        }
    }
}
