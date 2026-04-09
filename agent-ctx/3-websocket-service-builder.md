# Task 3 — Agent Events WebSocket Mini-Service

**Agent**: websocket-service-builder
**Status**: ✅ Completed
**Date**: 2025-02-07

## Summary

Created a real-time agent activity WebSocket mini-service (`agent-events`) that broadcasts AgentOS event updates to connected clients via Socket.io, with room-based project isolation and a validated event schema.

## Files Created

| File | Description |
|------|-------------|
| `mini-services/agent-events/package.json` | Bun project config with `socket.io` dependency |
| `mini-services/agent-events/tsconfig.json` | TypeScript configuration (ESNext, strict, bundler resolution) |
| `mini-services/agent-events/index.ts` | Main Socket.io server + internal HTTP API |
| `src/app/api/events/route.ts` | Next.js API route (POST) that forwards events to the mini-service |

## Architecture

```
Frontend (Socket.io Client)
    │  io('/?XTransformPort=3003')
    ▼
┌──────────────────────────────┐
│  Socket.io Server  (3003)    │  ← Public, via Caddy
│  - Handles WS connections    │
│  - Rooms per project         │
│  - Broadcasts events         │
└──────────┬───────────────────┘
           │ shared io instance
┌──────────▼───────────────────┐
│  Internal HTTP API  (3030)   │  ← Local only
│  - POST /emit                │
│  - GET /health               │
└──────────▲───────────────────┘
           │  HTTP POST
┌──────────┴───────────────────┐
│  Next.js API Route           │
│  POST /api/events            │
│  (validates & forwards)      │
└──────────────────────────────┘
```

## Supported Event Types

| Event | Description |
|-------|-------------|
| `agent:start` | Agent begins execution |
| `agent:progress` | Agent progress update (0-100%) |
| `agent:complete` | Agent finishes successfully |
| `agent:error` | Agent encounters an error |
| `pipeline:start` | Multi-stage pipeline begins |
| `pipeline:complete` | Pipeline finishes |
| `task:update` | Task status change |

## Key Design Decisions

1. **Dual-port architecture**: Socket.io on port 3003 (public via Caddy) and a separate internal HTTP API on port 3030. This avoids Socket.io intercepting internal HTTP requests when `path: '/'` is required for Caddy routing.

2. **Event envelope**: Every broadcast includes `id`, `type`, `timestamp`, `project` (optional), and `data`. This provides a consistent interface for all consumers.

3. **Room-based isolation**: Clients join/leave project rooms via `project:join`/`project:leave` events. Server-side emit routes to `project:{name}` rooms when a project is specified.

4. **Validation at both layers**: The API route validates event types and required fields before forwarding. The mini-service also validates on receipt.

## API Reference

### POST /api/events (Next.js)
```json
{
  "event": "agent:start",
  "data": { "agentId": "a1", "agentName": "Code Agent", "taskId": "t1", "project": "demo" },
  "project": "demo"  // optional — routes to project room
}
```

### Socket.io Client Events
- `connected` — welcome payload with available event types
- `project:join(project)` — join a project room
- `project:leave(project)` — leave a project room
- `project:joined` / `project:left` — room membership confirmation

## Verification

- ✅ Health check returns `{ status: "ok" }` with connection/room counts
- ✅ Broadcast emit (no project) works
- ✅ Room-targeted emit (with project) works
- ✅ Invalid event type returns 400 with valid event list
- ✅ ESLint passes with no warnings
