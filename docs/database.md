# Database Schema

The application uses SQLite as its database, with two main tables for storing location data and authentication tokens.

## Overview

- **Database Type**: SQLite (via Cloudflare D1)
- **Tables**: 2 main tables (`locations`, `tokens`)
- **Migration System**: SQL files in `/migrations` directory
- **Initialization**: Automated via `/init` endpoint

## Table Schemas

### `locations` Table

Stores GPS coordinate data with timestamps.

```sql
CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL NOT NULL,
    timestamp INTEGER NOT NULL
);
```

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique location record ID |
| `latitude` | REAL | NOT NULL | GPS latitude (-90 to 90) |
| `longitude` | REAL | NOT NULL | GPS longitude (-180 to 180) |
| `altitude` | REAL | NOT NULL | Altitude in meters |
| `timestamp` | INTEGER | NOT NULL | Unix timestamp (seconds) |

#### Indexes

Currently no additional indexes. For large datasets, consider:

```sql
-- Index for time-based queries
CREATE INDEX idx_locations_timestamp ON locations(timestamp);

-- Index for geographic queries (if implementing spatial features)
CREATE INDEX idx_locations_coords ON locations(latitude, longitude);
```

#### Data Types and Ranges

- **Latitude**: -90.0 to 90.0 (degrees)
- **Longitude**: -180.0 to 180.0 (degrees)  
- **Altitude**: Any real number (meters above sea level)
- **Timestamp**: Unix timestamp in seconds (0 to 2^31-1)

### `tokens` Table

Stores authentication tokens with permissions and restrictions.

```sql
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL,
    expires_at INTEGER,
    comment TEXT,
    available_start_time INTEGER,
    available_end_time INTEGER
);
```

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique token record ID |
| `token_hash` | TEXT | NOT NULL, UNIQUE | SHA-256 hash of token |
| `permissions` | TEXT | NOT NULL | JSON permissions object |
| `expires_at` | INTEGER | NULL allowed | Token expiration (Unix timestamp) |
| `comment` | TEXT | NULL allowed | Optional token description |
| `available_start_time` | INTEGER | NULL allowed | Earliest accessible data timestamp |
| `available_end_time` | INTEGER | NULL allowed | Latest accessible data timestamp |

#### Permissions JSON Format

The `permissions` column stores a JSON object:

```json
{
    "read": true,
    "write": false,
    "create_token": false
}
```

**Permission Types:**
- `read`: Can query location data
- `write`: Can add new location data  
- `create_token`: Can create and manage tokens

#### Time Range Fields

- **`available_start_time`**: If set, token can only access data from this timestamp onwards
- **`available_end_time`**: If set, token can only access data up to this timestamp
- **NULL values**: No restriction for that boundary

#### Security Notes

- **Token Storage**: Only SHA-256 hashes are stored, never plain tokens
- **Unique Constraint**: Prevents hash collisions (extremely unlikely)
- **Expiration**: Tokens with `expires_at` in the past are invalid

## Migration History

### Migration 0001 - Initial Schema
```sql
CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL,
    expires_at INTEGER
);
```

### Migration 0002 - Add Token Comments
```sql
ALTER TABLE tokens ADD COLUMN comment TEXT;
```

### Migration 0003 - Add Time Range Support
```sql
ALTER TABLE tokens ADD COLUMN available_start_time INTEGER;
ALTER TABLE tokens ADD COLUMN available_end_time INTEGER;
```

## Data Access Patterns

### Common Queries

#### Location Queries
```sql
-- Get recent locations
SELECT * FROM locations ORDER BY timestamp DESC LIMIT 100;

-- Get locations in time range
SELECT * FROM locations 
WHERE timestamp BETWEEN ? AND ? 
ORDER BY timestamp DESC;

-- Get locations in bounding box and time range
SELECT * FROM locations 
WHERE latitude BETWEEN ? AND ? 
  AND longitude BETWEEN ? AND ? 
  AND timestamp BETWEEN ? AND ?
ORDER BY timestamp DESC;
```

