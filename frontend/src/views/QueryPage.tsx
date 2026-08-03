import { DatabaseZap, Loader2, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { queryApi } from "@/assets/lib/query";
import { AppPagination } from "@/components/AppPagination";
import { PageHero } from "@/components/PageHero";
import SchedulerStateBadge from "@/components/scheduler/SchedulerStateBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QueryProject, QueryProjectPage } from "@/types/query";

const PAGE_SIZE = 10;

export default function QueryPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<QueryProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QueryProject | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const totalPages = Math.max(1, Math.ceil((projects?.total ?? 0) / PAGE_SIZE));
  const atLimit = (projects?.total ?? 0) >= (projects?.limit ?? 5);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    setError("");
    try { setProjects(await queryApi.listProjects(page, PAGE_SIZE)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function create() {
    if (!title.trim() || atLimit) return;
    setSaving(true);
    setError("");
    try {
      const project = await queryApi.createProject(title.trim());
      setCreateOpen(false);
      navigate(`/query/projects/${project.id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await queryApi.deleteProject(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setDeleting(false); }
  }

  return <div className="space-y-5">
    <PageHero chips={["查询 DSL", "Parquet", "DuckDB SQL"]} description="通过 DSL 生成查询结果，并在浏览器中使用 SQL 关联当前用户已有项目的 Parquet。" eyebrow="DATA QUERY" icon={DatabaseZap} stat={{ label: "查询项目", value: `${projects?.total ?? 0}/${projects?.limit ?? 5}` }} title="数据查询" variant="analysis" />
    <div className="flex justify-end gap-3"><Button variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button><Button disabled={atLimit} onClick={() => setCreateOpen(true)}><Plus />新建查询</Button></div>
    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    <Card className="overflow-hidden py-0 shadow-sm"><CardContent className="p-0"><Table className="min-w-[760px] table-fixed"><TableHeader><TableRow><TableHead className="w-[38%] px-5">名称</TableHead><TableHead className="w-40 px-4">状态</TableHead><TableHead className="w-32 px-3">Workflow ID</TableHead><TableHead className="w-48 px-3">更新时间</TableHead><TableHead className="w-16 px-3 text-right">操作</TableHead></TableRow></TableHeader><TableBody>
      {projects?.items.map((project) => <ProjectRow key={project.id} project={project} onOpen={() => navigate(`/query/projects/${project.id}`)} onDelete={() => setDeleteTarget(project)} />)}
      {loading ? <ProjectTableState><Loader2 className="animate-spin" />正在加载...</ProjectTableState> : null}
      {!loading && !projects?.items.length ? <ProjectTableState>暂无查询项目</ProjectTableState> : null}
    </TableBody></Table></CardContent></Card>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">每个用户最多创建 {projects?.limit ?? 5} 个项目</p><AppPagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>创建查询项目</DialogTitle><DialogDescription>项目保存当前查询结果，不创建历史版本。</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="query-project-title">项目名称</Label><Input id="query-project-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") create(); }} /></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button disabled={saving || !title.trim()} onClick={create}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}创建</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><DialogContent><DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>删除后将同时清理“{deleteTarget?.title}”的查询工作流和 Parquet 结果。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="destructive" disabled={deleting} onClick={remove}>{deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}删除</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ProjectRow({ onDelete, onOpen, project }: { onDelete: () => void; onOpen: () => void; project: QueryProject }) { return <TableRow className="group cursor-pointer" onClick={onOpen}><TableCell className="px-5 py-4 font-medium group-hover:underline">{project.title}</TableCell><TableCell className="px-4 py-4"><SchedulerStateBadge state={project.current?.state ?? "IDLE"} /></TableCell><TableCell className="px-3 py-4 font-mono text-sm text-muted-foreground">{project.current?.workflow_instance_id ?? "—"}</TableCell><TableCell className="px-3 py-4 text-muted-foreground">{new Date(project.updated_at).toLocaleString("zh-CN")}</TableCell><TableCell className="px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>; }
function ProjectTableState({ children }: { children: React.ReactNode }) { return <TableRow><TableCell colSpan={5}><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">{children}</div></TableCell></TableRow>; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
