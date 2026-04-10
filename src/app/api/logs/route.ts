import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/logs — List recent agent logs with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const agentType = searchParams.get('agentType')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50

    // Build the where clause based on filters
    const where: Record<string, unknown> = {}

    if (taskId) {
      where.runId = undefined // Clear if set
      // Find agent runs for this task
      const agentRuns = await db.agentRun.findMany({
        where: { taskId },
        select: { id: true },
      })
      const runIds = agentRuns.map((run) => run.id)
      where.runId = { in: runIds }
    }

    if (agentType) {
      if (where.runId && typeof where.runId === 'object' && 'in' in where.runId) {
        // Filter agent runs by type within those run IDs
        const agentRuns = await db.agentRun.findMany({
          where: {
            id: { in: where.runId.in as string[] },
            agentType,
          },
          select: { id: true },
        })
        where.runId = { in: agentRuns.map((run) => run.id) }
      } else {
        // Filter agent runs by type
        const agentRuns = await db.agentRun.findMany({
          where: { agentType },
          select: { id: true },
        })
        const runIds = agentRuns.map((run) => run.id)
        where.runId = { in: runIds }
      }
    }

    const logs = await db.agentLog.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        agentRun: {
          select: {
            agentType: true,
            agentName: true,
            taskId: true,
          },
        },
      },
    })

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAt: log.createdAt,
      agentRun: log.agentRun,
    }))

    return NextResponse.json({ success: true, data: formattedLogs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
