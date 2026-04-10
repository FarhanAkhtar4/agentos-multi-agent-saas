import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/chat/sessions/[id] — Get chat session with messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await db.chatSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chat session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: session })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE /api/chat/sessions/[id] — Delete chat session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await db.chatSession.findUnique({ where: { id } })
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chat session not found' },
        { status: 404 }
      )
    }

    await db.chatSession.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
