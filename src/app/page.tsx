"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Crown,
  Code2,
  ShieldCheck,
  Brain,
  Play,
  Send,
  Bot,
  Terminal,
  Activity,
  MessageSquare,
  Database,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  ChevronRight,
  Eye,
  Search,
  Plus,
  Sun,
  Moon,
  ArrowRight,
  LayoutDashboard,
  AlertCircle,
  FileText,
  User,
  Server,
  ClipboardList,
  LogOut,
  Github,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ================================================================
   TYPES (self-contained)
   ================================================================ */

interface AgentDef {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ElementType;
}

interface AgentRun {
  id: string;
  agentType: string;
  agentName: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
  duration: number | null;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  agentType?: string | null;
  content: string;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  status: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface SystemStats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalAgentRuns: number;
  activeRuns: number;
  totalSessions: number;
  successRate: number;
}

/* ================================================================
   AGENT CONFIG (client-side mirror)
   ================================================================ */

const AGENTS: AgentDef[] = [
  {
    id: "ceo",
    name: "CEO Agent",
    role: "Chief Executive Officer",
    description:
      "Analyzes requests and decomposes them into strategic goals with clear success criteria and constraints.",
    systemPrompt:
      "You are the CEO Agent of AgentOS. Your role is to analyze the user's request and decompose it into strategic goals. Output a structured analysis including: 1) Core objective, 2) Key deliverables, 3) Success criteria, 4) Constraints and risks.",
    color: "#8B5CF6",
    bgClass: "bg-violet-500/15",
    textClass: "text-violet-400",
    borderClass: "border-violet-500/30",
    icon: Crown,
  },
  {
    id: "pm",
    name: "PM Agent",
    role: "Product Manager",
    description:
      "Creates detailed product specifications from strategic goals, including feature breakdowns and user stories.",
    systemPrompt:
      "You are the Product Manager Agent of AgentOS. Based on the CEO's strategic analysis, create a detailed product specification including: 1) Feature breakdown, 2) User stories, 3) Technical requirements, 4) Priority matrix.",
    color: "#F59E0B",
    bgClass: "bg-amber-500/15",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/30",
    icon: ClipboardList,
  },
  {
    id: "developer",
    name: "Developer Agent",
    role: "Senior Developer",
    description:
      "Generates implementation details, architecture decisions, and clean code structures from specifications.",
    systemPrompt:
      "You are the Senior Developer Agent of AgentOS. Based on the PM's specification, generate implementation details including: 1) Architecture decisions, 2) Key components, 3) Code structure, 4) Integration points.",
    color: "#10B981",
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
    icon: Code2,
  },
  {
    id: "qa",
    name: "QA Agent",
    role: "QA Engineer",
    description:
      "Reviews implementation plans and provides thorough testing strategies and edge-case analysis.",
    systemPrompt:
      "You are the QA Engineer Agent of AgentOS. Review the developer's implementation plan and provide: 1) Test strategy, 2) Edge cases, 3) Performance considerations, 4) Potential bugs.",
    color: "#EF4444",
    bgClass: "bg-red-500/15",
    textClass: "text-red-400",
    borderClass: "border-red-500/30",
    icon: ShieldCheck,
  },
  {
    id: "devops",
    name: "DevOps Agent",
    role: "DevOps Engineer",
    description:
      "Creates deployment plans, infrastructure recommendations, and CI/CD pipeline configurations.",
    systemPrompt:
      "You are the DevOps Engineer Agent of AgentOS. Based on all previous agent outputs, create: 1) Deployment plan, 2) Infrastructure requirements, 3) CI/CD pipeline steps, 4) Monitoring and alerting recommendations.",
    color: "#06B6D4",
    bgClass: "bg-cyan-500/15",
    textClass: "text-cyan-400",
    borderClass: "border-cyan-500/30",
    icon: Server,
  },
];

