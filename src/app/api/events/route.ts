// AgentOS v2 - Cloudflare Pages Events Route
// Gracefully handles when the mini-service is not available (e.g., on Cloudflare)

import { NextRequest, NextResponse } from "next/server";

/** Valid AgentOS event types */
const VALID_EVENTS = [
  "agent:start",
  "agent:progress",
  "agent:complete",
  "agent:error",
  "pipeline:start",
  "pipeline:complete",
  "task:update",
] as const;

type AgentEventType = (typeof VALID_EVENTS)[number];

interface EmitEventRequest {
  event: string;
  data: Record<string, unknown>;
  project?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmitEventRequest = await request.json();

    if (!body.event || typeof body.event !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "event" field' },
        { status: 400 }
      );
    }

    if (!(VALID_EVENTS as readonly string[]).includes(body.event)) {
      return NextResponse.json(
        {
          error: `Invalid event type "${body.event}"`,
          validEvents: VALID_EVENTS,
        },
        { status: 400 }
      );
    }

    if (body.data === undefined || body.data === null) {
      return NextResponse.json(
        { error: 'Missing "data" field' },
        { status: 400 }
      );
    }

    // Try to forward to mini-service if available (local dev only)
    // On Cloudflare, this will gracefully fail since there's no localhost:3030
    const MINI_SERVICE_URL = `${process.env.MINI_SERVICE_URL || "http://localhost:3030"}/emit`;

    try {
      const response = await fetch(MINI_SERVICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: body.event,
          data: body.data,
          project: body.project ?? undefined,
        }),
        signal: AbortSignal.timeout(3000), // 3s timeout
      });

      if (response.ok) {
        const result = await response.json();
        return NextResponse.json({
          success: true,
          event: body.event as AgentEventType,
          project: body.project ?? null,
          eventId: result.eventId,
        });
      }
    } catch {
      // Mini-service not available — accept event but note it wasn't broadcast
      return NextResponse.json({
        success: true,
        event: body.event as AgentEventType,
        project: body.project ?? null,
        warning: "Event accepted but not broadcast (mini-service unavailable)",
      });
    }

    return NextResponse.json({
      success: true,
      event: body.event as AgentEventType,
      project: body.project ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
