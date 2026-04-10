// AgentOS - Database Client
// Supports: Local SQLite (dev), Turso/libSQL (production/Cloudflare)

import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

// ── Singleton cache (works in all runtimes) ─────────────────────

let _prisma: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
  // Turso/libSQL for production (Cloudflare, Railway, etc.)
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuth = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuth,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  // Local SQLite for development
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["query"] : [],
  });
}

export const db = _prisma ?? createPrismaClient();

// Cache in global scope for local dev hot-reload
if (process.env.NODE_ENV !== "production") {
  _prisma = db;
}