function getAgentDef(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

/* ================================================================
   HELPERS
   ================================================================ */

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusIcon({
  status,
  className = "h-4 w-4",
}: {
  status: string;
  className?: string;
}) {
  switch (status) {
    case "running":
      return <Loader2 className={`${className} animate-spin text-violet-400`} />;
    case "completed":
      return <CheckCircle2 className={`${className} text-emerald-400`} />;
    case "failed":
      return <XCircle className={`${className} text-red-400`} />;
    default:
      return <Clock className={`${className} text-muted-foreground`} />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    running: {
      label: "Running",
      cls: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    },
    completed: {
      label: "Completed",
      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    failed: {
      label: "Failed",
      cls: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    pending: {
      label: "Pending",
      cls: "bg-secondary text-secondary-foreground",
    },
    available: {
      label: "Available",
      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
  };
  const m = map[status] || {
    label: status,
    cls: "bg-secondary text-secondary-foreground",
  };
  return (
    <Badge variant="outline" className={m.cls}>
      {m.label}
    </Badge>
  );
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len) + "...";
}

/* ================================================================
   LOGIN SCREEN
   ================================================================ */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid credentials. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-violet-500/20 mx-auto mb-4">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AgentOS</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Multi-Agent AI Orchestration Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Sign in to AgentOS</CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Sign In */}
            <Button
              variant="outline"
              className="w-full gap-2 h-11 border-border/50 hover:border-violet-500/50"
              onClick={handleGoogleSignIn}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="relative flex items-center">
              <Separator className="flex-1" />
              <span className="px-3 text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full h-11 gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-lg shadow-violet-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Demo hint */}
            <p className="text-center text-[11px] text-muted-foreground">
              Demo mode: any email &amp; password will work
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          &copy; 2024 AgentOS &middot; Multi-Agent AI Platform
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   FULL-SCREEN LOADING
   ================================================================ */

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
        <Brain className="h-6 w-6 text-white" />
      </div>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
        <span className="text-sm text-muted-foreground">Loading AgentOS...</span>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function AgentOSPage() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Check status on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => r.json())
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
    return () => controller.abort();
  }, []);

  const cycleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  // Auth state handling
  if (status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  const userInitial = session.user?.name
    ? session.user.name.charAt(0).toUpperCase()
    : "U";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Brain className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              AgentOS <span className="text-muted-foreground font-normal text-sm">v2</span>
            </span>
          </div>

          {/* Status + Theme + User Menu */}
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={`gap-1.5 text-xs ${
                connected === true
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : connected === false
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : "bg-secondary text-secondary-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected === true ? "bg-emerald-400" : connected === false ? "bg-red-400" : "bg-muted-foreground animate-pulse"}`}
              />
              {connected === true
                ? "Connected"
                : connected === false
                  ? "Disconnected"
                  : "Checking..."}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={cycleTheme}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 pl-1.5 pr-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={session.user?.image || undefined} />
                    <AvatarFallback className="h-6 w-6 text-[10px] bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">
                    {session.user?.name || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user?.name || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user?.email || ""}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  Plan: <span className="ml-auto text-violet-400 font-medium">Pro</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="gap-2 cursor-pointer text-xs text-red-400 focus:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── TABS ───────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="border-b border-border bg-background/60 backdrop-blur-sm px-4 md:px-6">
          <TabsList className="h-11 bg-transparent p-0 gap-0">
            {(
              [
                { value: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
                { value: "pipeline", icon: Activity, label: "Pipeline" },
                { value: "agents", icon: Bot, label: "Agents" },
                { value: "memory", icon: Database, label: "Memory" },
                { value: "chat", icon: MessageSquare, label: "Chat" },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:text-violet-400 data-[state=active]:shadow-none px-4 gap-2 text-muted-foreground text-sm transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ── VIEWS ─────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="dashboard" className="m-0 h-full">
            <DashboardView onNavigate={setActiveTab} />
          </TabsContent>
          <TabsContent value="pipeline" className="m-0 h-full">
            <PipelineView />
          </TabsContent>
          <TabsContent value="agents" className="m-0 h-full">
            <AgentsView />
          </TabsContent>
          <TabsContent value="memory" className="m-0 h-full">
            <MemoryView />
          </TabsContent>
          <TabsContent value="chat" className="m-0 h-full">
            <ChatView />
          </TabsContent>
        </div>
      </Tabs>

      {/* ── STICKY FOOTER ───────────────────────────────────── */}
      <footer className="border-t border-border bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 md:px-6 h-10 text-xs text-muted-foreground">
          <span>&copy; 2024 AgentOS</span>
          <div className="flex items-center gap-4">
            <button className="hover:text-foreground transition-colors">Documentation</button>
            <button className="hover:text-foreground transition-colors">API Reference</button>
            <button className="hover:text-foreground transition-colors">Support</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================
   VIEW 1 — DASHBOARD
   ================================================================ */

function DashboardView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const d = json.data;
        if (d) {
          const s = d.stats;
          const completed = s?.tasks?.completed ?? 0;
          const failed = s?.tasks?.failed ?? 0;
          const total = completed + failed;
          setStats({
            totalProjects: s?.projects?.total ?? 0,
            totalTasks: s?.tasks?.total ?? 0,
            completedTasks: completed,
            failedTasks: failed,
            totalAgentRuns: s?.agents?.totalRuns ?? 0,
            activeRuns: s?.agents?.activeRuns ?? 0,
            totalSessions: s?.chat?.totalSessions ?? 0,
            successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const statCards = [
    {
      label: "Total Pipelines",
      value: stats?.totalProjects ?? 0,
      icon: Activity,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Active Agents",
      value: stats?.activeRuns ?? 3,
      icon: Bot,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Memory Docs",
      value: stats?.totalSessions ?? 0,
      icon: Database,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Success Rate",
      value: stats ? `${stats.successRate}%` : "—",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return loading ? (
              <Skeleton key={stat.label} className="h-24 rounded-xl" />
            ) : (
              <Card
                key={stat.label}
                className="bg-card/60 backdrop-blur border-border/50"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div
                      className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pipeline Visualization */}
        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-400" />
              Agent Pipeline Flow
            </CardTitle>
            <CardDescription>
              Sequential multi-agent execution: CEO → PM → Developer → QA → DevOps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2">
              {AGENTS.map((agent, idx) => {
                const Icon = agent.icon;
                return (
                  <React.Fragment key={agent.id}>
                    <div
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${agent.borderClass} ${agent.bgClass} min-w-[130px] flex-shrink-0`}
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${agent.color}25` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: agent.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{agent.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {agent.role}
                        </p>
                      </div>
                    </div>
                    {idx < AGENTS.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4 text-cyan-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14 justify-start gap-3 border-dashed hover:border-violet-500/50 hover:bg-violet-500/5"
                onClick={() => onNavigate("pipeline")}
              >
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Run Pipeline</p>
                  <p className="text-[10px] text-muted-foreground">
                    Execute full agent team
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-3 border-dashed hover:border-violet-500/50 hover:bg-violet-500/5"
                onClick={() => onNavigate("chat")}
              >
                <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Chat with Agents</p>
                  <p className="text-[10px] text-muted-foreground">
                    Interactive conversation
                  </p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

/* ================================================================
   VIEW 2 — PIPELINE
   ================================================================ */

function PipelineView() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("high");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pipelineRuns, setPipelineRuns] = useState<AgentRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Simulated progress while running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return p + Math.random() * 15;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [running]);

  const handleRun = async () => {
    if (!title.trim() || running) return;
    setRunning(true);
    setProgress(0);
    setPipelineRuns([]);
    setError(null);

    try {
      const res = await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Pipeline execution failed");
        setProgress(100);
        return;
      }

      const data = json.data;
      if (data?.agentRuns) {
        setPipelineRuns(data.agentRuns);
      }
      setProgress(100);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to the backend"
      );
      setProgress(100);
    } finally {
      setRunning(false);
      setTitle("");
      setDescription("");
    }
  };

  const completedCount = pipelineRuns.filter(
    (r) => r.status === "completed"
  ).length;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Pipeline
          </h2>
          <p className="text-sm text-muted-foreground">
            Run your multi-agent pipeline to process tasks autonomously
          </p>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-6">
          {/* ── Left: Form ── */}
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-violet-400" />
                New Pipeline Run
              </CardTitle>
              <CardDescription>Describe the task for your agent team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Task Title
                </label>
                <Input
                  placeholder="e.g., Build a REST API for task management"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={running}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Description
                </label>
                <Textarea
                  placeholder="Provide detailed requirements for the agent team..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  disabled={running}
                  className="resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Priority
                </label>
                <Select value={priority} onValueChange={setPriority} disabled={running}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <Button
                onClick={handleRun}
                disabled={running || !title.trim()}
                className="w-full gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-lg shadow-violet-500/20"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Pipeline...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Execute Pipeline
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ── Right: Results ── */}
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Pipeline Execution
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {running
                      ? "Agents are processing your task..."
                      : pipelineRuns.length > 0
                        ? `Completed: ${completedCount}/${pipelineRuns.length} agents`
                        : "Configure a task and execute the pipeline"}
                  </CardDescription>
                </div>
                {running && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 animate-pulse gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Running
                  </Badge>
                )}
              </div>
              {running && (
                <Progress value={progress} className="mt-3 h-1.5" />
              )}
            </CardHeader>
            <CardContent>
              {/* Empty state */}
              {pipelineRuns.length === 0 && !running && !error && (
                <div className="text-center py-16 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No pipeline runs yet</p>
                  <p className="text-xs mt-1">
                    Submit a task to see the agent pipeline in action
                  </p>
                </div>
              )}

              {/* Loading skeletons */}
              {running && pipelineRuns.length === 0 && (
                <div className="space-y-4 py-4">
                  {AGENTS.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* Agent run results */}
              {pipelineRuns.length > 0 && (
                <div className="space-y-3">
                  {pipelineRuns.map((run, idx) => (
                    <AgentRunCard key={run.id} run={run} index={idx} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

/* ================================================================
   PIPELINE RUN CARD
   ================================================================ */

function AgentRunCard({
  run,
  index,
}: {
  run: AgentRun;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = getAgentDef(run.agentType);
  const Icon = config?.icon || Bot;

  return (
    <div
      className={`rounded-xl border ${config?.borderClass || "border-border"} ${config?.bgClass || "bg-card"} overflow-hidden transition-all`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground w-6">
          {index + 1}.
        </div>
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${config?.color || "#888"}25` }}
        >
          <Icon className="h-4 w-4" style={{ color: config?.color || "#888" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{config?.name || run.agentName}</p>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {config?.role || "Agent"} · {formatDuration(run.duration)}
          </p>
        </div>
        <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent flex-shrink-0">
          <ChevronRight
            className={`h-4 w-4 transition-transform text-muted-foreground ${expanded ? "rotate-90" : ""}`}
          />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          {run.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" /> Error
              </p>
              <p className="text-xs text-red-300/80 mt-1">{run.error}</p>
            </div>
          )}
          {run.output && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Output
                </p>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  <Eye className="h-2.5 w-2.5 mr-1" />
                  {run.output.length} chars
                </Badge>
              </div>
              <div className="p-3 rounded-lg bg-background/50 text-xs text-muted-foreground max-h-48 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
                {truncate(run.output, 500)}
              </div>
            </div>
          )}
          {!run.error && !run.output && (
            <p className="text-xs text-muted-foreground italic">
              No output available for this agent run.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   VIEW 3 — AGENTS
   ================================================================ */

function AgentsView() {
  const [agentsData, setAgentsData] = useState<AgentDef[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Try to fetch from orchestrator endpoint; fall back to client-side config
    fetch("/api/orchestrator/agents", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Not available");
        return r.json();
      })
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          // Merge API data with client-side config for icons/colors
          const merged = json.data.map((a: Record<string, unknown>) => {
            const def = getAgentDef(a.id as string);
            return def || { ...a, icon: Bot, color: "#888", bgClass: "bg-secondary", textClass: "text-muted-foreground", borderClass: "border-border" };
          });
          setAgentsData(merged);
        } else {
          setAgentsData(AGENTS);
        }
      })
      .catch(() => {
        // Use local agent definitions as fallback
        setAgentsData(AGENTS);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Agent Team
          </h2>
          <p className="text-sm text-muted-foreground">
            View and manage your AI agent workforce
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(agentsData || AGENTS).map((agent) => {
            const Icon = agent.icon;
            return (
              <Card
                key={agent.id}
                className={`bg-card/60 backdrop-blur border-border/50 hover:border-opacity-80 transition-all cursor-pointer group ${selectedAgent?.id === agent.id ? "ring-2 ring-violet-500/50" : ""}`}
                onClick={() =>
                  setSelectedAgent(
                    selectedAgent?.id === agent.id ? null : agent
                  )
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: `${agent.color}25` }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: agent.color }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{agent.name}</CardTitle>
                        <CardDescription className="text-[10px]">
                          {agent.role}
                        </CardDescription>
                      </div>
                    </div>
                    <StatusBadge status="available" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {agent.description}
                  </p>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                      System Prompt
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 font-mono leading-relaxed">
                      {truncate(agent.systemPrompt, 120)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Agent Detail Dialog */}
        <Dialog
          open={selectedAgent !== null}
          onOpenChange={(open) => !open && setSelectedAgent(null)}
        >
          <DialogContent className="max-w-lg">
            {selectedAgent && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${selectedAgent.color}25` }}
                    >
                      {React.createElement(selectedAgent.icon, {
                        className: "h-5 w-5",
                        style: { color: selectedAgent.color },
                      })}
                    </div>
                    {selectedAgent.name}
                  </DialogTitle>
                  <DialogDescription>{selectedAgent.role}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Description
                    </p>
                    <p className="text-sm">{selectedAgent.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      System Prompt
                    </p>
                    <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {selectedAgent.systemPrompt}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

/* ================================================================
   VIEW 4 — MEMORY
   ================================================================ */

function MemoryView() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<
    Array<{
      id: string;
      content: string;
      score: number;
      source: string;
    }>
  >([]);
  const [totalDocs, setTotalDocs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load total docs count
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const d = json.data;
        if (d) {
          setTotalDocs(
            (d.stats?.agents?.totalRuns ?? 0) +
              (d.stats?.chat?.totalSessions ?? 0)
          );
        }
      })
      .catch(() => {})
      .finally(() => {});
    return () => controller.abort();
  }, []);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/orchestrator/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) throw new Error("Memory service not available");

      const json = await res.json();
      if (json.data?.results) {
        setResults(json.data.results);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(
        "Memory service is not available yet. This feature will be enabled in a future update."
      );
      // Show mock results for demo
      setResults([
        {
          id: "demo-1",
          content:
            "Pipeline run: Build a REST API. CEO decomposed into strategic goals. Developer planned architecture with Express.js and SQLite.",
          score: 0.92,
          source: "pipeline-run-001",
        },
        {
          id: "demo-2",
          content:
            "Chat session discussing microservices architecture. Agent recommended Docker containerization approach.",
          score: 0.78,
          source: "chat-session-002",
        },
        {
          id: "demo-3",
          content:
            "QA analysis found 3 potential edge cases in authentication flow. Recommended rate limiting and input validation.",
          score: 0.65,
          source: "pipeline-run-003",
        },
      ]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Memory
          </h2>
          <p className="text-sm text-muted-foreground">
            Search across all agent outputs, pipeline results, and knowledge
            base
          </p>
        </div>

        {/* Stats */}
        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDocs ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                Documents in knowledge base
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardContent className="p-4 space-y-3">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Query Memory
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Search across all agent outputs and knowledge..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={searching}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {error && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">
              {results.length} result{results.length > 1 ? "s" : ""} found
            </p>
            {results.map((result) => (
              <Card
                key={result.id}
                className="bg-card/60 backdrop-blur border-border/50"
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    >
                      Score: {(result.score * 100).toFixed(0)}%
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {result.source}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {result.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!error && results.length === 0 && !searching && (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Search the knowledge base</p>
            <p className="text-xs mt-1">
              Enter a query to find relevant documents and agent outputs
            </p>
          </div>
        )}

        {searching && (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/* ================================================================
   VIEW 5 — CHAT
   ================================================================ */

function ChatView() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const json = await res.json();
      const s: ChatSession[] = json.data || [];
      setSessions(s);
      if (s.length > 0) {
        setCurrentSessionId(s[0].id);
        loadMessages(s[0].id);
      }
    } catch {
      // Graceful fallback — show empty state
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      const json = await res.json();
      const session = json.data;
      if (session?.messages) {
        setMessages(session.messages);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    loadMessages(session.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const createNewSession = async () => {
    try {
      const res = await fetch("/api/chat/sessions", { method: "POST" });
      const json = await res.json();
      const session: ChatSession = json.data;
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      setMessages([]);
    } catch {
      // Fallback — create local session
      const fakeSession: ChatSession = {
        id: `local-${Date.now()}`,
        title: "New Conversation",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions((prev) => [fakeSession, ...prev]);
      setCurrentSessionId(fakeSession.id);
      setMessages([]);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput("");
    setIsLoading(true);

    const tempSessionId =
      currentSessionId || `local-${Date.now()}`;

    // Optimistic UI — show user message immediately
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sessionId: tempSessionId,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: currentSessionId,
          agentType: selectedAgent,
        }),
      });
      const json = await res.json();
      const data = json.data;

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sessionId: data?.sessionId || tempSessionId,
        role: "assistant",
        content: data?.message || "I could not generate a response.",
        agentType: data?.agentType || selectedAgent,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update session ID if a new one was created
      if (data?.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        sessionId: tempSessionId,
        role: "assistant",
        content:
          "Sorry, I couldn't connect to the backend. Please make sure the server is running.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-full">
      {/* ── Session Sidebar ── */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`w-64 border-r border-border flex flex-col flex-shrink-0 bg-background transition-transform duration-200 z-50 ${
          sidebarOpen
            ? "translate-x-0 fixed md:relative md:translate-x-0"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={createNewSession}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No conversations yet
              </p>
            )}
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  currentSessionId === session.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-xs">
                      {session.title}
                    </p>
                    <p className="text-[10px] opacity-70 mt-0.5">
                      {timeAgo(session.updatedAt)}
                      {session.messageCount !== undefined &&
                        ` · ${session.messageCount} msgs`}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {/* Mobile sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {currentSession?.title || "New Conversation"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {selectedAgent
                ? `Talking to ${getAgentDef(selectedAgent)?.name || selectedAgent}`
                : "General assistant"}
            </p>
          </div>

          {/* Agent Selector */}
          <div className="flex items-center gap-1">
            {AGENTS.map((agent) => {
              const Icon = agent.icon;
              return (
                <button
                  key={agent.id}
                  onClick={() =>
                    setSelectedAgent(
                      selectedAgent === agent.id ? null : agent.id
                    )
                  }
                  title={agent.name}
                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${
                    selectedAgent === agent.id
                      ? "ring-2 ring-offset-1 ring-offset-background scale-110"
                      : "opacity-40 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: `${agent.color}20` }}
                >
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: agent.color }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Ask anything or select a specific agent to get specialized
                  help
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                  {AGENTS.map((agent) => {
                    const Icon = agent.icon;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-[11px] text-muted-foreground hover:border-violet-500/50 hover:text-violet-400 transition-colors"
                      >
                        <Icon
                          className="h-3 w-3"
                          style={{ color: agent.color }}
                        />
                        {agent.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role !== "user" && (
                    <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      {msg.agentType && getAgentDef(msg.agentType) ? (
                        React.createElement(
                          getAgentDef(msg.agentType)!.icon,
                          {
                            className: "h-3.5 w-3.5",
                            style: {
                              color: getAgentDef(msg.agentType)!.color,
                            },
                          }
                        )
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
                        : "bg-card border border-border"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    <p
                      className={`text-[10px] mt-1.5 ${
                        msg.role === "user"
                          ? "text-white/60"
                          : "text-muted-foreground"
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                    {selectedAgent && getAgentDef(selectedAgent) ? (
                      React.createElement(
                        getAgentDef(selectedAgent)!.icon,
                        {
                          className: "h-3.5 w-3.5 animate-spin",
                          style: { color: getAgentDef(selectedAgent)!.color },
                        }
                      )
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                    )}
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Chat Input */}
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
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="h-[44px] w-[44px] p-0 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white flex-shrink-0 shadow-lg shadow-violet-500/20"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
