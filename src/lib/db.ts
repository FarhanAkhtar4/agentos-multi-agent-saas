// AgentOS - Database Client
// Supports both local SQLite and Vercel Postgres

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // On Vercel with Postgres, disable query logging for performance
  const isVercel = !!process.env.VERCEL
  return new PrismaClient({
    ...(isVercel ? {} : { log: ['query'] }),
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
