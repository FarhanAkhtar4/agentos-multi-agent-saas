"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Crown, ClipboardList, Code2, ShieldCheck, Server,
  LayoutDashboard, MessageSquare, FolderKanban, ScrollText,
  Play, ChevronRight, Loader2, CheckCircle2, XCircle,
  AlertCircle, Clock, Zap, BarChart3, Brain, Activity,
  Send, Plus, Eye, PanelRightClose, PanelRightOpen,
  Bot, User, ArrowRight, Terminal, FileText
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAgentOSStore } from "@/lib/store";
import type {
  ViewType, AgentRun, ChatMessage, AgentLog, SystemStatus
} from "@/lib/types";

/* ================================================================
   AGENT CONFIGURATION (CLIENT-SIDE MIRROR)
   ================================================================ */

const AGENTS_CONFIG = [
  { id: "ceo", name: "CEO Agent", role: "Chief Executive Officer", color: "#8B5CF6", bgClass: "bg-violet-500/15", textClass: "text-violet-400", borderClass: "border-violet-500/30", icon: Crown },
  { id: "pm", name: "PM Agent", role: "Product Manager", color: "#F59E0B", bgClass: "bg-amber-500/15", textClass: "text-amber-400", borderClass: "border-amber-500/30", icon: ClipboardList },
  { id: "developer", name: "Developer Agent", role: "Senior Developer", color: "#10B981", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/30", icon: Code2 },
  { id: "qa", name: "QA Agent", role: "QA Engineer", color: "#EF4444", bgClass: "bg-red-500/15", textClass: "text-red-400", borderClass: "border-red-500/30", icon: ShieldCheck },
  { id: "devops", name: "DevOps Agent", role: "DevOps Engineer", color: "#06B6D4", bgClass: "bg-cyan-500/15", textClass: "text-cyan-400", borderClass: "border-cyan-500/30", icon: Server },
];

function getAgentConfig(id: string) {
  return AGENTS_CONFIG.find(a => a.id === id);
}

/* ================================================================
   STATUS HELPERS
   ================================================================ */

function StatusIcon({ status, className = "h-4 w-4" }: { status: string; className?: string }) {
  switch (status) {
    case "running": return <Loader2 className={`${className} animate-spin text-blue-400`} />;
    case "completed": return <CheckCircle2 className={`${className} text-emerald-400`} />;
    case "failed": return <XCircle className={`${className} text-red-400`} />;
    default: return <Clock className={`${className} text-muted-foreground`} />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-secondary text-secondary-foreground" },
    running: { label: "Running", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
    completed: { label: "Completed", className: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-400 border border-red-500/30" },
    active: { label: "Active", className: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
    archived: { label: "Archived", className: "bg-secondary text-secondary-foreground" },
    cancelled: { label: "Cancelled", className: "bg-secondary text-secondary-foreground" },
    low: { label: "Low", className: "bg-secondary text-secondary-foreground" },
    medium: { label: "Medium", className: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
    high: { label: "High", className: "bg-orange-500/20 text-orange-400 border border-orange-500/30" },
    critical: { label: "Critical", className: "bg-red-500/20 text-red-400 border border-red-500/30" },
  };
  const v = variants[status] || { label: status, className: "bg-secondary text-secondary-foreground" };
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ================================================================
   TOOLTIP HELPER
   ================================================================ */

function TooltipWrapper({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-popover text-popover-foreground text-[10px] whitespace-nowrap border shadow-lg z-50 pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SIDEBAR
   ================================================================ */

function Sidebar() {
  const { currentView, setCurrentView, sidebarOpen, setSidebarOpen, systemStatus } = useAgentOSStore();

  const navItems: { view: ViewType; icon: React.ElementType; label: string; badge?: number }[] = [
    { view: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { view: "pipeline", icon: Activity, label: "Pipeline" },
    { view: "chat", icon: MessageSquare, label: "Chat" },
    { view: "projects", icon: FolderKanban, label: "Projects", badge: systemStatus?.stats.totalProjects },
    { view: "logs", icon: ScrollText, label: "Logs" },
  ];

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed top-0 left-0 z-50 h-full bg-card border-r border-border flex flex-col transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"}`}>
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Brain className="h-5 w-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold tracking-tight">AgentOS</h1>
              <p className="text-[10px] text-muted-foreground">Multi-Agent Platform</p>
            </div>
          )}
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => { setCurrentView(item.view); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{item.badge}</Badge>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Agent Team</p>
            <div className="grid grid-cols-5 gap-1.5">
              {AGENTS_CONFIG.map((agent) => {
                const Icon = agent.icon;
                return (
                  <TooltipWrapper key={agent.id} text={`${agent.name} — ${agent.role}`}>
                    <div className="h-8 w-8 rounded-md flex items-center justify-center transition-colors hover:scale-110" style={{ backgroundColor: `${agent.color}20` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: agent.color }} />
                    </div>
                  </TooltipWrapper>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

/* ================================================================
   DASHBOARD VIEW
   ================================================================ */

function DashboardView() {
  const { systemStatus, setCurrentView, setSystemStatus } = useAgentOSStore();
  const stats = systemStatus?.stats;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((res) => res.json())
      .then((json: Record<string, Record<string, unknown>>) => {
        const d = json.data as Record<string, unknown>;
        const s = d.stats as Record<string, Record<string, number>>;
        const ra = d.recentActivity as Record<string, AgentRun[]>;
        setSystemStatus({
          status: d.health as string,
          timestamp: d.timestamp as string,
          stats: {
            totalProjects: s?.projects?.total ?? 0,
            totalTasks: s?.tasks?.total ?? 0,
            completedTasks: s?.tasks?.completed ?? 0,
            failedTasks: s?.tasks?.failed ?? 0,
            totalAgentRuns: s?.agents?.totalRuns ?? 0,
            recentActivity: (ra?.agentRuns || []).map((r) => ({ ...r, projectId: "", taskId: "", input: null, output: null, error: null, order: 0, updatedAt: r.createdAt })),
          },
        });
      })
      .catch(() => { /* ignore */ });
    return () => { controller.abort(); };
  }, [setSystemStatus]);

  const statCards = [
    { label: "Total Projects", value: stats?.totalProjects ?? 0, icon: FolderKanban, color: "text-violet-400" },
    { label: "Total Tasks", value: stats?.totalTasks ?? 0, icon: BarChart3, color: "text-amber-400" },
    { label: "Completed", value: stats?.completedTasks ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Failed", value: stats?.failedTasks ?? 0, icon: XCircle, color: "text-red-400" },
    { label: "Agent Runs", value: stats?.totalAgentRuns ?? 0, icon: Zap, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0">
          <img src="/agentos-hero.png" alt="AgentOS" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        </div>
        <div className="relative p-6 md:p-8 flex flex-col justify-center min-h-[160px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">AgentOS</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Multi-Agent AI Platform</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">Deploy intelligent agent teams — CEO, PM, Developer, QA, DevOps — to collaborate on complex tasks autonomously.</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setCurrentView("pipeline")} className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white">
              <Play className="h-4 w-4" /> Run Pipeline
            </Button>
            <Button variant="outline" onClick={() => setCurrentView("chat")} className="gap-2">
              <MessageSquare className="h-4 w-4" /> Chat
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-card/50 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline Overview */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-violet-400" /> Agent Pipeline</CardTitle>
          <CardDescription>Sequential task execution flow: CEO → PM → Developer → QA → DevOps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {AGENTS_CONFIG.map((agent, idx) => {
              const Icon = agent.icon;
              return (
                <React.Fragment key={agent.id}>
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${agent.borderClass} ${agent.bgClass} min-w-[140px]`}>
                    <Icon className={`h-5 w-5 ${agent.textClass}`} />
                    <div>
                      <p className="text-xs font-semibold">{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                  {idx < AGENTS_CONFIG.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-amber-400" /> Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {(!stats?.recentActivity || stats.recentActivity.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs">Run a pipeline to see agent activity</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stats.recentActivity.slice(0, 8).map((run) => {
                  const config = getAgentConfig(run.agentType);
                  return (
                    <div key={run.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <StatusIcon status={run.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{config?.name || run.agentName}</p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(run.createdAt)} · {formatDuration(run.duration)}</p>
                      </div>
                      <StatusBadge status={run.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-400" /> Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { view: "pipeline" as ViewType, icon: Play, color: "text-violet-400", title: "Run Pipeline", desc: "Execute full agent team" },
              { view: "chat" as ViewType, icon: MessageSquare, color: "text-amber-400", title: "Chat with Agents", desc: "Interactive conversation" },
              { view: "projects" as ViewType, icon: FolderKanban, color: "text-emerald-400", title: "Manage Projects", desc: "View and create projects" },
              { view: "logs" as ViewType, icon: ScrollText, color: "text-red-400", title: "View Logs", desc: "Agent execution logs" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.view} variant="outline" className="w-full justify-start gap-3 h-12 border-dashed" onClick={() => setCurrentView(action.view)}>
                  <Icon className={`h-4 w-4 ${action.color}`} />
                  <div className="text-left">
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================
   PIPELINE RUN CARD
   ================================================================ */

function PipelineRunCard({ run, index }: { run: AgentRun; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const { setOutputViewerOpen, setViewingOutput } = useAgentOSStore();
  const config = getAgentConfig(run.agentType);
  const Icon = config?.icon || Bot;

  return (
    <div className={`rounded-xl border ${config?.borderClass || "border-border"} ${config?.bgClass || "bg-card"} overflow-hidden transition-all`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground w-6">{index + 1}.</div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config?.color}25` }}>
          <Icon className="h-4 w-4" style={{ color: config?.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{config?.name || run.agentName}</p>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-[10px] text-muted-foreground">{config?.role} · {formatDuration(run.duration)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </Button>
      </div>
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          {run.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs font-medium text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> Error</p>
              <p className="text-xs text-red-300/80 mt-1">{run.error}</p>
            </div>
          )}
          {run.output && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Output</p>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => { setViewingOutput(run); setOutputViewerOpen(true); }}>
                  <Eye className="h-3 w-3" /> View Full
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-background/50 text-xs text-muted-foreground max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
                {run.output.length > 300 ? run.output.substring(0, 300) + "..." : run.output}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   PIPELINE VIEW
   ================================================================ */

function PipelineView() {
  const { pipelineRuns, setPipelineRuns, isPipelineRunning, setIsPipelineRunning, pipelineProgress, setPipelineProgress } = useAgentOSStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleRunPipeline = async () => {
    if (!title.trim()) return;
    setIsPipelineRunning(true);
    setPipelineRuns([]);
    setPipelineProgress(0);
    try {
      const res = await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const json = await res.json();
      const runData = json.data as Record<string, unknown> | undefined;
      if (runData?.agentRuns) {
        setPipelineRuns(runData.agentRuns as AgentRun[]);
        setPipelineProgress(100);
      }
    } catch (err) {
      console.error("Pipeline error:", err);
    } finally {
      setIsPipelineRunning(false);
      setTitle("");
      setDescription("");
    }
  };

  const completedCount = pipelineRuns.filter(r => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pipeline</h2>
        <p className="text-sm text-muted-foreground">Run your multi-agent pipeline to process tasks</p>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Terminal className="h-4 w-4 text-violet-400" /> New Pipeline Run</CardTitle>
            <CardDescription>Describe the task for your agent team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Task Title</label>
              <Input placeholder="e.g., Build a REST API for task management" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPipelineRunning} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
              <Textarea placeholder="Provide detailed requirements for the agent team..." value={description} onChange={(e) => setDescription(e.target.value)} rows={5} disabled={isPipelineRunning} className="resize-none" />
            </div>
            <Button onClick={handleRunPipeline} disabled={isPipelineRunning || !title.trim()} className="w-full gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white">
              {isPipelineRunning ? (<><Loader2 className="h-4 w-4 animate-spin" /> Running Pipeline...</>) : (<><Play className="h-4 w-4" /> Execute Pipeline</>)}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400" /> Pipeline Execution</CardTitle>
                <CardDescription className="mt-1">
                  {isPipelineRunning ? "Agents are processing your task..." : pipelineRuns.length > 0 ? `Completed: ${completedCount}/${pipelineRuns.length} agents` : "Configure a task and execute the pipeline"}
                </CardDescription>
              </div>
              {isPipelineRunning && <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>}
            </div>
            {isPipelineRunning && <Progress value={pipelineProgress} className="mt-2 h-1.5" />}
          </CardHeader>
          <CardContent>
            {pipelineRuns.length === 0 && !isPipelineRunning ? (
              <div className="text-center py-16 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No pipeline runs yet</p>
                <p className="text-xs mt-1">Submit a task to see the agent pipeline in action</p>
              </div>
            ) : isPipelineRunning && pipelineRuns.length === 0 ? (
              <div className="space-y-4 py-8">
                {AGENTS_CONFIG.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-4 animate-pulse">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1"><Skeleton className="h-4 w-32 mb-1.5" /><Skeleton className="h-3 w-20" /></div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {pipelineRuns.map((run, idx) => <PipelineRunCard key={run.id} run={run} index={idx} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================
   CHAT VIEW
   ================================================================ */

function ChatView() {
  const { currentSession, setCurrentSession, chatSessions, setChatSessions, addChatMessage } = useAgentOSStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const json = await res.json();
      const sessions = json.data || [];
      setChatSessions(sessions);
      if (sessions.length > 0 && !currentSession) {
        setCurrentSession(sessions[0]);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  const createNewSession = async () => {
    try {
      const res = await fetch("/api/chat/sessions", { method: "POST" });
      const json = await res.json();
      const session = json.data;
      setChatSessions(prev => [session, ...prev]);
      setCurrentSession(session);
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: currentSession?.id, agentType: selectedAgent }),
      });
      const json = await res.json();
      const chatData = json.data as Record<string, unknown> | undefined;
      const sid = chatData?.sessionId as string || currentSession?.id || "";
      addChatMessage({ id: `u-${Date.now()}`, sessionId: sid, role: "user", content: message, createdAt: new Date().toISOString() });
      addChatMessage({ id: `a-${Date.now()}`, sessionId: sid, role: "assistant", content: (chatData?.message as string) || "No response.", createdAt: new Date().toISOString() });
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const messages = currentSession?.messages || [];

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <div className="w-64 border-r border-border flex flex-col flex-shrink-0 max-md:hidden">
        <div className="p-3 border-b border-border">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={createNewSession}><Plus className="h-3 w-3" /> New Chat</Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {chatSessions.map((session) => (
              <button key={session.id} onClick={() => setCurrentSession(session)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentSession?.id === session.id ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}>
                <p className="truncate font-medium">{session.title}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{timeAgo(session.createdAt)}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <MessageSquare className="h-4 w-4 text-violet-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{currentSession?.title || "New Conversation"}</p>
            <p className="text-[10px] text-muted-foreground">{selectedAgent ? `Talking to ${getAgentConfig(selectedAgent)?.name}` : "General assistant"}</p>
          </div>
          <div className="flex items-center gap-1">
            {AGENTS_CONFIG.map((agent) => {
              const Icon = agent.icon;
              return (
                <TooltipWrapper key={agent.id} text={agent.name}>
                  <button onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)} className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${selectedAgent === agent.id ? "ring-2 ring-offset-1 ring-offset-background opacity-100" : "opacity-50 hover:opacity-100"}`} style={{ backgroundColor: `${agent.color}20` }}>
                    <Icon className="h-3 w-3" style={{ color: agent.color }} />
                  </button>
                </TooltipWrapper>
              );
            })}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs mt-1">Ask anything or select an agent to get specialized help</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role !== "user" && (
                    <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      {msg.agentType ? React.createElement(getAgentConfig(msg.agentType)?.icon || Bot, { className: "h-3.5 w-3.5 text-muted-foreground" }) : <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              placeholder="Type your message... (Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              className="min-h-[44px] max-h-32 resize-none"
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="h-[44px] w-[44px] p-0 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white flex-shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PROJECTS VIEW
   ================================================================ */

function ProjectsView() {
  const { projects, setProjects, addProject } = useAgentOSStore();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      const projectData = (json.data || []) as Array<Record<string, unknown>>;
      setProjects(projectData.map((p) => ({ id: p.id as string, name: p.name as string, description: p.description as string | null, status: p.status as string, createdAt: p.createdAt as string, updatedAt: p.updatedAt as string, _count: { tasks: (p.taskCount as number) ?? 0 } })));
    
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreateProject = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      const json = await res.json();
      const newProject = json.data as Record<string, unknown>;
      addProject({ id: newProject.id as string, name: newProject.name as string, description: newProject.description as string | null, status: newProject.status as string, createdAt: newProject.createdAt as string, updatedAt: newProject.updatedAt as string, _count: { tasks: 0 } });
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage your projects and tasks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white"><Plus className="h-4 w-4" /> New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>Add a new project to organize your tasks</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium mb-1.5 block">Project Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Awesome Project" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Description</label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this project about?" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateProject} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No projects yet</p>
            <p className="text-xs mt-1">Create your first project to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="bg-card/50 backdrop-blur hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm truncate">{project.name}</CardTitle>
                    <CardDescription className="text-xs mt-1 line-clamp-2">{project.description || "No description"}</CardDescription>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{project._count?.tasks || 0} tasks</span>
                  <span>{timeAgo(project.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   LOGS VIEW
   ================================================================ */

function LogsView() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs?limit=100");
      const json = await res.json();
      setLogs((json.data || []) as AgentLog[]);
    
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "warn": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "info": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default: return "text-muted-foreground bg-secondary/50 border-border";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error": return <XCircle className="h-3 w-3 text-red-400" />;
      case "warn": return <AlertCircle className="h-3 w-3 text-amber-400" />;
      case "info": return <CheckCircle2 className="h-3 w-3 text-blue-400" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent Logs</h2>
          <p className="text-sm text-muted-foreground">Monitor agent execution and system events</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchLogs}><ScrollText className="h-3 w-3" /> Refresh</Button>
      </div>

      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No logs yet</p>
              <p className="text-xs mt-1">Run a pipeline to generate logs</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                  {getLevelIcon(log.level)}
                  <Badge variant="outline" className={`text-[10px] h-5 ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</Badge>
                  <p className="flex-1 text-xs truncate">{log.message}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================================================
   OUTPUT VIEWER SHEET
   ================================================================ */

function OutputViewer() {
  const { outputViewerOpen, setOutputViewerOpen, viewingOutput } = useAgentOSStore();
  const config = viewingOutput ? getAgentConfig(viewingOutput.agentType) : null;
  const Icon = config?.icon || FileText;

  return (
    <Sheet open={outputViewerOpen} onOpenChange={setOutputViewerOpen}>
      <SheetContent className="w-full md:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" style={{ color: config?.color }} />
            {config?.name || "Agent"} Output
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {viewingOutput && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={viewingOutput.status} />
                <span className="text-xs text-muted-foreground">Duration: {formatDuration(viewingOutput.duration)}</span>
              </div>
              {viewingOutput.output && (
                <div className="p-4 rounded-lg bg-background border border-border font-mono text-xs whitespace-pre-wrap max-h-[70vh] overflow-y-auto">
                  {viewingOutput.output}
                </div>
              )}
              {viewingOutput.error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs font-medium text-red-400">Error:</p>
                  <p className="text-xs text-red-300 mt-1">{viewingOutput.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function AgentOSPage() {
  const { currentView, sidebarOpen } = useAgentOSStore();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-16"}`}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {currentView === "dashboard" && <DashboardView />}
          {currentView === "pipeline" && <PipelineView />}
          {currentView === "chat" && <ChatView />}
          {currentView === "projects" && <ProjectsView />}
          {currentView === "logs" && <LogsView />}
        </div>
      </main>
      <OutputViewer />
    </div>
  );
}
