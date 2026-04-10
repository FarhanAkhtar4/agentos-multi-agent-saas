import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/chat/sessions — List chat sessions
export async function GET() {
  try {
    const sessions = await db.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    })

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      messageCount: session._count.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }))

    return NextResponse.json({ success: true, data: formattedSessions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/chat/sessions — Create new chat session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title } = body

    const session = await db.chatSession.create({
      data: {
        title: title?.trim() || 'New Session',
        status: 'active',
      },
    })

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
