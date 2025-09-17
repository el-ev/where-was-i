# Time Range Feature for Tokens

## Overview

This feature allows limiting the time range of location data that a token can access. Tokens can now be created with optional `available_start_time` and `available_end_time` parameters that restrict access to location data within that specific time range.

## API Changes

### Token Creation

When creating a token via `POST /tokens`, you can now include the following optional fields:

```json
{
  "expires": true,
  "expires_in_days": 30,
  "permissions": {
    "read": true,
    "write": false,
    "create_token": false
  },
  "comment": "Limited access token",
  "available_start_time": "2023-01-01T00:00:00Z",
  "available_end_time": "2023-12-31T23:59:59Z"
}
```

**New Fields:**
- `available_start_time` (optional): ISO 8601 date string or Date object. Limits token to access location data from this timestamp onwards.
- `available_end_time` (optional): ISO 8601 date string or Date object. Limits token to access location data up to this timestamp.

**Validation:**
- If both times are provided, `available_start_time` must be before or equal to `available_end_time`
- Fields are optional and can be omitted for unrestricted access

### Token Listing

When listing tokens via `GET /tokens`, the response now includes the time range fields:

```json
[
  {
    "id": 1,
    "permissions": {"read": true, "write": false, "create_token": false},
    "expires_at": 1735689600,
    "comment": "Limited access token",
    "available_start_time": 1672531200,
    "available_end_time": 1703980799
  }
]
```

### Location Access Behavior

When querying locations with a time-restricted token:

1. **GET /locations**: Time range restrictions are automatically applied and take precedence over query parameters
2. **GET /locations/last**: Only returns locations within the token's allowed time range

**Example scenarios:**

1. **Token allows 2023 data only**
   - User queries for 2022-2024 data → Only 2023 data returned
   - User queries for Jan 2023 → Jan 2023 data returned (within allowed range)
   - User queries for 2024 data → No data returned

2. **Token has no time restrictions**
   - User queries work as before, respecting only the query parameters

## Database Changes

### Migration 0003

The following columns were added to the `tokens` table:

```sql
ALTER TABLE tokens ADD COLUMN available_start_time INTEGER;
ALTER TABLE tokens ADD COLUMN available_end_time INTEGER;
```

- Timestamps are stored as Unix epoch seconds (INTEGER)
- NULL values indicate no restriction for that boundary

## Implementation Details

### Authentication Middleware

The authentication middleware now passes the full token record to route handlers, allowing them to access time range restrictions.

### Location Query Logic

Time range enforcement follows this precedence:

1. Token `available_start_time` takes precedence over query `startTime` if more restrictive
2. Token `available_end_time` takes precedence over query `endTime` if more restrictive
3. User queries can be more restrictive than token limits
4. User queries cannot be less restrictive than token limits

### Backward Compatibility

- Existing tokens without time range fields continue to work unchanged
- All time range fields are optional
- API endpoints accept requests without time range parameters

## Testing

Run the test suite to validate the implementation:

```bash
npm test
```

The tests cover:
- Schema validation for valid time ranges
- Rejection of invalid time ranges (start > end)
- Optional field handling
- Date string parsing