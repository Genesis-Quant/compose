import { client } from "@/assets/lib/request";
import type { WorkflowActionResponse, WorkflowInformation, WorkflowListFilters, WorkflowListPage } from "@/types/workflow";

export const workflowApplicationNames = { query: "Query", factor: "Factor", backtest: "Backtest", incremental: "Incremental" } as const;

export function formatDuration(seconds: number | null | undefined, style: "long" | "short" = "short") {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return style === "long" ? `${seconds.toFixed(1)} 秒` : `${seconds.toFixed(1)}s`;
  return style === "long" ? `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function resolveDurationSeconds(
  durationSeconds: number | null | undefined,
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
  active: boolean,
  now = Date.now()
) {
  if (!startedAt) return durationSeconds;
  if (!active && durationSeconds !== null && durationSeconds !== undefined) return durationSeconds;
  const startedTime = new Date(startedAt).getTime();
  const endedTime = active ? now : finishedAt ? new Date(finishedAt).getTime() : Number.NaN;
  if (!Number.isFinite(startedTime) || !Number.isFinite(endedTime)) return durationSeconds;
  return Math.max(0, (endedTime - startedTime) / 1000);
}

export function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

export const workflowsApi = {
  list: (filters: WorkflowListFilters) => client.get<WorkflowListPage>("/workflows", { params: filters }),
  status: (workflowInstanceId: number) => client.get<WorkflowInformation>(`/workflows/${workflowInstanceId}`),
  stop: (workflowInstanceId: number) => client.post<WorkflowActionResponse>(`/workflows/${workflowInstanceId}/actions/stop`, null)
};
