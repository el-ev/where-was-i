# End-to-End Usage Guide

This guide demonstrates how to use the Where Was I API from start to finish, including real examples and expected responses.

## Prerequisites

- Deployed Where Was I application
- Command line access (curl, or similar tool)
- Your deployment URL (e.g., `https://your-worker.workers.dev`)

## Step 1: Initialize the Database

First, initialize your database to get an admin token:

### Request
```bash
curl -X POST https://your-worker.workers.dev/init \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-init-secret"}'
```

### Expected Response
```json
{
  "success": true,
  "message": "Database initialized",
  "admin_token": "AbCdEf123456..."
}
```

**Important:** Save the `admin_token` securely - you'll need it for all subsequent operations.

## Step 2: Create Additional Tokens

Use your admin token to create tokens for different purposes:

### Create a Read-Write Token

```bash
curl -X POST https://your-worker.workers.dev/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "expires": true,
    "expires_in_days": 365,
    "permissions": {
      "read": true,
      "write": true,
      "create_token": false
    },
    "comment": "Personal location tracking token"
  }'
```

### Expected Response
```json
{
  "success": true,
  "token": "XyZ789AbC..."
}
```

### Create a Read-Only Token with Time Restrictions

```bash
curl -X POST https://your-worker.workers.dev/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "expires": true,
    "expires_in_days": 30,
    "permissions": {
      "read": true,
      "write": false,
      "create_token": false
    },
    "comment": "Shared access for 2023 data only",
    "available_start_time": "2023-01-01T00:00:00Z",
    "available_end_time": "2023-12-31T23:59:59Z"
  }'
```

### Expected Response
```json
{
  "success": true,
  "token": "Abc123XyZ..."
}
```

## Step 3: Add Location Data

Use a token with write permissions to add location data:

### Add a Single Location

```bash
curl -X POST https://your-worker.workers.dev/locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WRITE_TOKEN" \
  -d '{
    "lat": 37.7749,
    "lng": -122.4194,
    "alt": 10.5,
    "t": 1672531200
  }'
```

### Expected Response
```json
{
  "message": "Location added"
}
```

### Add Multiple Locations (Script Example)

```bash
#!/bin/bash
TOKEN="YOUR_WRITE_TOKEN"
BASE_URL="https://your-worker.workers.dev"

# Sample locations (San Francisco area)
locations=(
  '{"lat": 37.7749, "lng": -122.4194, "alt": 10.5, "t": 1672531200}'
  '{"lat": 37.7849, "lng": -122.4094, "alt": 15.2, "t": 1672531800}'
  '{"lat": 37.7649, "lng": -122.4294, "alt": 8.1, "t": 1672532400}'
  '{"lat": 37.7549, "lng": -122.4394, "alt": 12.7, "t": 1672533000}'
)

for location in "${locations[@]}"; do
  curl -X POST "$BASE_URL/locations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$location"
  echo ""
done
```

## Step 4: Query Location Data

### Get All Recent Locations

```bash
curl -H "Authorization: Bearer YOUR_READ_TOKEN" \
  "https://your-worker.workers.dev/locations"
```

### Expected Response
```json
[
  {
    "id": 4,
    "latitude": 37.7549,
    "longitude": -122.4394,
    "altitude": 12.7,
    "timestamp": 1672533000
  },
  {
    "id": 3,
    "latitude": 37.7649,
    "longitude": -122.4294,
    "altitude": 8.1,
    "timestamp": 1672532400
  },
  {
    "id": 2,
    "latitude": 37.7849,
    "longitude": -122.4094,
    "altitude": 15.2,
    "timestamp": 1672531800
  },
  {
    "id": 1,
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "timestamp": 1672531200
  }
]
```

### Query with Time Range

```bash
curl -H "Authorization: Bearer YOUR_READ_TOKEN" \
  "https://your-worker.workers.dev/locations?startTime=2023-01-01T00:00:00Z&endTime=2023-01-01T23:59:59Z"
```

### Query with Clustering

```bash
curl -H "Authorization: Bearer YOUR_READ_TOKEN" \
  "https://your-worker.workers.dev/locations?clusterMaxDist=50&limit=100"
```

### Query with Bounding Box

```bash
# San Francisco Bay Area
curl -H "Authorization: Bearer YOUR_READ_TOKEN" \
  "https://your-worker.workers.dev/locations?bbox=-122.5,37.7,-122.3,37.8"
```

### Get Last Location

```bash
curl -H "Authorization: Bearer YOUR_READ_TOKEN" \
  "https://your-worker.workers.dev/locations/last"
```

### Expected Response
```json
[
  {
    "id": 4,
    "latitude": 37.7549,
    "longitude": -122.4394,
    "altitude": 12.7,
    "timestamp": 1672533000
  }
]
```

## Step 5: Token Management

