import { NextRequest, NextResponse } from 'next/server'

/** Valid AgentOS event types */
const VALID_EVENTS = [
  'agent:start',
  'agent:progress',
  'agent:complete',
  'agent:error',
  'pipeline:start',
  'pipeline:complete',
  'task:update',
] as const

type AgentEventType = (typeof VALID_EVENTS)[number]

/** Schema for the POST body */
interface EmitEventRequest {
  event: string
  data: Record<string, unknown>
  project?: string
}

/**
 * POST /api/events
 *
 * Forwards an AgentOS event to the agent-events WebSocket mini-service,
 * which then broadcasts it to connected Socket.io clients.
 *
 * Body: { event: AgentEventType, data: any, project?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body: EmitEventRequest = await request.json()

    // ── Validate required fields ─────────────────────────────────────────
    if (!body.event || typeof body.event !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "event" field' },
        { status: 400 },
      )
    }

    if (!(VALID_EVENTS as readonly string[]).includes(body.event)) {
      return NextResponse.json(
        {
          error: `Invalid event type "${body.event}"`,
          validEvents: VALID_EVENTS,
        },
        { status: 400 },
      )
    }

    if (body.data === undefined || body.data === null) {
      return NextResponse.json(
        { error: 'Missing "data" field' },
        { status: 400 },
      )
    }

    // ── Forward to the mini-service via its internal HTTP endpoint ───────
    // Port 3030 is the internal HTTP API; port 3003 is the Socket.io server.
    const MINI_SERVICE_URL = `http://localhost:3030/emit`

    const response = await fetch(MINI_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: body.event,
        data: body.data,
        project: body.project ?? undefined,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[api/events] Mini-service returned ${response.status}: ${errorBody}`)
      return NextResponse.json(
        { error: 'Failed to broadcast event via mini-service', detail: errorBody },
        { status: 502 },
      )
    }

    const result = await response.json()
    return NextResponse.json({
      success: true,
      event: body.event as AgentEventType,
      project: body.project ?? null,
      eventId: result.eventId,
    })
  } catch (err) {
    console.error('[api/events] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