#### Token Queries
```sql
-- Validate token
SELECT * FROM tokens 
WHERE token_hash = ? 
  AND (expires_at IS NULL OR expires_at > ?);

-- List all tokens
SELECT id, permissions, expires_at, comment, 
       available_start_time, available_end_time 
FROM tokens;
```

### Performance Considerations

#### Location Table
- **Write Pattern**: Mostly INSERT operations (time-series data)
- **Read Pattern**: Range queries by timestamp, occasional geographic filters
- **Growth**: Linear with location recording frequency
- **Indexes**: Consider timestamp index for large datasets

#### Token Table
- **Write Pattern**: Occasional INSERT (token creation)
- **Read Pattern**: Individual lookups by hash (authentication)
- **Growth**: Slow (proportional to number of API consumers)
- **Indexes**: Built-in unique index on `token_hash` sufficient

## Storage Estimates

### Location Data
Assuming 4-byte REAL and 8-byte INTEGER:
- Per record: ~32 bytes (4×4 + 8 + 8 overhead)
- 1 location/minute for 1 year: ~16.8 MB
- 1 location/second for 1 day: ~2.8 MB

### Token Data
Assuming 64-character token hash:
- Per record: ~150-200 bytes (depending on comment length)
- 100 tokens: ~20 KB (negligible)

### Cloudflare D1 Limits
- **Database Size**: 500 MB (free tier), 10 GB (paid)
- **Row Count**: 25,000 rows/day writes (free tier)
- **Query Performance**: Optimized for small-medium datasets

## Backup and Maintenance

### Backup Strategies
1. **Cloudflare Dashboard**: Built-in backup/restore tools
2. **Data Export**: Query all data and export as JSON/CSV
3. **Regular Snapshots**: Automated backups via Cloudflare

### Maintenance Tasks
1. **Token Cleanup**: Remove expired tokens periodically
2. **Data Archival**: Move old location data to cold storage
3. **Performance Monitoring**: Watch query performance as data grows

### Example Cleanup Query
```sql
-- Remove expired tokens (run periodically)
DELETE FROM tokens 
WHERE expires_at IS NOT NULL 
  AND expires_at < strftime('%s', 'now');
```

## Security Considerations

### Data Protection
- **Token Hashing**: SHA-256 prevents token recovery from database
- **No Plaintext Storage**: Sensitive data properly encrypted/hashed
- **Access Control**: Permissions system limits data access

### Privacy
- **Location Data**: Contains precise GPS coordinates
- **Retention**: Consider data retention policies
- **Access**: Limit token permissions to minimum necessary

### Compliance
Consider requirements for:
- **GDPR**: Location data is personal data
- **Data Retention**: How long to keep location history
- **Right to Deletion**: Ability to remove user data

## Future Schema Changes

Potential enhancements:

### Location Table
```sql
-- Add accuracy/precision information
ALTER TABLE locations ADD COLUMN accuracy REAL;
ALTER TABLE locations ADD COLUMN source TEXT; -- 'gps', 'wifi', 'cell'

-- Add user/device tracking
ALTER TABLE locations ADD COLUMN device_id TEXT;
ALTER TABLE locations ADD COLUMN user_id TEXT;
```

### Token Table
```sql
-- Add rate limiting
ALTER TABLE tokens ADD COLUMN rate_limit INTEGER;
ALTER TABLE tokens ADD COLUMN rate_window INTEGER;

-- Add IP restrictions
ALTER TABLE tokens ADD COLUMN allowed_ips TEXT; -- JSON array
```

### New Tables
```sql
-- User management
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    created_at INTEGER NOT NULL
);

-- Device tracking
CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT NOT NULL,
    device_type TEXT,
    user_id INTEGER REFERENCES users(id)
);
```