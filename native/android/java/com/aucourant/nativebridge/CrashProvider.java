package com.aucourant.nativebridge;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;

import androidx.annotation.NonNull;

/**
 * Starts the problem recorder. Android creates content providers before the application itself, so
 * this also catches errors while React Native is starting. It holds no data and is not exported.
 */
public class CrashProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        if (getContext() != null) CrashLog.install(getContext());
        return true;
    }

    @Override
    public Cursor query(@NonNull Uri uri, String[] projection, String selection, String[] args, String order) {
        return null;
    }

    @Override
    public String getType(@NonNull Uri uri) {
        return null;
    }

    @Override
    public Uri insert(@NonNull Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(@NonNull Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(@NonNull Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
