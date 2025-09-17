# Logging Implementation

This document describes the logging functionality added to the Where-Was-I application.

## Overview

Structured logging has been implemented throughout the application to provide better monitoring, debugging, and operational insights. The logging system uses JSON-formatted log messages with consistent structure and contextual information.

## Components

### Logger Utility (`src/utils/logger.ts`)

A centralized logging utility that provides:
- Structured JSON logging with timestamps
- Multiple log levels (INFO, WARN, ERROR, DEBUG)
- Request-scoped logging with unique request IDs
- Error logging with stack traces
- Contextual information support

### Request Logging Middleware (`src/middleware/logging.ts`)

A Hono middleware that:
- Creates a request-scoped logger for each incoming request
- Logs request start and completion events
- Tracks request duration and response status
- Makes the logger available to route handlers via `c.logger`

## Implementation Details

### Log Format

All logs follow a consistent JSON structure:
```json
{
  "timestamp": "2023-12-01T10:30:00.000Z",
  "level": "INFO",
  "message": "Request completed",
  "requestId": "abc123",
  "method": "GET",
  "url": "https://example.com/locations",
  "action": "request_complete",
  "status": 200,
  "duration": 150
}
```

### Logged Events

#### Authentication Events
- Authentication attempts (success/failure)
- Token validation results
- Permission checks

#### API Operations
- Request start/completion with timing
- Database queries and operations
- Location data retrieval and creation
- Token management operations

#### Error Events
- Validation errors with details
- Database errors with stack traces
- Authentication/authorization failures

#### Frontend Events (Console)
- Map initialization
- Token authentication status
- API request results
- Error conditions

## Usage Examples

### In Route Handlers
```typescript
// The logger is available via c.logger
const logger = c.logger;

logger?.log('Processing request', {
  action: 'process_start',
  userId: tokenRecord.id
});

logger?.error('Database error', error, {
  action: 'db_error',
  operation: 'insert_location'
});
```

### Direct Logger Usage
```typescript
import { Logger } from '../utils/logger';

Logger.info('System startup', {
  action: 'startup',
  version: '1.0.0'
});
```

## Monitoring

The structured logs can be easily parsed and monitored using log aggregation tools. Key fields for monitoring:
- `level`: Log severity
- `action`: Specific operation being performed
- `requestId`: Correlate logs for a single request
- `duration`: Performance monitoring
- `status`: HTTP response codes

## Security Considerations

- Sensitive data (tokens, personal information) is not logged
- Error messages are sanitized to avoid information leakage
- User identifiers use token IDs rather than actual tokens