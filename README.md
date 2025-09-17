# Where Was I

A location tracking application built with Cloudflare Workers that allows you to store, query, and visualize your location history with a secure token-based API.

## Features

- **Location Storage**: Record GPS coordinates with timestamps
- **Token-based Authentication**: Secure access with granular permissions
- **Time Range Restrictions**: Limit token access to specific time periods
- **Location Clustering**: Group nearby locations to reduce map clutter
- **Interactive Map**: Web interface to visualize your location history
- **Flexible Querying**: Filter by time, bounding box, and limit results

## Quick Start

### 1. Environment Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure:
   ```
   INIT_SECRET=your-secret-key-here
   ```

### 2. Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Deploy to Cloudflare Workers
npm run deploy
```

### 3. Database Initialization

Initialize the database with your admin token:

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/init \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-secret-key-here"}'
```

This returns an admin token that you'll use for all subsequent API calls.

## API Reference

### Authentication

All API endpoints require authentication via Bearer token:

```
Authorization: Bearer your-token-here
```

### Endpoints

#### Database Initialization
- `POST /init` - Initialize database and get admin token

#### Tokens
- `POST /tokens` - Create a new token
- `GET /tokens` - List all tokens (requires `create_token` permission)

#### Locations
- `POST /locations` - Add a new location (requires `write` permission)
- `GET /locations` - Query locations (requires `read` permission)
- `GET /locations/last` - Get most recent locations (requires `read` permission)

For detailed API documentation, see [API Documentation](docs/api.md).

## Token Permissions

Tokens have three types of permissions:

- **`read`**: Query and retrieve location data
- **`write`**: Add new location data
- **`create_token`**: Create and manage other tokens

## Time Range Restrictions

Tokens can be restricted to access only data within specific time ranges. This is useful for:

- Sharing historical data for specific periods
- Creating time-limited access tokens
- Implementing data retention policies

For details, see [Time Range Feature Documentation](docs/time-range-feature.md).

## Location Clustering

The application automatically clusters nearby locations to reduce visual clutter on maps. The clustering algorithm:

- Groups locations within a configurable distance (default: 20 meters)
- Selects representative points closest to cluster centroids
- Uses a sliding window to prevent over-clustering

For details, see [Clustering Documentation](docs/clustering.md).

## Web Interface

Access the web interface at your deployed worker URL to:

- View your location history on an interactive map
- Filter by time range, bounding box, and clustering distance
- Set your API token for authenticated access

For usage details, see [Frontend Documentation](docs/frontend.md).

## Database Schema

The application uses SQLite with two main tables:

- **`locations`**: GPS coordinates and timestamps
- **`tokens`**: Authentication tokens with permissions and restrictions

For complete schema details, see [Database Documentation](docs/database.md).

## Security Considerations

- Store your `INIT_SECRET` securely and never commit it to version control
- Use time-limited tokens when possible
- Grant minimal necessary permissions to each token
- Regularly rotate tokens for enhanced security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.