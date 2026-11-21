package com.aucourant.store;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.ArrayList;
import java.util.List;

/** Reads and writes saved lists and the lock. Called only from StoreModule's single worker thread. */
@Dao
public abstract class StoreDao {
    /** SQLite allows 999 bound values per statement; stay well under it. */
    private static final int CHUNK = 500;

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    public abstract void upsert(List<RecordEntity> rows);

    @Query("DELETE FROM record WHERE kind = :kind AND id IN (:ids)")
    abstract void deleteChunk(String kind, List<String> ids);

    public void delete(String kind, List<String> ids) {
        for (int i = 0; i < ids.size(); i += CHUNK) deleteChunk(kind, new ArrayList<>(ids.subList(i, Math.min(ids.size(), i + CHUNK))));
    }

    @Query("SELECT * FROM record WHERE kind = :kind ORDER BY position")
    public abstract List<RecordEntity> all(String kind);

    @Query("SELECT * FROM record ORDER BY kind, position")
    public abstract List<RecordEntity> everything();

    @Query("SELECT * FROM record WHERE kind = :kind AND id = :id")
    public abstract RecordEntity one(String kind, String id);

    @Query("DELETE FROM record WHERE kind = :kind")
    public abstract void clearKind(String kind);

    @Query("SELECT * FROM lock_record WHERE id = 1")
    public abstract LockEntity lock();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    public abstract void saveLock(LockEntity lock);

    @Query("DELETE FROM lock_record")
    public abstract void clearLock();
}
