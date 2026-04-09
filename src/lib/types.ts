// AgentOS - Shared Types
// =========================

export interface AgentConfig {
  id: string
  name: string
  role: string
  description: string
  systemPrompt: string
  color: string
  icon: string
}

export interface AgentRun {
  id: string
  taskId: string
  projectId: string
  agentType: string
  agentName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: string | null
  output: string | null
  error: string | null
  duration: number | null
  order: number
  createdAt: string
  updatedAt: string
  logs?: AgentLog[]
}

export interface AgentLog {
  id: string
  runId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  metadata: Record<string, unknown> | string | null
  createdAt: string
  agentRun?: {
    agentType: string
    agentName: string
    taskId: string
  }
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  input: string | null
  output: string | null
  createdAt: string
  updatedAt: string
  agentRuns?: AgentRun[]
}

export interface Project {
  id: string
  name: string
  description: string | null
  status: 'active' | 'completed' | 'archived'
  createdAt: string
  updatedAt: string
  tasks?: Task[]
  _count?: { tasks: number }
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  agentType?: string | null
  content: string
  createdAt: string
}

export interface ChatSession {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  messages?: ChatMessage[]
}

export interface PipelineEvent {
  id: string
  type: 'agent:start' | 'agent:progress' | 'agent:complete' | 'agent:error' | 'pipeline:start' | 'pipeline:complete' | 'task:update'
  timestamp: string
  project?: string
  data: Record<string, unknown>
}

export interface SystemStatus {
  status: string
  timestamp: string
  stats: {
    totalProjects: number
    totalTasks: number
    completedTasks: number
    failedTasks: number
    totalAgentRuns: number
    recentActivity: AgentRun[]
  }
}

export type ViewType = 'dashboard' | 'pipeline' | 'chat' | 'projects' | 'logs'
