import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/projects — List all projects with task count
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      taskCount: project._count.tasks,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }))

    return NextResponse.json({ success: true, data: formattedProjects })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/projects — Create new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      )
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
