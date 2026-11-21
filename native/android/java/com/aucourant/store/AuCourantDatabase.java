package com.aucourant.store;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

/**
 * The app's database, app-private (backups are off in app.json). Version 1: there are no users yet,
 * so there are no migrations. Never used on the main thread.
 */
@Database(entities = {RecordEntity.class, LockEntity.class}, version = 1, exportSchema = false)
public abstract class AuCourantDatabase extends RoomDatabase {
    private static volatile AuCourantDatabase instance;

    public abstract StoreDao dao();

    public static AuCourantDatabase get(Context context) {
        if (instance == null) {
            synchronized (AuCourantDatabase.class) {
                if (instance == null) {
                    instance = Room.databaseBuilder(context.getApplicationContext(), AuCourantDatabase.class, "aucourant.db").build();
                }
            }
        }
        return instance;
    }
}
