# Lynxify API Routes Documentation

## Standardized Routes

The following routes are the standardized API endpoints for the Lynxify application:

### Connection Management

- `GET /api/connections` - Get all agent connections
- `GET /api/connections/pending` - Get all pending connection requests
- `POST /api/connections/approve` - Approve a connection request
  - Request body: `{ "connectionId": "0.0.123456", "memo": "Optional message" }`

### Agent Management

- `GET /api/agents/status` - Get the status of all agents
- `POST /api/agents/[action]` - Perform actions on agents (register, verify, etc.)

### Index Management

- `GET /api/index/composition` - Get the current index composition
- `POST /api/index/rebalance` - Trigger a rebalance operation

## Legacy Routes

For backward compatibility, the following legacy routes are also supported. These routes forward requests to the standardized routes:

### Connection Management (Legacy)

- `GET /api/agent/connections` → Forwards to `GET /api/connections`
- `GET /api/agent/connections/pending` → Forwards to `GET /api/connections/pending`
- `POST /api/agent/connections/approve` → Forwards to `POST /api/connections/approve`

## API Route Guidelines

1. All new API routes should follow the standardized pattern
2. Use the legacy routes only for backward compatibility
3. All API responses should follow the format: `{ success: boolean, ... }`
4. Error responses should include an `error` field with a descriptive message

## Implementation Details

- All API routes are implemented as Next.js App Router API routes
- Routes use the `force-dynamic` export to ensure they're not cached
- The `nodejs` runtime is used for full Node.js API access
- API routes connect to the agent through the `LynxifyAgent` singleton

## Testing

To test the API endpoints, run:

```bash
node scripts/test-api-endpoints.mjs
```

This script will test all the standardized API endpoints and report their status. 