### List All Tokens

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://your-worker.workers.dev/tokens"
```

### Expected Response
```json
[
  {
    "id": 1,
    "permissions": {
      "read": true,
      "write": true,
      "create_token": true
    },
    "expires_at": null,
    "comment": null,
    "available_start_time": null,
    "available_end_time": null
  },
  {
    "id": 2,
    "permissions": {
      "read": true,
      "write": true,
      "create_token": false
    },
    "expires_at": 1704067200,
    "comment": "Personal location tracking token",
    "available_start_time": null,
    "available_end_time": null
  },
  {
    "id": 3,
    "permissions": {
      "read": true,
      "write": false,
      "create_token": false
    },
    "expires_at": 1675123200,
    "comment": "Shared access for 2023 data only",
    "available_start_time": 1672531200,
    "available_end_time": 1703980799
  }
]
```

## Step 6: Use the Web Interface

### Access the Map

1. Open your browser to: `https://your-worker.workers.dev`
2. Enter one of your read-enabled tokens
3. Click "Set Token"
4. Click "Load" to view your location data on the map

### Filter and Explore

- **Time Filters**: Set start/end dates to view specific periods
- **Clustering**: Adjust cluster distance to group nearby points
- **Bounding Box**: Enter coordinates to focus on specific areas
- **Limit**: Set maximum number of points to display

## Error Handling Examples

### Invalid Token

```bash
curl -H "Authorization: Bearer invalid-token" \
  "https://your-worker.workers.dev/locations"
```

**Response:**
```json
{
  "error": "Unauthorized"
}
```

### Insufficient Permissions

```bash
# Try to write with read-only token
curl -X POST https://your-worker.workers.dev/locations \
  -H "Authorization: Bearer READ_ONLY_TOKEN" \
  -d '{"lat": 37.7749, "lng": -122.4194, "alt": 10, "t": 1672531200}'
```

**Response:**
```json
{
  "error": "Forbidden"
}
```

### Invalid Location Data

```bash
curl -X POST https://your-worker.workers.dev/locations \
  -H "Authorization: Bearer YOUR_WRITE_TOKEN" \
  -d '{"lat": 91, "lng": -122.4194, "alt": 10, "t": 1672531200}'
```

**Response:**
```json
{
  "error": "Invalid location data",
  "details": {
    "fieldErrors": {
      "lat": ["Number must be less than or equal to 90"]
    }
  }
}
```

## Advanced Usage Examples

### Automated Location Tracking

```bash
#!/bin/bash
# location-tracker.sh - Add current location periodically

TOKEN="YOUR_WRITE_TOKEN"
BASE_URL="https://your-worker.workers.dev"

while true; do
  # Get current location (example using a GPS service)
  LAT=$(get_current_latitude)  # Replace with actual GPS call
  LNG=$(get_current_longitude) # Replace with actual GPS call
  ALT=$(get_current_altitude)  # Replace with actual GPS call
  TIMESTAMP=$(date +%s)
  
  curl -X POST "$BASE_URL/locations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"lat\": $LAT, \"lng\": $LNG, \"alt\": $ALT, \"t\": $TIMESTAMP}"
  
  # Wait 5 minutes
  sleep 300
done
```

### Data Export

```bash
#!/bin/bash
# export-data.sh - Export all location data

TOKEN="YOUR_READ_TOKEN"
BASE_URL="https://your-worker.workers.dev"

# Get all data without limit
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/locations?limit=0" > locations_export.json

echo "Data exported to locations_export.json"
```

### Generate Heatmap Data

```bash
#!/bin/bash
# heatmap.sh - Get clustered data for heatmap visualization

TOKEN="YOUR_READ_TOKEN"
BASE_URL="https://your-worker.workers.dev"

# Get highly clustered data for heatmap
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/locations?clusterMaxDist=100&limit=1000" \
  | jq '[.[] | {lat: .latitude, lng: .longitude, weight: 1}]' \
  > heatmap_data.json
```

## Security Best Practices

### 1. Token Rotation

```bash
# Create new token
NEW_TOKEN=$(curl -X POST https://your-worker.workers.dev/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"permissions": {"read": true, "write": true}}' \
  | jq -r '.token')

# Update your applications to use NEW_TOKEN
# Then you can let the old token expire
```

### 2. Time-Limited Access

```bash
# Create token that expires in 1 day
curl -X POST https://your-worker.workers.dev/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "expires": true,
    "expires_in_days": 1,
    "permissions": {"read": true},
    "comment": "Temporary access"
  }'
```

### 3. Restricted Time Range

```bash
# Create token that only accesses last month's data
LAST_MONTH_START=$(date -d "last month" +"%Y-%m-01T00:00:00Z")
LAST_MONTH_END=$(date -d "last month" +"%Y-%m-31T23:59:59Z")

curl -X POST https://your-worker.workers.dev/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d "{
    \"permissions\": {\"read\": true},
    \"available_start_time\": \"$LAST_MONTH_START\",
    \"available_end_time\": \"$LAST_MONTH_END\",
    \"comment\": \"Last month data only\"
  }"
```

## Troubleshooting Tips

1. **Check token permissions**: Use `GET /tokens` with admin token
2. **Verify timestamp format**: Use Unix timestamps (seconds since epoch)
3. **Check coordinate ranges**: Latitude (-90 to 90), Longitude (-180 to 180)
4. **Test with curl first**: Before integrating into applications
5. **Monitor response codes**: 401=unauthorized, 403=forbidden, 400=bad request

## Next Steps

- Set up automated location tracking
- Integrate with mobile applications
- Create custom visualizations
- Implement data backup procedures
- Set up monitoring and alerts