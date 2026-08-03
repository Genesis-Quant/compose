import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import IconActivity from "~icons/lucide/activity";
import IconClock3 from "~icons/lucide/clock-3";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconRefreshCw from "~icons/lucide/refresh-cw";
import IconServer from "~icons/lucide/server";
import IconTerminal from "~icons/lucide/terminal";

import { tasksApi } from "@/assets/lib/tasks";
import TaskStateBadge from "@/components/task/TaskStateBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { terminalStates, type TaskStatus } from "@/types/task";

const PAGE_SIZE = 500;
const applicationNames = { query: "QUERY", factor: "FACTOR", backtest: "BACKTEST" } as const;

type TaskLogModalProps = {
  open: boolean;
  taskId: number | null;
  onOpenChange: (open: boolean) => void;
};

export default function TaskLogModal({ onOpenChange, open, taskId }: TaskLogModalProps) {
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [message, setMessage] = useState("");
  const [nextLine, setNextLine] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const nextLineRef = useRef(0);
  const hasMoreRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async () => {
    if (!taskId) return null;
    const result = await tasksApi.status(taskId);
    setStatus(result);
    return result;
  }, [taskId]);

  const loadLogs = useCallback(async (reset: boolean, background = false) => {
    if (!taskId) return;
    if (!background) reset ? setLoading(true) : setLoadingMore(true);
    try {
      const result = await tasksApi.logs(taskId, reset ? 0 : nextLineRef.current, PAGE_SIZE);
      setMessage((current) => reset ? result.message : current + result.message);
      nextLineRef.current = result.next_line_num;
      hasMoreRef.current = result.has_more;
      setNextLine(result.next_line_num);
      setHasMore(result.has_more);
    } finally {
      if (!background) reset ? setLoading(false) : setLoadingMore(false);
    }
  }, [taskId]);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    setError("");
    setLoading(true);
    try {
      await Promise.all([loadStatus(), loadLogs(true, true)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [loadLogs, loadStatus, taskId]);

  useEffect(() => {
    if (!open || !taskId) return;
    setStatus(null);
    setMessage("");
    setNextLine(0);
    setHasMore(false);
    nextLineRef.current = 0;
    hasMoreRef.current = false;
    refresh();
  }, [open, refresh, taskId]);

  useEffect(() => {
    if (!open || !taskId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await loadStatus();
        if (!hasMoreRef.current) await loadLogs(false, true);
        if (result && terminalStates.has(result.state)) window.clearInterval(timer);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadLogs, loadStatus, open, taskId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [message]);

  async function loadMore() {
    setError("");
    try {
      await loadLogs(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(960px,calc(100vw-2rem))]" showCloseButton>
        <DialogHeader className="flex-row items-start justify-between gap-5 border-b px-5 py-4 pr-12 text-left">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-md border bg-muted/40"><IconTerminal width={15} height={15} /></span>
              <div><DialogTitle className="text-base">任务日志</DialogTitle><DialogDescription className="mt-0.5 font-mono text-[11px]">DolphinScheduler 任务 #{taskId ?? "—"}</DialogDescription></div>
            </div>
          </div>
          <Button disabled={loading || !taskId} size="sm" variant="outline" onClick={refresh}>{loading ? <IconLoaderCircle className="animate-spin" /> : <IconRefreshCw />}刷新</Button>
        </DialogHeader>

        <div className="grid grid-cols-2 border-b bg-muted/15 sm:grid-cols-4">
          <TaskMeta icon={<IconActivity width={13} height={13} />} label="状态" value={<TaskStateBadge state={status?.state ?? "LOADING"} />} />
          <TaskMeta icon={<IconTerminal width={13} height={13} />} label="应用" value={status ? applicationNames[status.application] : "—"} />
          <TaskMeta icon={<IconServer width={13} height={13} />} label="节点" value={status?.host ?? "—"} />
          <TaskMeta icon={<IconClock3 width={13} height={13} />} label="耗时" value={formatDuration(status?.duration_seconds)} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-muted/20 text-foreground">
          <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground"><span>{status?.workflow_name ?? "TASK"} / {taskId ?? "—"}</span><span>{nextLine.toLocaleString()} LINES</span></div>
          <div className="min-h-0 flex-1 overflow-auto" ref={logRef}>
            {loading && !message ? <div className="grid min-h-72 place-items-center"><IconLoaderCircle className="animate-spin text-muted-foreground" width={20} height={20} /></div> : <pre className="m-0 min-h-72 whitespace-pre-wrap break-words p-5 font-mono text-[11px] leading-5">{message || (error ? "" : "暂无日志")}</pre>}
          </div>
          {error && <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">{error}</div>}
          <footer className="flex min-h-11 items-center justify-between gap-4 border-t px-4 py-2"><span className="text-[10px] text-muted-foreground">通过 Tasks API 分页读取 · 每页 {PAGE_SIZE} 行</span>{hasMore && <Button disabled={loadingMore} size="sm" variant="ghost" onClick={loadMore}>{loadingMore ? "加载中…" : "加载更多"}</Button>}</footer>
        </div>
      </DialogContent>
  </Dialog>;
}

function TaskMeta({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="min-w-0 border-r border-t px-4 py-3 first:border-t-0 sm:border-t-0"><div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">{icon}{label}</div><div className="mt-1.5 truncate font-mono text-xs font-medium">{value}</div></div>;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}
