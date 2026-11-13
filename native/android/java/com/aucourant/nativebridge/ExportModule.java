package com.aucourant.nativebridge;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * Writes export files (CSV, PDF) into app-private storage and hands them to other apps.
 * Nothing is uploaded: the user picks where the file goes from the Android share sheet.
 */
public class ExportModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantExport";
    private static final String DIR = "exports";

    ExportModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    private static String authority(Context ctx) {
        return ctx.getPackageName() + ".aucourant.files";
    }

    /**
     * @param fileName plain file name, no folders
     * @param content  file text
     * @param encoding "utf8" for CSV, "latin1" for the hand-written PDF (one byte per char)
     * @return absolute path of the written file
     */
    @ReactMethod
    public void writeReport(String fileName, String content, String encoding, Promise promise) {
        String safe = fileName.replaceAll("[\\\\/:*?\"<>|]", "-");
        Charset cs = "latin1".equals(encoding) ? StandardCharsets.ISO_8859_1 : StandardCharsets.UTF_8;
        File dir = new File(getReactApplicationContext().getFilesDir(), DIR);
        if (!dir.exists() && !dir.mkdirs()) {
            promise.reject("E_STORAGE", "Could not create the exports folder.");
            return;
        }
        File file = new File(dir, safe);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(content.getBytes(cs));
            promise.resolve(file.getAbsolutePath());
        } catch (IOException e) {
            promise.reject("E_STORAGE", "Could not write the report. Check that the phone has free storage.", e);
        }
    }

    /** Opens the Android share sheet for a file written by writeReport. */
    @ReactMethod
    public void shareFile(String path, String mimeType, String title, Promise promise) {
        start(path, mimeType, title, true, promise);
    }

    /** Opens the file in a viewer app (PDF reader, spreadsheet app). */
    @ReactMethod
    public void openFile(String path, String mimeType, Promise promise) {
        start(path, mimeType, null, false, promise);
    }

    private void start(String path, String mimeType, String title, boolean share, Promise promise) {
        Context ctx = getReactApplicationContext();
        File file = new File(path);
        if (!file.exists()) {
            promise.reject("E_NOT_FOUND", "The report file is missing. Export it again.");
            return;
        }
        Uri uri = FileProvider.getUriForFile(ctx, authority(ctx), file);
        Intent intent;
        if (share) {
            intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            if (title != null) intent.putExtra(Intent.EXTRA_SUBJECT, title);
        } else {
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(intent, share ? "Share report" : "Open report");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(chooser);
            promise.resolve(true);
        } catch (ActivityNotFoundException e) {
            promise.reject("E_NO_APP", "No app on this phone can open this file.", e);
        }
    }
}
