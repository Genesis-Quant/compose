import {
  Activity,
  CheckCircle2,
  Database,
  Loader2,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  Workflow
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { adminApi } from "@/assets/lib/admin";
import { errorMessage } from "@/assets/lib/utils";
import { PageHero } from "@/components/bar/PageHero";
import IncrementalWorkerDialog from "@/components/modal/IncrementalWorkerDialog";
import WorkflowPanel from "@/components/panel/WorkflowPanel";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { StatusBadge } from "@/components/badge/StatusBadge";
import { Switch } from "@/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { useAppStore } from "@/store";
import type { AdminOverview } from "@/types/admin";

type Action = "incremental" | "workflows" | null;

export default function AdminPage() {
  const currentUser = useAppStore((state) => state.user);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<ArenaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [incrementalDialogOpen, setIncrementalDialogOpen] = useState(false);
  const [selectedIncrementalWorkers, setSelectedIncrementalWorkers] = useState<string[]>([]);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextOverview, userList] = await Promise.all([
        adminApi.overview(),
        adminApi.users()
      ]);
      setOverview(nextOverview);
      setUsers(userList.items);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openIncrementalDialog() {
    setError("");
    setNotice("");
    setSelectedIncrementalWorkers(
      overview?.scheduler.incremental_workers.map((worker) => worker.name) ?? []
    );
    setIncrementalDialogOpen(true);
  }

  async function runIncrementalUpdate() {
    if (!selectedIncrementalWorkers.length) return;
    setAction("incremental");
    setError("");
    setNotice("");
    try {
      const result = await adminApi.runIncrementalUpdate(selectedIncrementalWorkers);
      setIncrementalDialogOpen(false);
      setNotice(`${result.message}，${result.workers.length} 个 Worker，Job ID：${result.job_id}`);
      await load(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAction(null);
    }
  }

  async function ensureWorkflows() {
    setAction("workflows");
    setError("");
    setNotice("");
    try {
      const result = await adminApi.ensureWorkflows();
      setNotice(result.message);
      await load(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAction(null);
    }
  }

  async function updateUser(user: ArenaUser, isAdmin: boolean) {
    setUpdatingUserId(user.id);
    setError("");
    try {
      const updated = await adminApi.updateUser(user.id, isAdmin);
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item));
      setOverview((current) => updateAdministratorCount(current, isAdmin));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUpdatingUserId(null);
    }
  }

  return <div className="space-y-6">
    <PageHero
      actions={<Button variant="outline" disabled={refreshing} onClick={() => load(true)}>{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button>}
      chips={["管理员权限", "调度状态", "用户管理"]}
      description="查看 Arena 全局运行状态，维护调度工作流和用户权限，并直接发起数据增量更新。"
      eyebrow="ADMINISTRATION"
      icon={ShieldCheck}
      stat={{ label: "运行中工作流", value: overview?.workflow_instances.active ?? 0 }}
      title="管理面板"
      variant="archive"
    />

    <FeedbackMessage tone="error" value={error} />
    <FeedbackMessage tone="success" value={notice} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={<Users />} label="注册用户" value={overview?.users.total} detail={`${overview?.users.administrators ?? 0} 位管理员`} />
      <SummaryCard icon={<Workflow />} label="全部工作流实例" value={overview?.workflow_instances.total} detail={`${overview?.workflow_instances.active ?? 0} 个运行中`} />
      <SummaryCard icon={<CheckCircle2 />} label="成功工作流" value={overview?.workflow_instances.success} detail="历史累计" />
      <SummaryCard icon={<Server />} label="Worker 节点" value={overview?.scheduler.workers.length} detail={overview?.scheduler.available ? "调度器在线" : "调度器不可用"} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <Card>
        <CardHeader><CardTitle>调度操作</CardTitle><CardDescription>操作直接提交到当前 DolphinScheduler 项目。</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ManagementAction
            icon={<Database />}
            title="运行增量更新"
            description="选择需要更新的数据，Task 并行入队并由 tushare-api Task Group 控制并发。"
            action={<Button disabled={action !== null || !overview?.scheduler.available || !overview.scheduler.incremental_workers.length} onClick={openIncrementalDialog}><Play />运行</Button>}
          />
          <ManagementAction
            icon={<Workflow />}
            title="同步工作流定义"
            description="重新注册 Query、Factor、Backtest 和 Incremental Update 工作流与 Task Group。"
            action={<Button variant="outline" disabled={action !== null || !overview?.scheduler.available} onClick={ensureWorkflows}>{action === "workflows" ? <Loader2 className="animate-spin" /> : <RefreshCw />}同步</Button>}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>调度项目</CardTitle><CardDescription>DolphinScheduler 中由 Arena 管理的项目。</CardDescription></CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <Definition label="项目名称" value={overview?.scheduler.project_name ?? "—"} />
            <Definition label="Project Code" value={overview?.scheduler.project_code?.toString() ?? "—"} mono />
            <Definition label="Worker Group" value={overview?.scheduler.worker_groups.join(", ") || "—"} />
            <Definition label="连接状态" value={overview?.scheduler.available ? "可用" : "不可用"} />
          </dl>
          {overview?.scheduler.error ? <p className="mt-4 text-xs leading-5 text-destructive">{overview.scheduler.error}</p> : null}
        </CardContent>
      </Card>
    </div>

    <SectionCard title="工作流定义" description="当前在线定义及其版本。">
      <Table>
        <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>Code</TableHead><TableHead>版本</TableHead><TableHead>发布状态</TableHead><TableHead>执行类型</TableHead><TableHead>更新时间</TableHead></TableRow></TableHeader>
        <TableBody>{overview?.scheduler.workflows.map((workflow) => <TableRow key={workflow.code}><TableCell className="font-medium">{workflow.name}</TableCell><TableCell className="font-mono text-xs">{workflow.code}</TableCell><TableCell>v{workflow.version}</TableCell><TableCell><StatusBadge tone={workflow.release_state === "ONLINE" ? "green" : "neutral"}>{workflow.release_state}</StatusBadge></TableCell><TableCell>{workflow.execution_type ?? "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(workflow.updated_at)}</TableCell></TableRow>)}</TableBody>
      </Table>
      <EmptyState loading={loading} empty={!overview?.scheduler.workflows.length} />
    </SectionCard>

    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title="Task Group" description="跨工作流的全局 Task 并发配额。">
        <Table>
          <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>占用 / 容量</TableHead><TableHead>状态</TableHead><TableHead>说明</TableHead></TableRow></TableHeader>
          <TableBody>{overview?.scheduler.task_groups.map((group) => <TableRow key={group.id}><TableCell className="font-medium">{group.name}</TableCell><TableCell className="font-mono">{group.use_size} / {group.group_size}</TableCell><TableCell><StatusBadge tone={group.status === "YES" ? "green" : "neutral"}>{group.status}</StatusBadge></TableCell><TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={group.description}>{group.description}</TableCell></TableRow>)}</TableBody>
        </Table>
        <EmptyState loading={loading} empty={!overview?.scheduler.task_groups.length} />
      </SectionCard>

      <SectionCard title="Worker 节点" description="节点心跳和资源占用。">
        <Table>
          <TableHeader><TableRow><TableHead>节点</TableHead><TableHead>状态</TableHead><TableHead>CPU</TableHead><TableHead>内存</TableHead><TableHead>线程池</TableHead></TableRow></TableHeader>
          <TableBody>{overview?.scheduler.workers.map((worker) => <TableRow key={worker.id}><TableCell><div className="font-mono text-xs">{worker.host}:{worker.port}</div><div className="mt-1 text-[10px] text-muted-foreground">{formatDate(worker.last_heartbeat_at)}</div></TableCell><TableCell><StatusBadge tone={worker.status === "NORMAL" ? "green" : "red"}>{worker.status}</StatusBadge></TableCell><TableCell>{formatPercent(worker.cpu_usage)}</TableCell><TableCell>{formatPercent(worker.memory_usage)}</TableCell><TableCell>{formatPercent(worker.thread_pool_usage)}</TableCell></TableRow>)}</TableBody>
        </Table>
        <EmptyState loading={loading} empty={!overview?.scheduler.workers.length} />
      </SectionCard>
    </div>

    <section className="space-y-4"><div><h2 className="text-lg font-semibold">工作流实例</h2><p className="mt-1 text-sm text-muted-foreground">查看、筛选和管理全部应用的工作流及其 Task。</p></div><WorkflowPanel /></section>

    <SectionCard title="用户权限" description="管理员可以查看全站任务并使用本管理面板。">
      <Table>
        <TableHeader><TableRow><TableHead>用户</TableHead><TableHead>账号 ID</TableHead><TableHead>注册时间</TableHead><TableHead className="text-right">管理员</TableHead></TableRow></TableHeader>
        <TableBody>{users.map((user) => <TableRow key={user.id}><TableCell className="font-medium">{user.username}{user.id === currentUser?.id ? <Badge className="ml-2" variant="secondary">当前账号</Badge> : null}</TableCell><TableCell className="font-mono text-xs">#{user.id}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(user.created_at)}</TableCell><TableCell className="text-right"><Switch checked={user.is_admin} disabled={updatingUserId !== null || user.id === currentUser?.id} onCheckedChange={(checked) => updateUser(user, checked)} aria-label={`设置 ${user.username} 的管理员权限`} /></TableCell></TableRow>)}</TableBody>
      </Table>
      <EmptyState loading={loading} empty={!users.length} />
    </SectionCard>

    <IncrementalWorkerDialog
      error={error}
      open={incrementalDialogOpen}
      selected={selectedIncrementalWorkers}
      submitting={action === "incremental"}
      workers={overview?.scheduler.incremental_workers ?? []}
      onOpenChange={setIncrementalDialogOpen}
      onSelectedChange={setSelectedIncrementalWorkers}
      onSubmit={runIncrementalUpdate}
    />
  </div>;
}

function SummaryCard({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: number | undefined }) {
  return <Card className="gap-3 py-5"><CardContent className="flex items-center gap-4"><span className="grid size-10 place-items-center rounded-md border bg-muted text-primary [&_svg]:size-5">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function FeedbackMessage({ tone, value }: { tone: "error" | "success"; value: string }) {
  if (!value) return null;
  const className = tone === "error"
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  return <div className={`rounded-md border px-4 py-3 text-sm ${className}`}>{value}</div>;
}

function ManagementAction({ action, description, icon, title }: { action: ReactNode; description: string; icon: ReactNode; title: string }) {
  return <div className="flex min-h-36 flex-col rounded-md border bg-muted/25 p-4"><div className="flex items-center gap-2 font-medium [&_svg]:size-4">{icon}{title}</div><p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{description}</p><div className="mt-4">{action}</div></div>;
}

function SectionCard({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b py-5"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0">{children}</CardContent></Card>;
}

function Definition({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className={mono ? "font-mono text-xs" : "font-medium"}>{value}</dd></div>;
}

function EmptyState({ empty, loading }: { empty: boolean; loading: boolean }) {
  if (!loading && !empty) return null;
  return <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">{loading ? <><Loader2 className="size-4 animate-spin" />正在加载...</> : <><Activity className="size-4" />暂无数据</>}</div>;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function updateAdministratorCount(overview: AdminOverview | null, isAdmin: boolean) {
  if (!overview) return overview;
  return {
    ...overview,
    users: {
      ...overview.users,
      administrators: overview.users.administrators + (isAdmin ? 1 : -1)
    }
  };
}
