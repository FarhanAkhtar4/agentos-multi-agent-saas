import { createServer } from 'http'
import { Server } from 'socket.io'

// ── Valid event types for AgentOS ──────────────────────────────────────────
const VALID_EVENTS = [
  'agent:start',
  'agent:progress',
  'agent:complete',
  'agent:error',
  'pipeline:start',
  'pipeline:complete',
  'task:update',
] as const

export type AgentEventType = (typeof VALID_EVENTS)[number]

// ── Event payload interfaces ───────────────────────────────────────────────
export interface BaseEvent {
  id: string
  type: AgentEventType
  timestamp: string
  project?: string
}

export interface AgentStartEvent extends BaseEvent {
  type: 'agent:start'
  data: {
    agentId: string
    agentName: string
    taskId: string
    project: string
    metadata?: Record<string, unknown>
  }
}

export interface AgentProgressEvent extends BaseEvent {
  type: 'agent:progress'
  data: {
    agentId: string
    progress: number       // 0-100
    message: string
    step?: string
    metadata?: Record<string, unknown>
  }
}

export interface AgentCompleteEvent extends BaseEvent {
  type: 'agent:complete'
  data: {
    agentId: string
    result: unknown
    duration: number       // ms
    metadata?: Record<string, unknown>
  }
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error'
  data: {
    agentId: string
    error: string
    code?: string
    recoverable: boolean
    metadata?: Record<string, unknown>
  }
}

export interface PipelineStartEvent extends BaseEvent {
  type: 'pipeline:start'
  data: {
    pipelineId: string
    pipelineName: string
    stages: string[]
    project: string
    metadata?: Record<string, unknown>
  }
}

export interface PipelineCompleteEvent extends BaseEvent {
  type: 'pipeline:complete'
  data: {
    pipelineId: string
    result: unknown
    duration: number       // ms
    stageResults?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }
}

export interface TaskUpdateEvent extends BaseEvent {
  type: 'task:update'
  data: {
    taskId: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
    title?: string
    description?: string
    assignee?: string
    metadata?: Record<string, unknown>
  }
}

export type AgentEvent =
  | AgentStartEvent
  | AgentProgressEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | PipelineStartEvent
  | PipelineCompleteEvent
  | TaskUpdateEvent

// ── Helpers ────────────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

function isValidEvent(type: string): type is AgentEventType {
  return (VALID_EVENTS as readonly string[]).includes(type)
}

function getRoomSummary(): Record<string, number> {
  const rooms: Record<string, number> = {}
  for (const [name, socketSet] of io.sockets.adapter.rooms) {
    // Only show actual rooms, not individual socket IDs
    if (!socketSet.has(name as unknown as never)) {
      rooms[name] = socketSet.size
    }
  }
  return rooms
}

// ── Socket.io server (port 3003) — public-facing via Caddy ────────────────
const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to forward requests to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ── Connection handling ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect] socket ${socket.id} — total connections: ${io.sockets.sockets.size}`)

  // Send welcome payload with available event types
  socket.emit('connected', {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    availableEvents: VALID_EVENTS,
  })

  // ── Join a project room ────────────────────────────────────────────────
  socket.on('project:join', (project: string) => {
    if (typeof project !== 'string' || !project.trim()) {
      socket.emit('error', { message: 'Invalid project name' })
      return
    }
    const room = `project:${project.trim()}`
    socket.join(room)
    console.log(`[room:join] socket ${socket.id} → ${room}`)
    socket.emit('project:joined', { project: project.trim(), room })
  })

  // ── Leave a project room ───────────────────────────────────────────────
  socket.on('project:leave', (project: string) => {
    if (typeof project !== 'string' || !project.trim()) {
      socket.emit('error', { message: 'Invalid project name' })
      return
    }
    const room = `project:${project.trim()}`
    socket.leave(room)
    console.log(`[room:leave] socket ${socket.id} ← ${room}`)
    socket.emit('project:left', { project: project.trim(), room })
  })

  // ── Disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[disconnect] socket ${socket.id} (${reason}) — total connections: ${io.sockets.sockets.size}`)
  })

  // ── Error handling ─────────────────────────────────────────────────────
  socket.on('error', (error) => {
    console.error(`[error] socket ${socket.id}:`, error)
  })
})

// ── Internal HTTP server (port 3030) — used by the Next.js API route ──────
// This is a separate lightweight HTTP server that forwards events to the
// Socket.io instance above. It avoids conflicts with Socket.io's request
// handling on the public port.
const INTERNAL_PORT = 3030

const internalServer = createServer((req, res) => {
  // ── POST /emit — broadcast an event to connected Socket.io clients ────
  if (req.method === 'POST' && req.url === '/emit') {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const payload = JSON.parse(body) as {
          event: string
          data: unknown
          project?: string
        }

        const eventType = payload.event
        const eventData = payload.data
        const project = payload.project

        if (!isValidEvent(eventType)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            error: 'Invalid event type',
            validEvents: VALID_EVENTS,
          }))
          return
        }

        // Build the full event object with envelope
        const agentEvent: AgentEvent = {
          id: generateId(),
          type: eventType,
          timestamp: new Date().toISOString(),
          project,
          data: eventData as AgentEvent['data'],
        } as AgentEvent

        if (project) {
          // Emit to a specific project room only
          io.to(`project:${project}`).emit(eventType, agentEvent)
          console.log(`[emit→room:project:${project}] ${eventType}`)
        } else {
          // Broadcast to all connected clients
          io.emit(eventType, agentEvent)
          console.log(`[emit→broadcast] ${eventType}`)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, eventId: agentEvent.id }))

      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  // ── GET /health — service health check ─────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      connections: io.sockets.sockets.size,
      rooms: getRoomSummary(),
      uptime: process.uptime(),
    }))
    return
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ── Start both servers ─────────────────────────────────────────────────────
const SOCKET_PORT = 3003

httpServer.listen(SOCKET_PORT, () => {
  console.log(`[agent-events] Socket.io server running on port ${SOCKET_PORT}`)
})

internalServer.listen(INTERNAL_PORT, () => {
  console.log(`[agent-events] Internal HTTP API on port ${INTERNAL_PORT} (/emit, /health)`)
})

// ── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`[agent-events] Received ${signal}, shutting down...`)
  io.disconnectSockets(true)
  httpServer.close(() => {
    internalServer.close(() => {
      console.log('[agent-events] All servers closed')
      process.exit(0)
    })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
