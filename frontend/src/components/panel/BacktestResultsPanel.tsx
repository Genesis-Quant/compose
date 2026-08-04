import { Clock3, FileClock } from "lucide-react";
import type { ReactNode } from "react";

import BacktestReport from "@/components/panel/BacktestReport";
import EmptyStatePanel from "@/components/panel/EmptyStatePanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import type { BacktestSummary } from "@/types/backtest";

type BacktestResultsPanelProps = { annualTradingDays: number; displayedState: string; displayedWorkflowInstanceId: number | null; error: string; onSummary: (summary: BacktestSummary) => void; readOnly: boolean; riskFreeRate: number; running: boolean; workflowError: string | null };

export default function BacktestResultsPanel({ annualTradingDays, displayedState, displayedWorkflowInstanceId, error, onSummary, readOnly, riskFreeRate, running, workflowError }: BacktestResultsPanelProps) {
  let content: ReactNode;
  if (displayedWorkflowInstanceId && displayedState === "SUCCESS") content = <BacktestReport annualTradingDays={annualTradingDays} key={displayedWorkflowInstanceId} riskFreeRate={riskFreeRate} workflowInstanceId={displayedWorkflowInstanceId} onSummary={onSummary} />;
  else content = <>{running ? <EmptyStatePanel description="中间过程由 Tasks API 轮询，页面刷新后仍可恢复。" icon={Clock3} iconClassName="animate-pulse text-primary" title="DolphinScheduler 正在执行回测" /> : null}{!displayedWorkflowInstanceId && !readOnly ? <EmptyStatePanel description="填写左侧参数，在代码弹窗中完成 DSL 与回调后执行。" icon={FileClock} title="尚未运行回测" /> : null}</>;
  return <section className="min-w-0 space-y-5">{error ? <ErrorPanel message={error} size="xs" /> : null}{workflowError ? <ErrorPanel message={workflowError} size="xs" /> : null}{content}</section>;
}
