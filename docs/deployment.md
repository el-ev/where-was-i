# Deployment Guide

This guide covers deploying the Where Was I application to Cloudflare Workers.

## Prerequisites

- [Node.js](https://nodejs.org/) 16+ installed
- [Cloudflare account](https://cloudflare.com) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed

## Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

This opens your browser to authenticate with Cloudflare.

### 3. Clone and Install

```bash
git clone https://github.com/el-ev/where-was-i.git
cd where-was-i
npm install
```

## Configuration

### 1. Environment Variables

Create a `.env` file or set environment variables:

```env
INIT_SECRET=your-random-secret-here
```

**Important:** Use a strong, unique secret. This is used for database initialization.

### 2. Wrangler Configuration

The `wrangler.jsonc` file contains your deployment configuration:

```json
{
  "name": "where-was-i",
  "main": "src/index.ts",
  "compatibility_date": "2024-08-29",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "INIT_SECRET": "your-secret-here"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "where-was-i-db",
      "database_id": "your-database-id-here"
    }
  ]
}
```

### 3. Create D1 Database

```bash
# Create the database
wrangler d1 create where-was-i-db

# Copy the database_id from the output to wrangler.jsonc
```

### 4. Run Migrations

```bash
# Apply database migrations
wrangler d1 migrations apply where-was-i-db
```

## Deployment

### Development Deployment

```bash
# Deploy to development environment
wrangler deploy --env dev
```

### Production Deployment

```bash
# Deploy to production
wrangler deploy
```

Your application will be available at:
```
https://where-was-i.your-subdomain.workers.dev
```

## Post-Deployment Setup

### 1. Initialize Database

After deployment, initialize your database:

```bash
curl -X POST https://your-worker.workers.dev/init \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-init-secret"}'
```

**Save the returned admin token securely!**

### 2. Create Additional Tokens

Use your admin token to create additional tokens:

```bash
curl -X POST https://your-worker.workers.dev/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token" \
  -d '{
    "expires": true,
    "expires_in_days": 365,
    "permissions": {"read": true, "write": true},
    "comment": "My location tracking token"
  }'
```

## Environment-Specific Configurations

### Development Environment

Create `wrangler.toml` for local development:

```toml
name = "where-was-i-dev"
main = "src/index.ts"
compatibility_date = "2024-08-29"

[env.dev]
vars = { INIT_SECRET = "dev-secret-here" }

[[env.dev.d1_databases]]
binding = "DB"
database_name = "where-was-i-dev-db"
database_id = "dev-database-id"
```

### Production Environment

```toml
[env.production]
vars = { INIT_SECRET = "production-secret-here" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "where-was-i-prod-db"
database_id = "prod-database-id"
```

## Custom Domain Setup

### 1. Add Route in Cloudflare Dashboard

1. Go to your Cloudflare dashboard
2. Select your domain
3. Go to **Workers Routes**
4. Add route: `api.yourdomain.com/*`
5. Select your worker

### 2. Update wrangler.jsonc

```json
{
  "routes": [
    {
      "pattern": "api.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

## Security Considerations

### 1. Environment Variables

- Never commit secrets to version control
- Use different secrets for dev/staging/production
- Rotate secrets regularly

### 2. Token Management

```bash
# Create time-limited tokens
curl -X POST https://your-worker.workers.dev/tokens \
  -H "Authorization: Bearer admin-token" \
  -d '{
    "expires": true,
    "expires_in_days": 30,
    "permissions": {"read": true},
    "available_start_time": "2024-01-01T00:00:00Z",
    "available_end_time": "2024-12-31T23:59:59Z"
  }'
```

### 3. Rate Limiting

Consider implementing rate limiting for production:

```javascript
// Example rate limiting middleware
const rateLimiter = async (c, next) => {
  // Implement rate limiting logic
  await next();
};
```

## Monitoring and Maintenance

### 1. Cloudflare Analytics

Monitor your worker in the Cloudflare dashboard:
- Request volume
- Error rates
- Response times
- Geographic distribution

### 2. Database Monitoring

```bash
# Check database size
wrangler d1 info where-was-i-db

# Query database directly
wrangler d1 execute where-was-i-db --command "SELECT COUNT(*) FROM locations;"
```

### 3. Logs

```bash
# View real-time logs
wrangler tail

# Filter for errors
wrangler tail --grep "ERROR"
```

## Backup and Recovery

### 1. Database Backup

```bash
# Export database
wrangler d1 export where-was-i-db --output backup.sql

# Import database
wrangler d1 execute where-was-i-db --file backup.sql
```

### 2. Token Backup

```bash
# List all tokens (save output securely)
curl -H "Authorization: Bearer admin-token" \
  https://your-worker.workers.dev/tokens
```

## Troubleshooting

### Common Issues

#### 1. Database Not Found
```
Error: D1_ERROR: no such table: locations
```

**Solution:** Run migrations:
```bash
wrangler d1 migrations apply where-was-i-db
```

#### 2. INIT_SECRET Not Set
```
Error: INIT_SECRET is not set
```

**Solution:** Add to wrangler.jsonc:
```json
{
  "vars": {
    "INIT_SECRET": "your-secret-here"
  }
}
```

#### 3. Permission Denied
```
Error: Forbidden
```

**Solution:** Check token permissions:
```bash
curl -H "Authorization: Bearer your-token" \
  https://your-worker.workers.dev/tokens
```

### 4. Build Errors

```bash
# Clear build cache
rm -rf dist/
rm -rf node_modules/
npm install
```

### 5. Migration Issues

```bash
# Check migration status
wrangler d1 migrations list where-was-i-db

# Apply specific migration
wrangler d1 execute where-was-i-db --file migrations/0001_init.sql
```

## Performance Optimization

### 1. Database Indexing

For large datasets, consider adding indexes:

```sql
-- Add after significant data accumulation
CREATE INDEX idx_locations_timestamp ON locations(timestamp);
CREATE INDEX idx_locations_coords ON locations(latitude, longitude);
```

### 2. Token Cleanup

Regular cleanup of expired tokens:

```sql
DELETE FROM tokens 
WHERE expires_at IS NOT NULL 
  AND expires_at < strftime('%s', 'now');
```

### 3. Data Archival

For very large datasets:

```sql
-- Archive old data
CREATE TABLE locations_archive AS 
SELECT * FROM locations 
WHERE timestamp < strftime('%s', 'now') - 86400 * 365; -- 1 year ago

DELETE FROM locations 
WHERE timestamp < strftime('%s', 'now') - 86400 * 365;
```

## Scaling Considerations

### 1. Cloudflare Limits

**Free Tier:**
- 100,000 requests/day
- 10ms CPU time/request
- 128MB memory

**Paid Tier:**
- Unlimited requests
- 50ms CPU time/request
- 128MB memory

### 2. D1 Limits

**Free Tier:**
- 5GB storage
- 25,000 reads/day
- 100,000 writes/day

**Paid Tier:**
- 50GB storage
- 25M reads/day
- 100M writes/day

## Advanced Configuration

### 1. Multiple Environments

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

### 2. Custom Build Process

```json
{
  "scripts": {
    "build": "tsc && esbuild src/index.ts --bundle --outfile=dist/index.js",
    "deploy:dev": "npm run build && wrangler deploy --env dev",
    "deploy:prod": "npm run build && wrangler deploy --env production"
  }
}
```

### 3. CI/CD Integration

GitHub Actions example:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```