// AgentOS - Agent Configuration
// ===============================

export interface AgentConfig {
  id: string
  name: string
  role: string
  description: string
  systemPrompt: string
  color: string
  icon: string
}

export const agents: Record<string, AgentConfig> = {
  ceo: {
    id: 'ceo',
    name: 'CEO Agent',
    role: 'Chief Executive Officer',
    description: 'Analyzes requests and decomposes them into strategic goals',
    systemPrompt:
      'You are the CEO Agent of AgentOS. Your role is to analyze the user\'s request and decompose it into strategic goals. Output a structured analysis including: 1) Core objective, 2) Key deliverables, 3) Success criteria, 4) Constraints and risks. Be concise and strategic.',
    color: '#8B5CF6',
    icon: 'Crown',
  },
  pm: {
    id: 'pm',
    name: 'PM Agent',
    role: 'Product Manager',
    description: 'Creates detailed product specifications from strategic goals',
    systemPrompt:
      'You are the Product Manager Agent of AgentOS. Based on the CEO\'s strategic analysis, create a detailed product specification including: 1) Feature breakdown, 2) User stories, 3) Technical requirements, 4) Priority matrix. Focus on practical, implementable specifications.',
    color: '#F59E0B',
    icon: 'ClipboardList',
  },
  developer: {
    id: 'developer',
    name: 'Developer Agent',
    role: 'Senior Developer',
    description: 'Generates implementation details and architecture decisions',
    systemPrompt:
      'You are the Senior Developer Agent of AgentOS. Based on the PM\'s specification, generate implementation details including: 1) Architecture decisions, 2) Key components to build, 3) Code structure, 4) Integration points. Focus on clean, maintainable code.',
    color: '#10B981',
    icon: 'Code2',
  },
  qa: {
    id: 'qa',
    name: 'QA Agent',
    role: 'QA Engineer',
    description: 'Reviews implementation and provides testing strategy',
    systemPrompt:
      'You are the QA Engineer Agent of AgentOS. Review the developer\'s implementation plan and provide: 1) Test strategy, 2) Edge cases to handle, 3) Performance considerations, 4) Potential bugs or issues. Be thorough and critical.',
    color: '#EF4444',
    icon: 'ShieldCheck',
  },
  devops: {
    id: 'devops',
    name: 'DevOps Agent',
    role: 'DevOps Engineer',
    description: 'Creates deployment plans and infrastructure recommendations',
    systemPrompt:
      'You are the DevOps Engineer Agent of AgentOS. Based on all previous agent outputs, create: 1) Deployment plan, 2) Infrastructure requirements, 3) CI/CD pipeline steps, 4) Monitoring and alerting recommendations. Focus on reliability and scalability.',
    color: '#06B6D4',
    icon: 'Server',
  },
  hr: {
    id: 'hr',
    name: 'HR Agent',
    role: 'Human Resources',
    description: 'Provides team management and resource planning insights',
    systemPrompt:
      'You are the HR Agent of AgentOS. Based on the project scope and requirements, provide: 1) Team composition recommendations, 2) Resource allocation, 3) Skill gap analysis, 4) Timeline and milestone suggestions. Focus on team efficiency and well-being.',
    color: '#EC4899',
    icon: 'Users',
  },
}

// Pipeline execution order: CEO → PM → Developer → QA → DevOps
export const pipelineOrder: string[] = ['ceo', 'pm', 'developer', 'qa', 'devops']

// Helper functions
export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return agents[agentId]
}

export function getPipelineAgents(): AgentConfig[] {
  return pipelineOrder.map((id) => agents[id]).filter(Boolean)
}

export function getAgentByIndex(index: number): AgentConfig | undefined {
  const agentId = pipelineOrder[index]
  return agentId ? agents[agentId] : undefined
}

export function getAllAgentIds(): string[] {
  return Object.keys(agents)
}

export function getPipelineStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
  }
  return labels[status] || status
}

export function getTaskStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

export function getProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  }
  return labels[status] || status
}
