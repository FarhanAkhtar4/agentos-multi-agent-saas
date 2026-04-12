// AgentOS - Database Client
// Supports: Local SQLite (dev), Turso/libSQL (production/Cloudflare)

import { PrismaClient } from "@prisma/client";

// ── Singleton cache (works in all runtimes) ─────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

// Cache in global scope for local dev hot-reload
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
