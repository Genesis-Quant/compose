import { Activity, BarChart3, Loader2, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { backtestApi } from "@/assets/lib/backtest";
import { isInputMethodComposing } from "@/assets/lib/keyboard";
import { errorMessage } from "@/assets/lib/utils";
import { AppPagination } from "@/components/pagination/AppPagination";
import { PageHero } from "@/components/bar/PageHero";
import { ProjectTableState } from "@/components/table/ProjectTableState";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import type { BacktestProject, BacktestProjectPage } from "@/types/backtest";

export default function BacktestPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<BacktestProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BacktestProject | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const totalPages = Math.max(1, Math.ceil((projects?.total ?? 0) / pageSize));

  useEffect(() => { load(); }, [page, pageSize]);

  async function load() {
    setLoading(true);
    setError("");
    try { setProjects(await backtestApi.listProjects(page, pageSize)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const project = await backtestApi.createProject(title.trim());
      setCreateOpen(false);
      navigate(`/backtest/projects/${project.id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await backtestApi.deleteProject(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setDeleting(false); }
  }

  return <div className="space-y-5">
    <PageHero chips={["策略 DSL", "生命周期回调", "版本对比"]} description="管理策略回测项目、当前草稿和已保存版本，在统一任务链路中追踪执行与结果。" eyebrow="STRATEGY BACKTEST" icon={BarChart3} stat={{ label: "回测项目", value: projects?.total ?? 0 }} title="策略回测" variant="analysis" />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"><Button variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button><Button onClick={() => setCreateOpen(true)}><Plus />新建策略</Button></div>
    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    <Card className="overflow-hidden py-0 shadow-sm"><CardContent className="p-0"><Table className="min-w-[1180px] table-fixed"><TableHeader><TableRow><TableHead className="w-[260px] px-5">名称</TableHead><TableHead className="w-28 px-4">最新版本</TableHead><TableHead className="w-28 px-3 text-right">累计收益</TableHead><TableHead className="w-28 px-3 text-right">年化收益</TableHead><TableHead className="w-28 px-3 text-right">夏普比率</TableHead><TableHead className="w-28 px-3 text-right">年化波动</TableHead><TableHead className="w-28 px-3 text-right">最大回撤</TableHead><TableHead className="w-24 px-3 text-right">日胜率</TableHead><TableHead className="w-40 px-3">更新时间</TableHead><TableHead className="w-16 px-3 text-right">操作</TableHead></TableRow></TableHeader><TableBody>
      {projects?.items.map((project) => <ProjectRow key={project.id} project={project} onOpen={() => navigate(`/backtest/projects/${project.id}`)} onDelete={() => setDeleteTarget(project)} />)}
      {loading ? <ProjectTableState colSpan={10}><Loader2 className="animate-spin" />正在加载...</ProjectTableState> : null}
      {!loading && !projects?.items.length ? <ProjectTableState colSpan={10}><Activity className="size-4" />暂无回测项目</ProjectTableState> : null}
    </TableBody></Table></CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">共 {projects?.total ?? 0} 条</p><AppPagination page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>创建策略回测项目</DialogTitle><DialogDescription>创建后设置参数，并在代码弹窗中编辑 DSL 与回调函数。</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="backtest-project-title">项目名称</Label><Input id="backtest-project-title" autoFocus placeholder="例如：沪深 300 风险平价策略" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !isInputMethodComposing(event)) create(); }} /></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={create} disabled={saving || !title.trim()}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}创建</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><DialogContent><DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>删除后将无法查看“{deleteTarget?.title}”及其全部回测版本。该操作不可撤销。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="destructive" disabled={deleting} onClick={remove}>{deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}删除</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ProjectRow({ onDelete, onOpen, project }: { onDelete: () => void; onOpen: () => void; project: BacktestProject }) {
  return <TableRow className="group cursor-pointer" onClick={onOpen}><TableCell className="px-5 py-4 font-medium group-hover:underline">{project.title}</TableCell><TableCell className="px-4 py-4"><Badge variant="secondary">{project.latest_version ? `v${project.latest_version}` : "—"}</Badge></TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.totalReturn)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.annualReturn)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{decimal(project.latest_summary?.sharpeRatio)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.annualVolatility)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.maxDrawdown)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.dailyWinningRate)}</TableCell><TableCell className="px-3 py-4 text-muted-foreground">{new Date(project.updated_at).toLocaleString("zh-CN")}</TableCell><TableCell className="px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>;
}

function percent(value: number | null | undefined) { return value === null || value === undefined ? "—" : `${(value * 100).toFixed(2)}%`; }
function decimal(value: number | null | undefined) { return value === null || value === undefined ? "—" : value.toFixed(3); }
