import { Activity, Clock3, Eye, Loader2, RefreshCw, Server, Square, Terminal, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { tasksApi } from "@/assets/lib/tasks";
import { AppPagination } from "@/components/AppPagination";
import { PageHero } from "@/components/PageHero";
import TaskDetailsModal from "@/components/task/TaskDetailsModal";
import TaskLogModal from "@/components/task/TaskLogModal";
import TaskStateBadge from "@/components/task/TaskStateBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { terminalStates, type TaskApplication, type TaskListItem, type TaskListPage } from "@/types/task";

const PAGE_SIZE = 20;
const applicationNames = { query: "Query", factor: "Factor", backtest: "Backtest" } as const;
type StateFilter = "all" | "active" | "success" | "failure";

export default function TasksPage() {
  const [result, setResult] = useState<TaskListPage | null>(null);
  const [page, setPage] = useState(1);
  const [application, setApplication] = useState<"all" | TaskApplication>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stoppingTaskId, setStoppingTaskId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [detailsTask, setDetailsTask] = useState<TaskListItem | null>(null);
  const [logTaskId, setLogTaskId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setResult(await tasksApi.list({ page, page_size: PAGE_SIZE, application: application === "all" ? undefined : application, state: state === "all" ? undefined : state }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [application, page, state]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setDetailsTask((current) => current ? result?.items.find((task) => task.application === current.application && task.record_id === current.record_id) ?? current : null);
  }, [result]);
  useEffect(() => {
    if (!stoppingTaskId) return;
    const task = result?.items.find((item) => item.task_id === stoppingTaskId);
    if (task && terminalStates.has(task.state)) setStoppingTaskId(null);
  }, [result, stoppingTaskId]);
  const containsActiveTask = useMemo(() => result?.items.some((task) => !terminalStates.has(task.state)) ?? false, [result]);
  useEffect(() => {
    if (!containsActiveTask) return undefined;
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
  }, [containsActiveTask, load]);

  function changeApplication(value: string) { setApplication(value as "all" | TaskApplication); setPage(1); }
  function changeState(value: string) { setState(value as StateFilter); setPage(1); }

  async function stopTask(taskId: number) {
    if (stoppingTaskId === taskId) return;
    setStoppingTaskId(taskId);
    setError("");
    try {
      await tasksApi.stop(taskId);
      await load(true);
    } catch (reason) {
      setStoppingTaskId(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return <div className="space-y-6">
    <PageHero chips={["统一状态", "日志追踪", "自动刷新"]} description="统一查看 Query、Factor 和 Backtest 的执行状态、调度信息与运行日志。" eyebrow="TASKS" icon={Workflow} stat={{ label: "筛选结果", value: result?.total ?? 0 }} title="任务管理" variant="analysis" />

    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div className="flex flex-wrap items-end gap-3"><Filter label="应用"><Select value={application} onValueChange={changeApplication}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部应用</SelectItem><SelectItem value="query">Query</SelectItem><SelectItem value="factor">Factor</SelectItem><SelectItem value="backtest">Backtest</SelectItem></SelectContent></Select></Filter><Filter label="状态"><Select value={state} onValueChange={changeState}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="active">运行中</SelectItem><SelectItem value="success">成功</SelectItem><SelectItem value="failure">失败</SelectItem></SelectContent></Select></Filter></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">运行任务每 5 秒自动更新</span><Button variant="outline" disabled={refreshing} onClick={() => load(true)}>{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button></div></div>

    <Card className="gap-0 py-0 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead className="w-28 px-4">任务 ID</TableHead><TableHead className="w-28">应用</TableHead><TableHead className="w-40">状态</TableHead><TableHead>工作流 / 进程</TableHead><TableHead className="w-40">执行节点</TableHead><TableHead className="w-44">开始时间</TableHead><TableHead className="w-24 text-right">耗时</TableHead><TableHead className="w-48 px-4 text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {result?.items.map((task) => <TaskRow key={`${task.application}-${task.record_id}`} stopping={stoppingTaskId === task.task_id} task={task} onDetails={() => setDetailsTask(task)} onLogs={() => setLogTaskId(task.task_id)} onStop={() => task.task_id && stopTask(task.task_id)} />)}
            {loading ? <TaskTableState><Loader2 className="animate-spin" />正在读取任务...</TaskTableState> : null}
            {!loading && !result?.items.length ? <TaskTableState><Activity />当前筛选下暂无任务</TaskTableState> : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">共 {result?.total ?? 0} 个任务</p><AppPagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>

    <TaskDetailsModal open={detailsTask !== null} task={detailsTask} onOpenChange={(open) => { if (!open) setDetailsTask(null); }} />
    <TaskLogModal open={logTaskId !== null} taskId={logTaskId} onOpenChange={(open) => { if (!open) setLogTaskId(null); }} />
  </div>;
}

function Filter({ children, label }: { children: React.ReactNode; label: string }) { return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>; }

function TaskRow({ onDetails, onLogs, onStop, stopping, task }: { onDetails: () => void; onLogs: () => void; onStop: () => void; stopping: boolean; task: TaskListItem }) {
  const active = task.task_id !== null && !terminalStates.has(task.state);
  return <TableRow><TableCell className="px-4 font-mono text-xs font-semibold">{task.task_id ?? <span className="text-muted-foreground">等待调度</span>}</TableCell><TableCell><Badge variant="secondary" className="font-mono uppercase">{applicationNames[task.application]}</Badge></TableCell><TableCell><TaskStateBadge state={task.state} /></TableCell><TableCell><div className="max-w-72 truncate text-xs font-medium">{task.workflow_name ?? "等待调度"}</div><div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">Process #{task.process_instance_id ?? "—"} · Record #{task.record_id}</div></TableCell><TableCell><div className="flex items-center gap-2 truncate font-mono text-xs text-muted-foreground"><Server className="size-3.5 shrink-0" />{task.host ?? "—"}</div></TableCell><TableCell><div className="font-mono text-xs">{formatDate(task.started_at ?? task.created_at)}</div><div className="mt-1 text-[10px] text-muted-foreground">{task.started_at ? "开始执行" : "创建时间"}</div></TableCell><TableCell className="text-right"><span className="inline-flex items-center gap-1.5 font-mono text-xs"><Clock3 className="size-3 text-muted-foreground" />{formatDuration(task.duration_seconds)}</span></TableCell><TableCell className="px-4"><div className="flex justify-end gap-1">{active ? <Button size="sm" variant="destructive" disabled={stopping} onClick={onStop}>{stopping ? <Loader2 className="animate-spin" /> : <Square />}{stopping ? "终止中" : "终止"}</Button> : null}<Button title="查看详情" aria-label="查看任务详情" size="icon-sm" variant="ghost" onClick={onDetails}><Eye /></Button><Button title="查看日志" aria-label="查看任务日志" size="icon-sm" variant="ghost" disabled={!task.task_id} onClick={onLogs}><Terminal /></Button></div></TableCell></TableRow>;
}

function TaskTableState({ children }: { children: React.ReactNode }) { return <TableRow><TableCell colSpan={8}><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">{children}</div></TableCell></TableRow>; }
function formatDate(value: string) { return new Date(value).toLocaleString("zh-CN", { hour12: false }); }
function formatDuration(seconds: number | null) { if (seconds === null) return "—"; if (seconds < 60) return `${seconds.toFixed(1)}s`; const minutes = Math.floor(seconds / 60); return `${minutes}m ${Math.round(seconds % 60)}s`; }
