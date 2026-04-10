import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runPipeline } from '@/lib/agents/orchestrator'

export const runtime = 'nodejs'

// POST /api/run-agent — Run the full agent pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId: bodyProjectId, title, description } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Task title is required' },
        { status: 400 }
      )
    }

    // Get or create project
    let projectId = bodyProjectId
    if (!projectId || typeof projectId !== 'string') {
      const project = await db.project.create({
        data: {
          name: title.trim(),
          description: description?.trim() || `Pipeline run: ${title.trim()}`,
          status: 'active',
        },
      })
      projectId = project.id
    } else {
      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        )
      }
    }

    const taskDescription = description?.trim() || title.trim()

    // Create the task
    const task = await db.task.create({
      data: {
        projectId,
        title: title.trim(),
        description: taskDescription,
        status: 'running',
        input: taskDescription,
        priority: 'high',
      },
    })

    // Run the pipeline and return when complete
    const pipelineResult = await runPipeline(task.id, taskDescription, projectId)

    return NextResponse.json({
      success: pipelineResult.success,
      data: {
        taskId: pipelineResult.taskId,
        projectId: pipelineResult.projectId,
        status: pipelineResult.success ? 'completed' : 'failed',
        agentRuns: pipelineResult.agentRuns,
        finalOutput: pipelineResult.finalOutput,
        error: pipelineResult.error,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
