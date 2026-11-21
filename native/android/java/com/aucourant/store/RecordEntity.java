package com.aucourant.store;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Ignore;
import androidx.room.Index;

/**
 * One saved item of one list: a payment, a group, a merge, a setting... `kind` names the list
 * (see {@link Kinds}), `json` holds the item exactly as the TypeScript screens use it, so a field
 * added on the TypeScript side needs no database change. Every list is loaded whole at launch.
 */
@Entity(tableName = "record", primaryKeys = {"kind", "id"}, indices = {@Index("kind")})
public class RecordEntity {
    @NonNull
    public String kind = "";
    @NonNull
    public String id = "";
    /** Order within the list, for lists the user can reorder. Payments are sorted by date instead. */
    public int position;
    @NonNull
    public String json = "null";

    public RecordEntity() {
    }

    @Ignore
    public RecordEntity(@NonNull String kind, @NonNull String id, int position, @NonNull String json) {
        this.kind = kind;
        this.id = id;
        this.position = position;
        this.json = json;
    }
}
