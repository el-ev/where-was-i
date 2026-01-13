-- Migration: 0004
CREATE TABLE packs (
    id INTEGER PRIMARY KEY,
    start_id INTEGER NOT NULL,
    end_id INTEGER NOT NULL,
    min_lat REAL NOT NULL,
    max_lat REAL NOT NULL,
    min_lng REAL NOT NULL,
    max_lng REAL NOT NULL,
    min_time INTEGER NOT NULL,
    max_time INTEGER NOT NULL,
    object_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_packs_time ON packs(min_time, max_time);
CREATE INDEX idx_packs_bbox ON packs(min_lat, max_lat, min_lng, max_lng);
