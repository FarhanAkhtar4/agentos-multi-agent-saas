import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { getAgentConfig } from '@/lib/agents/config'

export const runtime = 'nodejs'

// POST /api/chat — Send chat message and get AI response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, sessionId, agentType } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create chat session
    let targetSessionId = sessionId

    if (!targetSessionId) {
      // Create a new session
      const agentConfig = agentType ? getAgentConfig(agentType) : null
      const sessionTitle = message.trim().substring(0, 50) + (message.length > 50 ? '...' : '')

      const newSession = await db.chatSession.create({
        data: {
          title: sessionTitle,
          status: 'active',
        },
      })

      targetSessionId = newSession.id
    } else {
      // Verify session exists
      const session = await db.chatSession.findUnique({ where: { id: targetSessionId } })
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Chat session not found' },
          { status: 404 }
        )
      }
    }

    // Save user message
    await db.chatMessage.create({
      data: {
        sessionId: targetSessionId,
        role: 'user',
        content: message.trim(),
      },
    })

    // Get conversation history (last 10 messages for context)
    const history = await db.chatMessage.findMany({
      where: { sessionId: targetSessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // Build system prompt based on agent type or default
    let systemPrompt = 'You are AgentOS Assistant, a helpful AI assistant for a multi-agent SaaS platform. Help users manage their projects, tasks, and understand agent outputs.'
    let responseAgentType: string | null = null

    if (agentType) {
      const agentConfig = getAgentConfig(agentType)
      if (agentConfig) {
        systemPrompt = agentConfig.systemPrompt
        responseAgentType = agentType
      }
    }

    // Build messages for LLM
    const llmMessages = [
      {
        role: 'assistant' as const,
        content: systemPrompt,
      },
      ...history.slice(0, -1).map((msg) => ({
        role: (msg.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message.trim(),
      },
    ]

    // Call LLM
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: llmMessages,
      thinking: { type: 'disabled' },
    })

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    // Save assistant message
    await db.chatMessage.create({
      data: {
        sessionId: targetSessionId,
        role: 'assistant',
        content: assistantMessage,
        agentType: responseAgentType,
      },
    })

    // Update session timestamp
    await db.chatSession.update({
      where: { id: targetSessionId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        sessionId: targetSessionId,
        message: assistantMessage,
        agentType: responseAgentType,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
