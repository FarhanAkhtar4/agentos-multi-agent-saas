// AgentOS - Database Client
// Supports: Local SQLite (dev), Turso/libSQL (production/Cloudflare)

import { PrismaClient } from "@prisma/client";

// ── Singleton cache (works in all runtimes) ─────────────────────

let _prisma: PrismaClient | null = null;

async function createPrismaClient(): Promise<PrismaClient> {
  // Turso/libSQL for production (Cloudflare, Railway, etc.)
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuth = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    // Dynamic import to avoid bundling libSQL when not needed
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    const { createClient } = await import("@libsql/client");

    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuth,
    });
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({ adapter });
  }

  // Local SQLite for development
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["query"] : [],
  });
}

// Synchronous factory for initial boot (local SQLite only)
function createLocalClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });
}

export const db: PrismaClient = _prisma ?? createLocalClient();

// Cache in global scope for local dev hot-reload
if (process.env.NODE_ENV !== "production") {
  _prisma = db;
}
