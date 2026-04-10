import { spawn, ChildProcess } from "child_process";

const PORT = 3100;
const ORCHESTRATOR_DIR = "/home/z/my-project/mini-services/agent-orchestrator";

const child: ChildProcess = spawn(
  "python3",
  ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", String(PORT), "--log-level", "info", "--reload"],
  {
    cwd: ORCHESTRATOR_DIR,
    env: {
      ...process.env,
      PYTHONPATH: ORCHESTRATOR_DIR,
    },
    stdio: ["inherit", "pipe", "pipe"],
  }
);

child.stdout?.on("data", (data: Buffer) => {
  console.log(`[orchestrator:${PORT}] ${data.toString().trim()}`);
});

child.stderr?.on("data", (data: Buffer) => {
  console.error(`[orchestrator:${PORT}] ${data.toString().trim()}`);
});

child.on("error", (err) => {
  console.error(`[orchestrator:${PORT}] Failed to start:`, err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  console.log(`[orchestrator:${PORT}] Exited with code=${code}, signal=${signal}`);
  // Restart on crash
  if (code !== 0 && code !== null) {
    console.log(`[orchestrator:${PORT}] Restarting in 3s...`);
    setTimeout(() => {
      process.exit(1); // bun --hot will restart
    }, 3000);
  }
});

// Health check
setTimeout(async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/health`);
    const data = await res.json();
    console.log(`[orchestrator:${PORT}] Health check: ${JSON.stringify(data)}`);
  } catch {
    console.log(`[orchestrator:${PORT}] Health check failed (service may still be starting)`);
  }
}, 5000);

console.log(`[orchestrator:${PORT}] Starting FastAPI service on port ${PORT}...`);
