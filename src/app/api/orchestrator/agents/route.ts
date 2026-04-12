import { NextResponse } from "next/server";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

const FASTAPI_PORT = 3100;

export async function GET() {
  try {
    const res = await fetch(`/api/v1/agents?XTransformPort=${FASTAPI_PORT}`, {
      cache: "no-store",
    });

    const data = await res.json();

    const response: ApiResponse = {
      success: res.ok,
      data,
      message: res.ok ? "Agents retrieved" : "Failed to retrieve agents",
    };

    return NextResponse.json(response, { status: res.ok ? 200 : 502 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const errorResponse: ApiResponse = {
      success: false,
      message: `Failed to fetch agents: ${message}`,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
