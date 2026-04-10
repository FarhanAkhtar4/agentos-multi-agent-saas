// AgentOS - Global State Store
// ===============================

import { create } from 'zustand'
import type { 
  Project, 
  Task, 
  AgentRun, 
  AgentLog, 
  ChatSession, 
  ChatMessage, 
  ViewType,
  SystemStatus 
} from '@/lib/types'

interface AgentOSState {
  // Navigation
  currentView: ViewType
  setCurrentView: (view: ViewType) => void

  // Selected items
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void

  // Projects
  projects: Project[]
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void

  // Tasks
  currentTask: Task | null
  setCurrentTask: (task: Task | null) => void
  updateTaskStatus: (taskId: string, status: Task['status']) => void

  // Pipeline
  pipelineRuns: AgentRun[]
  setPipelineRuns: (runs: AgentRun[]) => void
  addPipelineRun: (run: AgentRun) => void
  isPipelineRunning: boolean
  setIsPipelineRunning: (running: boolean) => void
  pipelineProgress: number
  setPipelineProgress: (progress: number) => void

  // Chat
  chatSessions: ChatSession[]
  setChatSessions: (sessions: ChatSession[]) => void
  currentSession: ChatSession | null
  setCurrentSession: (session: ChatSession | null) => void
  addChatMessage: (message: ChatMessage) => void

  // Logs
  logs: AgentLog[]
  setLogs: (logs: AgentLog[]) => void

  // System
  systemStatus: SystemStatus | null
  setSystemStatus: (status: SystemStatus) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  outputViewerOpen: boolean
  setOutputViewerOpen: (open: boolean) => void
  viewingOutput: AgentRun | null
  setViewingOutput: (run: AgentRun | null) => void
}

export const useAgentOSStore = create<AgentOSState>((set) => ({
  // Navigation
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),

  // Selected items
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  // Projects
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
  removeProject: (id) => set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

  // Tasks
  currentTask: null,
  setCurrentTask: (task) => set({ currentTask: task }),
  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      currentTask: state.currentTask?.id === taskId ? { ...state.currentTask, status } : state.currentTask,
    })),

  // Pipeline
  pipelineRuns: [],
  setPipelineRuns: (runs) => set({ pipelineRuns: runs }),
  addPipelineRun: (run) => set((state) => ({ pipelineRuns: [...state.pipelineRuns, run] })),
  isPipelineRunning: false,
  setIsPipelineRunning: (running) => set({ isPipelineRunning: running }),
  pipelineProgress: 0,
  setPipelineProgress: (progress) => set({ pipelineProgress: progress }),

  // Chat
  chatSessions: [],
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),
  addChatMessage: (message) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            messages: [...(state.currentSession.messages || []), message],
          }
        : state.currentSession,
    })),

  // Logs
  logs: [],
  setLogs: (logs) => set({ logs }),

  // System
  systemStatus: null,
  setSystemStatus: (status) => set({ systemStatus: status }),

  // UI
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  outputViewerOpen: false,
  setOutputViewerOpen: (open) => set({ outputViewerOpen: open }),
  viewingOutput: null,
  setViewingOutput: (run) => set({ viewingOutput: run }),
}))
