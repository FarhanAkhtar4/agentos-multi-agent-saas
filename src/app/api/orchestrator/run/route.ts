import { NextRequest, NextResponse } from "next/server";

interface PipelineRunRequestBody {
  task_title: string;
  task_description: string;
  priority?: "low" | "medium" | "high" | "critical";
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

const FASTAPI_PORT = 3100;

export async function POST(request: NextRequest) {
  try {
    const body: PipelineRunRequestBody = await request.json();

    // Validate required fields
    if (!body.task_title || !body.task_description) {
      const errorResponse: ApiResponse = {
        success: false,
        message: "Missing required fields: task_title and task_description",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const res = await fetch(
      `/api/v1/pipeline/run?XTransformPort=${FASTAPI_PORT}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    const response: ApiResponse = {
      success: res.ok,
      data,
      message: res.ok ? "Pipeline run initiated" : "Pipeline run failed",
    };

    return NextResponse.json(response, { status: res.ok ? 200 : 502 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const errorResponse: ApiResponse = {
      success: false,
      message: `Failed to run pipeline: ${message}`,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
