import IconActivity from "~icons/lucide/activity";
import IconBox from "~icons/lucide/box";
import IconBraces from "~icons/lucide/braces";
import IconCalendarClock from "~icons/lucide/calendar-clock";
import IconGitBranch from "~icons/lucide/git-branch";

import { formatDateTime, formatDuration, workflowApplicationNames } from "@/assets/lib/workflows";
import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Separator } from "@/ui/separator";
import type { WorkflowListItem } from "@/types/workflow";

export default function WorkflowDetailsModal({ onOpenChange, open, workflow }: { onOpenChange: (open: boolean) => void; open: boolean; workflow: WorkflowListItem | null }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(980px,calc(100vw-2rem))]">
      <DialogHeader className="border-b px-5 py-4 pr-12"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/45"><IconActivity width={16} height={16} /></span><div className="min-w-0"><DialogTitle className="truncate text-base">工作流详情</DialogTitle><DialogDescription className="mt-0.5 font-mono text-[11px]">{workflow ? `${workflowApplicationNames[workflow.application]} / Workflow #${workflow.workflow_instance_id}` : "工作流"}</DialogDescription></div></div></DialogHeader>
      {workflow && <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="grid grid-cols-2 border-b bg-muted/15 md:grid-cols-4"><Meta icon={<IconActivity />} label="工作流状态"><SchedulerStateBadge state={workflow.state} /></Meta><Meta icon={<IconGitBranch />} label="工作流" value={workflow.workflow_name} /><Meta icon={<IconBox />} label="Task 数量" value={String(workflow.tasks.length)} /><Meta icon={<IconCalendarClock />} label="运行耗时" value={formatDuration(workflow.duration_seconds, "long")} /></section>
        <section className="grid gap-px bg-border md:grid-cols-3">
          <InformationGroup title="调度标识" rows={[["Workflow Instance ID", workflow.workflow_instance_id], ["内部记录 ID", workflow.record_id], ["项目编码", workflow.project_code], ["工作流定义编码", workflow.workflow_definition_code]]} />
          <InformationGroup title="执行信息" rows={[["应用", workflowApplicationNames[workflow.application]], ["开始时间", formatDateTime(workflow.started_at)], ["完成时间", formatDateTime(workflow.finished_at)], ["最后同步", formatDateTime(workflow.last_synced_at)]]} />
          <InformationGroup title="记录时间" rows={[["创建时间", formatDateTime(workflow.created_at)], ["更新时间", formatDateTime(workflow.updated_at)], ["Task 查询", workflow.tasks_error ?? "正常"]]} />
        </section>
        <Separator />
        {workflow.error && <section className="border-b border-rose-500/20 bg-rose-500/8 px-5 py-4"><div className="text-xs font-semibold text-rose-600 dark:text-rose-400">失败信息</div><p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-rose-700 dark:text-rose-300">{workflow.error}</p></section>}
        <section className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]"><div className="min-w-0"><SectionTitle icon={<IconBraces />} title="请求参数" /><pre className="mt-3 max-h-96 overflow-auto rounded-md border bg-muted/30 p-4 font-mono text-[11px] leading-5 text-foreground">{JSON.stringify(workflow.payload, null, 2)}</pre></div><div className="space-y-5"><div><SectionTitle icon={<IconBox />} title="请求输出" /><div className="mt-3 flex min-h-12 flex-wrap content-start gap-2 rounded-md border bg-muted/15 p-3">{workflow.requested_outputs.length ? workflow.requested_outputs.map((output) => <Badge className="font-mono" variant="secondary" key={output}>{output}</Badge>) : <span className="text-xs text-muted-foreground">未指定输出</span>}</div></div><History title="状态历史" items={workflow.state_history} primaryKey="state" /><History title="工作流事件" items={workflow.events} primaryKey="event" /></div></section>
      </div>}
    </DialogContent>
  </Dialog>;
}

function Meta({ children, icon, label, value }: { children?: React.ReactNode; icon: React.ReactNode; label: string; value?: string }) { return <div className="min-w-0 border-r border-t px-4 py-3 first:border-t-0 md:border-t-0"><div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground">{icon}{label}</div><div className="mt-2 truncate font-mono text-xs font-medium">{children ?? value}</div></div>; }
function InformationGroup({ rows, title }: { rows: Array<[string, number | string | null]>; title: string }) { return <div className="bg-background p-5"><h3 className="text-xs font-semibold">{title}</h3><dl className="mt-3 space-y-2.5">{rows.map(([label, value]) => <div className="flex items-start justify-between gap-4 text-xs" key={label}><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 break-all text-right font-mono">{value ?? "—"}</dd></div>)}</dl></div>; }
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <h3 className="flex items-center gap-2 text-xs font-semibold">{icon}{title}</h3>; }
function History({ items, primaryKey, title }: { items: Record<string, unknown>[]; primaryKey: string; title: string }) { return <div><h3 className="text-xs font-semibold">{title}</h3><div className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-md border bg-muted/10 p-2">{items.length ? [...items].reverse().map((item, index) => <div className="rounded-sm px-2 py-2 text-[11px] hover:bg-muted/40" key={`${String(item.timestamp)}-${index}`}><div className="flex items-center justify-between gap-3"><span className="font-mono font-semibold">{String(item[primaryKey] ?? "—")}</span><span className="shrink-0 text-muted-foreground">{formatDateTime(typeof item.timestamp === "string" ? item.timestamp : null)}</span></div></div>) : <div className="px-2 py-3 text-xs text-muted-foreground">暂无记录</div>}</div></div>; }
