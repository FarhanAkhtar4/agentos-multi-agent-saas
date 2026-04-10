import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/status — Get system status
export async function GET() {
  try {
    const [
      totalProjects,
      activeProjects,
      totalTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      totalAgentRuns,
      runningAgentRuns,
      recentTasks,
      recentAgentRuns,
      totalChatSessions,
    ] = await Promise.all([
      // Total projects
      db.project.count(),
      // Active projects
      db.project.count({ where: { status: 'active' } }),
      // Total tasks
      db.task.count(),
      // Running tasks
      db.task.count({ where: { status: 'running' } }),
      // Completed tasks
      db.task.count({ where: { status: 'completed' } }),
      // Failed tasks
      db.task.count({ where: { status: 'failed' } }),
      // Total agent runs
      db.agentRun.count(),
      // Running agent runs
      db.agentRun.count({ where: { status: 'running' } }),
      // Recent 5 tasks
      db.task.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
          project: {
            select: { name: true },
          },
        },
      }),
      // Recent 10 agent runs
      db.agentRun.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          agentType: true,
          agentName: true,
          status: true,
          duration: true,
          createdAt: true,
        },
      }),
      // Total chat sessions
      db.chatSession.count(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        health: 'ok',
        timestamp: new Date().toISOString(),
        stats: {
          projects: {
            total: totalProjects,
            active: activeProjects,
          },
          tasks: {
            total: totalTasks,
            running: runningTasks,
            completed: completedTasks,
            failed: failedTasks,
          },
          agents: {
            totalRuns: totalAgentRuns,
            activeRuns: runningAgentRuns,
          },
          chat: {
            totalSessions: totalChatSessions,
          },
        },
        recentActivity: {
          tasks: recentTasks,
          agentRuns: recentAgentRuns,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
