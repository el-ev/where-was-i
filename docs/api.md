# API Documentation

## Base URL

All API endpoints are relative to your deployed Cloudflare Worker URL:
```
https://your-worker.your-subdomain.workers.dev
```

## Authentication

Most endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer your-token-here
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "error": "Error message",
  "details": "Optional additional details"
}
```

Common HTTP status codes:
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `409`: Conflict (resource already exists)
- `500`: Internal Server Error

## Endpoints

### Initialize Database

Initialize the database and create an admin token.

**Endpoint:** `POST /init`

**Authentication:** None (requires `INIT_SECRET`)

**Request Body:**
```json
{
  "secret": "your-init-secret"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Database initialized",
  "admin_token": "generated-admin-token"
}
```

**Errors:**
- `400`: Invalid request body
- `403`: Invalid secret
- `409`: Database already initialized
- `500`: INIT_SECRET not configured

---

### Create Token

Create a new authentication token with specified permissions.

**Endpoint:** `POST /tokens`

**Authentication:** Required (`create_token` permission)

**Request Body:**
```json
{
  "expires": true,
  "expires_in_days": 30,
  "permissions": {
    "read": true,
    "write": false,
    "create_token": false
  },
  "comment": "Optional description",
  "available_start_time": "2023-01-01T00:00:00Z",
  "available_end_time": "2023-12-31T23:59:59Z"
}
```

**Parameters:**
- `expires` (boolean, default: true): Whether the token expires
- `expires_in_days` (number, default: 30): Days until expiration
- `permissions` (object, required): Token permissions
  - `read` (boolean, default: false): Can query locations
  - `write` (boolean, default: false): Can add locations
  - `create_token` (boolean, default: false): Can manage tokens
- `comment` (string, optional): Description for the token
- `available_start_time` (string/Date, optional): Earliest accessible data
- `available_end_time` (string/Date, optional): Latest accessible data

**Time Range Validation:**
- If both time fields are provided, `available_start_time` must be ≤ `available_end_time`
- Dates can be ISO 8601 strings or Date objects

**Response (201):**
```json
{
  "success": true,
  "token": "generated-token-string"
}
```

**Errors:**
- `400`: Invalid token creation data or token duration too long
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Database error

---

### List Tokens

Retrieve all existing tokens and their metadata.

**Endpoint:** `GET /tokens`

**Authentication:** Required (`create_token` permission)

**Response (200):**
```json
[
  {
    "id": 1,
    "permissions": {
      "read": true,
      "write": false,
      "create_token": false
    },
    "expires_at": 1735689600,
    "comment": "Limited access token",
    "available_start_time": 1672531200,
    "available_end_time": 1703980799
  }
]
```

**Response Fields:**
- `id`: Token database ID
- `permissions`: Token permission object
- `expires_at`: Unix timestamp of expiration (null if no expiration)
- `comment`: Token description (null if none)
- `available_start_time`: Unix timestamp of earliest data access (null if unrestricted)
- `available_end_time`: Unix timestamp of latest data access (null if unrestricted)

---

### Add Location

Store a new GPS location with timestamp.

**Endpoint:** `POST /locations`

**Authentication:** Required (`write` permission)

**Request Body:**
```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "alt": 10.5,
  "t": 1672531200
}
```

**Parameters:**
- `lat` (number, required): Latitude (-90 to 90)
- `lng` (number, required): Longitude (-180 to 180)
- `alt` (number, required): Altitude in meters
- `t` (number, required): Unix timestamp (non-negative integer)

**Response (201):**
```json
{
  "message": "Location added"
}
```

**Errors:**
- `400`: Invalid location data
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Database error

---

### Query Locations

Retrieve location data with optional filtering and clustering.

**Endpoint:** `GET /locations`

**Authentication:** Required (`read` permission)

**Query Parameters:**
- `startId` (number, optional): Start from location ID
- `startTime` (string, optional): ISO 8601 start time
- `endTime` (string, optional): ISO 8601 end time
- `clusterMaxDist` (number, optional, default: 0): Clustering distance in meters
- `limit` (number, optional, default: 1000): Maximum results (0 = no limit)
- `bbox` (string, optional): Bounding box as "west,south,east,north"

**Example:**
```
GET /locations?startTime=2023-01-01T00:00:00Z&endTime=2023-12-31T23:59:59Z&clusterMaxDist=20&limit=100&bbox=-122.5,37.7,-122.3,37.8
```

**Token Time Range Enforcement:**
- Token time restrictions override query parameters
- Query can be more restrictive but not less restrictive than token
- If token has `available_start_time`, effective start time is max(query_start, token_start)
- If token has `available_end_time`, effective end time is min(query_end, token_end)

**Response (200):**
```json
[
  {
    "id": 123,
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "timestamp": 1672531200
  }
]
```

**Clustering Behavior:**
- `clusterMaxDist = 0`: No clustering (all points returned)
- `clusterMaxDist > 0`: Nearby points clustered, representatives returned
- Representatives are points closest to cluster centroids

**Errors:**
- `400`: Invalid query parameters
- `401`: Unauthorized
- `403`: Insufficient permissions

---

### Get Recent Locations

Retrieve the most recent location(s), respecting token time restrictions.

**Endpoint:** `GET /locations/last`

**Authentication:** Required (`read` permission)

**Query Parameters:**
- `limit` (number, optional, default: 1): Number of locations (1-1000)

**Example:**
```
GET /locations/last?limit=5
```

**Token Time Range Enforcement:**
- Only returns locations within token's allowed time range
- If token has time restrictions, locations outside the range are excluded

**Response (200):**
```json
[
  {
    "id": 123,
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "timestamp": 1672531200
  }
]
```

**Errors:**
- `401`: Unauthorized
- `403`: Insufficient permissions

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production deployments.

## Data Formats

### Timestamps
- All timestamps are Unix timestamps (seconds since epoch)
- API accepts ISO 8601 strings and converts them automatically
- Database stores as integers for efficient querying

### Coordinates
- Latitude: -90 to 90 (degrees)
- Longitude: -180 to 180 (degrees)
- Altitude: meters (any real number)

### Bounding Box
- Format: "west,south,east,north" (comma-separated)
- Example: "-122.5,37.7,-122.3,37.8" (San Francisco area)
- Coordinates in decimal degrees