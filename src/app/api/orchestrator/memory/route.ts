import { NextRequest, NextResponse } from "next/server";

interface MemoryQueryRequestBody {
  query: string;
  n_results?: number;
  agent_filter?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

const FASTAPI_PORT = 3100;

export async function GET() {
  try {
    const res = await fetch(
      `/api/v1/memory/stats?XTransformPort=${FASTAPI_PORT}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    const response: ApiResponse = {
      success: res.ok,
      data,
      message: res.ok
        ? "Memory stats retrieved"
        : "Failed to retrieve memory stats",
    };

    return NextResponse.json(response, { status: res.ok ? 200 : 502 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const errorResponse: ApiResponse = {
      success: false,
      message: `Failed to fetch memory stats: ${message}`,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: MemoryQueryRequestBody = await request.json();

    // Validate required fields
    if (!body.query || typeof body.query !== "string") {
      const errorResponse: ApiResponse = {
        success: false,
        message:
          "Missing required field: query (must be a non-empty string)",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Build query parameters
    const params = new URLSearchParams();
    params.append("XTransformPort", String(FASTAPI_PORT));
    if (body.n_results !== undefined) {
      params.append("n_results", String(body.n_results));
    }
    if (body.agent_filter) {
      params.append("agent_filter", body.agent_filter);
    }

    const res = await fetch(`/api/v1/memory/query?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: body.query }),
    });

    const data = await res.json();

    const response: ApiResponse = {
      success: res.ok,
      data,
      message: res.ok ? "Memory query completed" : "Memory query failed",
    };

    return NextResponse.json(response, { status: res.ok ? 200 : 502 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const errorResponse: ApiResponse = {
      success: false,
      message: `Failed to query memory: ${message}`,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
