package com.aucourant.store;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Reads and writes saved lists and the lock. Called only from StoreModule's worker threads, one for lists and one for the lock. */
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

    /** Every saved item except one kind (the ids of messages already read, which the screens do not need). */
    @Query("SELECT * FROM record WHERE kind != :kind ORDER BY kind, position")
    public abstract List<RecordEntity> allExcept(String kind);

    @Query("SELECT id FROM record WHERE kind = :kind AND id IN (:ids)")
    abstract List<String> knownChunk(String kind, List<String> ids);

    /** Which of these ids are saved in the list. */
    public Set<String> known(String kind, List<String> ids) {
        Set<String> out = new HashSet<>();
        for (int i = 0; i < ids.size(); i += CHUNK) out.addAll(knownChunk(kind, new ArrayList<>(ids.subList(i, Math.min(ids.size(), i + CHUNK)))));
        return out;
    }

    @Query("SELECT * FROM record WHERE kind = :kind AND id = :id")
    public abstract RecordEntity one(String kind, String id);

    @Query("DELETE FROM record WHERE kind = :kind")
    public abstract void clearKind(String kind);

    @Query("SELECT * FROM lock_record WHERE id = 1")
    public abstract LockEntity lock();

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    public abstract void saveLock(LockEntity lock);

    /** Changes the saved lock; does nothing when there is none, so a check that ends after an erase does not bring it back. */
    @Update
    public abstract void updateLock(LockEntity lock);

    @Query("DELETE FROM lock_record")
    public abstract void clearLock();
}
