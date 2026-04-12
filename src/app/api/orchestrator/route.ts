import { NextResponse } from "next/server";

interface OrchestratorStatusResponse {
  success: boolean;
  data: {
    health: unknown | null;
    config: unknown | null;
    agents: unknown | null;
    tools: unknown | null;
    pipelines: unknown | null;
    timestamp: string;
  };
  message?: string;
}

const FASTAPI_PORT = 3100;

async function safeFetch(
  path: string,
  label: string
): Promise<{ label: string; data: unknown | null; ok: boolean }> {
  try {
    const res = await fetch(`${path}?XTransformPort=${FASTAPI_PORT}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return { label, data: null, ok: false };
    }
    const data = await res.json();
    return { label, data, ok: true };
  } catch {
    return { label, data: null, ok: false };
  }
}

export async function GET() {
  const [health, config, agents, tools, pipelines] = await Promise.all([
    safeFetch("/health", "health"),
    safeFetch("/api/v1/config", "config"),
    safeFetch("/api/v1/agents", "agents"),
    safeFetch("/api/v1/tools", "tools"),
    safeFetch("/api/v1/pipelines", "pipelines"),
  ]);

  const allOk = [health, config, agents, tools, pipelines].every(
    (r) => r.ok
  );

  const body: OrchestratorStatusResponse = {
    success: allOk,
    data: {
      health: health.data,
      config: config.data,
      agents: agents.data,
      tools: tools.data,
      pipelines: pipelines.data,
      timestamp: new Date().toISOString(),
    },
  };

  if (!allOk) {
    const failedEndpoints = [health, config, agents, tools, pipelines]
      .filter((r) => !r.ok)
      .map((r) => r.label);
    body.message = `Some endpoints failed: ${failedEndpoints.join(", ")}`;
  }

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
  });
}
