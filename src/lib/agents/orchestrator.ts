// AgentOS - Agent Orchestrator Engine
// ====================================

import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { pipelineOrder, getAgentConfig } from './config'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

interface PipelineResult {
  taskId: string
  projectId: string
  success: boolean
  agentRuns: Array<{
    id: string
    agentType: string
    agentName: string
    status: string
    output: string | null
    duration: number | null
    error: string | null
  }>
  finalOutput: string | null
  error: string | null
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    thinking: { type: 'disabled' },
  })

  const messageContent = completion.choices[0]?.message?.content
  if (!messageContent) {
    throw new Error('No response content from LLM')
  }

  return messageContent
}

async function createAgentLog(
  runId: string,
  level: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.agentLog.create({
      data: {
        runId,
        level,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch {
    // Log creation should not block the pipeline
  }
}

async function runAgent(
  agentType: string,
  order: number,
  taskId: string,
  projectId: string,
  originalInput: string,
  previousContext: string | null
): Promise<{
  id: string
  output: string | null
  duration: number | null
  error: string | null
  status: string
}> {
  const agentConfig = getAgentConfig(agentType)
  if (!agentConfig) {
    return { id: '', output: null, duration: null, error: `Unknown agent type: ${agentType}`, status: 'failed' }
  }

  // Create AgentRun record
  const agentRun = await db.agentRun.create({
    data: {
      taskId,
      projectId,
      agentType: agentConfig.id,
      agentName: agentConfig.name,
      status: 'running',
      input: previousContext ? `${originalInput}\n\n[Previous Agent Output]:\n${previousContext}` : originalInput,
      order,
    },
  })

  await createAgentLog(agentRun.id, 'info', `${agentConfig.name} started processing`, {
    agentType: agentConfig.id,
    order,
  })

  let lastError: string | null = null

  // Build the user message for the LLM
  let userMessage: string
  if (order === 0) {
    // First agent (CEO) — receives the original user request only
    userMessage = `User Request:\n${originalInput}`
  } else {
    // Subsequent agents — receive both the original request and previous agent's output
    userMessage = `User Request:\n${originalInput}\n\nPrevious Agent Analysis:\n${previousContext}`
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now()

      const output = await callLLM(agentConfig.systemPrompt, userMessage)
      const duration = Date.now() - startTime

      // Update AgentRun record with success
      await db.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: 'completed',
          output,
          duration,
        },
      })

      await createAgentLog(
        agentRun.id,
        'info',
        `${agentConfig.name} completed successfully in ${duration}ms`,
        { duration, outputLength: output.length }
      )

      return { id: agentRun.id, output, duration, error: null, status: 'completed' }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)

      await createAgentLog(
        agentRun.id,
        attempt < MAX_RETRIES ? 'warn' : 'error',
        `${agentConfig.name} attempt ${attempt + 1} failed: ${lastError}`,
        { attempt: attempt + 1, maxRetries: MAX_RETRIES + 1 }
      )

      if (attempt < MAX_RETRIES) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
      }
    }
  }

  // All retries exhausted — mark as failed
  await db.agentRun.update({
    where: { id: agentRun.id },
    data: {
      status: 'failed',
      error: lastError,
    },
  })

  await createAgentLog(agentRun.id, 'error', `${agentConfig.name} failed after all retries`, {
    lastError,
  })

  return { id: agentRun.id, output: null, duration: null, error: lastError, status: 'failed' }
}

export async function runPipeline(
  taskId: string,
  input: string,
  projectId: string
): Promise<PipelineResult> {
  // Update task status to running
  await db.task.update({
    where: { id: taskId },
    data: {
      status: 'running',
      input,
    },
  })

  const agentRuns: PipelineResult['agentRuns'] = []
  let accumulatedContext: string | null = null
  let hasError = false
  let finalOutput: string | null = null

  // Run agents sequentially through the pipeline
  for (let i = 0; i < pipelineOrder.length; i++) {
    const agentType = pipelineOrder[i]

    // If a previous agent failed, we stop the pipeline
    if (hasError) {
      // Mark remaining agents as cancelled
      const agentConfig = getAgentConfig(agentType)
      if (agentConfig) {
        const skippedRun = await db.agentRun.create({
          data: {
            taskId,
            projectId,
            agentType: agentConfig.id,
            agentName: agentConfig.name,
            status: 'failed',
            input: accumulatedContext || input,
            order: i,
            error: 'Pipeline stopped due to previous agent failure',
          },
        })

        agentRuns.push({
          id: skippedRun.id,
          agentType: agentConfig.id,
          agentName: agentConfig.name,
          status: 'failed',
          output: null,
          duration: null,
          error: 'Pipeline stopped due to previous agent failure',
        })

        await createAgentLog(
          skippedRun.id,
          'warn',
          `${agentConfig.name} skipped due to pipeline failure`
        )
      }
      continue
    }

    const result = await runAgent(agentType, i, taskId, projectId, input, accumulatedContext)

    agentRuns.push({
      id: result.id,
      agentType,
      agentName: getAgentConfig(agentType)?.name || agentType,
      status: result.status,
      output: result.output,
      duration: result.duration,
      error: result.error,
    })

    if (result.status === 'completed' && result.output) {
      // Accumulate context: pass previous agent's output to next agent
      accumulatedContext = result.output
      finalOutput = result.output
    } else {
      hasError = true
    }
  }

  // Update task status based on pipeline result
  const taskStatus = hasError ? 'failed' : 'completed'
  await db.task.update({
    where: { id: taskId },
    data: {
      status: taskStatus,
      output: finalOutput,
    },
  })

  return {
    taskId,
    projectId,
    success: !hasError,
    agentRuns,
    finalOutput,
    error: hasError ? 'One or more agents failed during pipeline execution' : null,
  }
}

export type { PipelineResult }
