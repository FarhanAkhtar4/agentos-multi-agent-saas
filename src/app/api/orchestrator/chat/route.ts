import { NextRequest, NextResponse } from "next/server";

interface ChatRequestBody {
  message: string;
  session_id?: string;
  agent_type?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

const FASTAPI_PORT = 3100;

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();

    // Validate required fields
    if (!body.message || typeof body.message !== "string") {
      const errorResponse: ApiResponse = {
        success: false,
        message:
          "Missing required field: message (must be a non-empty string)",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const res = await fetch(`/api/v1/chat?XTransformPort=${FASTAPI_PORT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    const response: ApiResponse = {
      success: res.ok,
      data,
      message: res.ok ? "Chat response received" : "Chat request failed",
    };

    return NextResponse.json(response, { status: res.ok ? 200 : 502 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const errorResponse: ApiResponse = {
      success: false,
      message: `Failed to process chat: ${message}`,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
