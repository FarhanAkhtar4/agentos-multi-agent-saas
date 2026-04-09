# AgentOS — Multi-Agent AI Platform

<p align="center">
  <strong>Production-ready multi-agent orchestration platform</strong><br/>
  Deploy intelligent AI agent teams to collaborate on complex tasks autonomously.
</p>

---

## 🏗️ Architecture

```
User Request → CEO → PM → Developer → QA → DevOps → Final Output
```

**5 specialized AI agents** execute sequentially through a configurable pipeline:

| Agent | Role | Responsibility |
|-------|------|----------------|
| 🏛️ CEO Agent | Chief Executive Officer | Strategic goal decomposition |
| 📋 PM Agent | Product Manager | PRD & feature specifications |
| 💻 Developer Agent | Senior Developer | Architecture & code structure |
| 🛡️ QA Agent | QA Engineer | Testing strategy & validation |
| 🚀 DevOps Agent | DevOps Engineer | Deployment & infrastructure |

## ✨ Features

- **Pipeline Execution** — Run multi-agent pipelines with real LLM-powered agents
- **Interactive Chat** — Talk to individual agents or the general assistant
- **Project Management** — Organize tasks under projects
- **Real-time Logs** — Monitor agent execution with filtered log viewer
- **Output Viewer** — Inspect full agent outputs in slide-out panels
- **Dark Mode** — Full dark/light theme support
- **Responsive** — Mobile-first design with collapsible sidebar

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **UI**: Tailwind CSS 4 + shadcn/ui + Lucide Icons
- **Database**: SQLite via Prisma ORM
- **AI**: z-ai-web-dev-sdk (LLM integration)
- **State**: Zustand
- **Real-time**: Socket.io (WebSocket mini-service)

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Setup database
bun run db:push

# Start development server
bun run dev

# Start WebSocket event service
cd mini-services/agent-events && bun install && bun --hot index.ts &
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | System health & stats |
| POST | `/api/run-agent` | Execute full agent pipeline |
| GET/POST | `/api/projects` | List/create projects |
| GET/DELETE | `/api/projects/[id]` | Get/delete project |
| GET/POST | `/api/projects/[id]/tasks` | List/create tasks |
| GET/PATCH | `/api/tasks/[id]` | Get/update task |
| POST | `/api/chat` | Send message, get AI response |
| GET/POST | `/api/chat/sessions` | List/create chat sessions |
| GET/DELETE | `/api/chat/sessions/[id]` | Get/delete session |
| GET | `/api/logs` | Agent execution logs |
| POST | `/api/events` | Emit real-time event |

## 🧪 Testing

All API endpoints have been tested with validation, error handling, and edge cases:

- ✅ Input validation (400 for missing/empty required fields)
- ✅ Resource validation (404 for nonexistent projects)
- ✅ Full pipeline execution (5 agents, real LLM calls)
- ✅ Chat with individual agents
- ✅ Retry logic with exponential backoff
- ✅ Error recovery in orchestrator

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                    # 12 API routes
│   │   ├── projects/           # Project CRUD
│   │   ├── tasks/              # Task management
│   │   ├── run-agent/          # Pipeline execution
│   │   ├── chat/               # Chat & sessions
│   │   ├── status/             # System health
│   │   ├── logs/               # Agent logs
│   │   └── events/             # WebSocket events
│   ├── layout.tsx
│   ├── page.tsx                # Main UI (all views)
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui components
│   └── theme-provider.tsx
├── lib/
│   ├── agents/
│   │   ├── config.ts           # Agent definitions
│   │   └── orchestrator.ts     # Pipeline engine
│   ├── db.ts                   # Prisma client
│   ├── store.ts                # Zustand state
│   ├── types.ts                # TypeScript types
│   └── utils.ts
mini-services/
└── agent-events/               # WebSocket service (port 3003)
```

## License

MIT
