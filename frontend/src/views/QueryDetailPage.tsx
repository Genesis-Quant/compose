import { ArrowLeft, Braces, Clock3, Database, FileQuestion, Loader2, Play, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { BrowserDuckDb } from "@/assets/lib/duckdb";
import { queryApi } from "@/assets/lib/query";
import { tasksApi } from "@/assets/lib/tasks";
import DslEditor from "@/components/editor/DslEditor";
import SqlEditor from "@/components/editor/SqlEditor";
import QueryCodesField from "@/components/research/QueryCodesField";
import RequestBodyDialog from "@/components/research/RequestBodyDialog";
import TaskLogModal from "@/components/task/TaskLogModal";
import TaskRunButton from "@/components/task/TaskRunButton";
import TaskStateBadge from "@/components/task/TaskStateBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DslDocument, FactorQuery } from "@/types/factor";
import { applyQueryDsl, defaultQueryParameters, queryDsl, type QueryCatalog, type QueryProject } from "@/types/query";
import { terminalStates } from "@/types/task";

const PREVIEW_LIMIT = 200;

export default function QueryDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<QueryProject | null>(null);
  const [projects, setProjects] = useState<QueryProject[]>([]);
  const [catalog, setCatalog] = useState<QueryCatalog | null>(null);
  const [parameters, setParameters] = useState<FactorQuery>(defaultQueryParameters());
  const [dslValid, setDslValid] = useState(true);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskState, setTaskState] = useState("IDLE");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [loadedPreviewTask, setLoadedPreviewTask] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("result");
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());
  const [sql, setSql] = useState("SELECT *\nFROM current_result\nLIMIT 200;");
  const [sqlRows, setSqlRows] = useState<Record<string, unknown>[]>([]);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlError, setSqlError] = useState("");
  const [parametersOpen, setParametersOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState("");
  const request = parameters;
  const sourceProjects = useMemo(() => projects.map((item) => item.id === project?.id ? project : item).filter((item): item is QueryProject => Boolean(item?.current?.task_id && item.current.state === "SUCCESS")), [project, projects]);
  const selectedProjectSources = useMemo(() => sourceProjects.filter((item) => selectedSources.has(item.id)), [selectedSources, sourceProjects]);
  const tableNames = selectedProjectSources.map((item) => tableName(item.id, projectId));
  const activeTask = taskId !== null && !terminalStates.has(taskState);
  const running = submitting || activeTask;

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) { navigate("/query", { replace: true }); return; }
    load();
  }, [projectId]);

  useEffect(() => {
    if (!taskId || terminalStates.has(taskState)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const task = await tasksApi.status(taskId);
        setTaskState(task.state);
        setTaskError(task.error);
        if (terminalStates.has(task.state)) {
          setStopping(false);
          window.clearInterval(timer);
          const [nextProject, page] = await Promise.all([queryApi.getProject(projectId), queryApi.listProjects(1, 5)]);
          setProject(nextProject);
          setProjects(page.items);
        }
      } catch (reason) { setError(errorMessage(reason)); }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [projectId, taskId, taskState]);

  useEffect(() => {
    if (taskState !== "SUCCESS" || !taskId || loadedPreviewTask === taskId) return;
    loadPreview(taskId);
    setSelectedSources((current) => new Set(current).add(projectId));
  }, [loadedPreviewTask, projectId, taskId, taskState]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextProject, page, nextCatalog] = await Promise.all([queryApi.getProject(projectId), queryApi.listProjects(1, 5), queryApi.catalog()]);
      setProject(nextProject);
      setProjects(page.items);
      setCatalog(nextCatalog);
      if (nextProject.current) {
        setStopping(false);
        setParameters(nextProject.current.parameters);
        setTaskId(nextProject.current.task_id);
        setTaskState(nextProject.current.state);
        setTaskError(nextProject.current.error);
        if (nextProject.current.state === "SUCCESS") setSelectedSources(new Set([projectId]));
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function runQuery() {
    if (!dslValid || running) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setTaskError(null);
    setPreviewRows([]);
    setPreviewError("");
    setLoadedPreviewTask(null);
    try {
      const submitted = await queryApi.run(projectId, request);
      setParameters(request);
      setTaskId(submitted.task_id);
      setTaskState("SUBMITTED");
      const nextProject = await queryApi.getProject(projectId);
      setProject(nextProject);
      setTaskState(nextProject.current?.state ?? "SUBMITTED");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopQuery() {
    if (!taskId || !activeTask || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await tasksApi.stop(taskId);
      setTaskState(response.task.state);
      setTaskError(response.task.error);
      if (terminalStates.has(response.task.state)) {
        setStopping(false);
        setProject(await queryApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(errorMessage(reason));
    }
  }

  async function loadPreview(nextTaskId: number) {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const buffer = await queryApi.output(nextTaskId, "data");
      const database = await BrowserDuckDb.create({ "current.parquet": buffer });
      try { setPreviewRows(await database.rows(`SELECT * FROM read_parquet('current.parquet') LIMIT ${PREVIEW_LIMIT}`)); }
      finally { await database.close(); }
      setLoadedPreviewTask(nextTaskId);
    } catch (reason) { setPreviewError(errorMessage(reason)); }
    finally { setPreviewLoading(false); }
  }

  async function runSql() {
    if (!sql.trim() || !selectedProjectSources.length) return;
    setSqlRunning(true);
    setSqlError("");
    try {
      const entries = await Promise.all(selectedProjectSources.map(async (source) => [`query-${source.id}.parquet`, await queryApi.output(Number(source.current?.task_id), "data")] as const));
      const database = await BrowserDuckDb.create(Object.fromEntries(entries));
      try {
        for (const source of selectedProjectSources) await database.rows(`CREATE VIEW ${tableName(source.id, projectId)} AS SELECT * FROM read_parquet('query-${source.id}.parquet')`);
        setSqlRows(await database.rows(sql));
      } finally { await database.close(); }
    } catch (reason) { setSqlError(errorMessage(reason)); }
    finally { setSqlRunning(false); }
  }

  function updateDsl(dsl: DslDocument) { setParameters((current) => applyQueryDsl(current, dsl)); }
  function toggleSource(id: number, enabled: boolean) { setSelectedSources((current) => { const next = new Set(current); if (enabled) next.add(id); else next.delete(id); return next; }); }

  if (loading || !project || !catalog) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;

  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(380px,0.85fr)_minmax(0,1.75fr)] xl:gap-6">
    <section className="xl:sticky xl:top-24 xl:self-start"><div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-md border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-5"><div className="min-w-0"><h1 className="truncate text-lg font-semibold">{project.title}</h1><p className="mt-1 text-xs text-muted-foreground">任务 ID：{taskId ?? "—"}</p></div><TaskStateBadge state={taskState} /></div>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3"><QueryField label="开始日期" type="date" value={parameters.start_date} onChange={(startDate) => setParameters({ ...parameters, start_date: startDate })} /><QueryField label="结束日期" type="date" value={parameters.end_date} onChange={(endDate) => setParameters({ ...parameters, end_date: endDate })} /></div>
        <QueryField label="回溯周期" value={parameters.lookback} onChange={(lookback) => setParameters({ ...parameters, lookback })} />
        <QueryCodesField codes={parameters.codes} projects={projects} onChange={(nextCodes) => setParameters({ ...parameters, codes: nextCodes })} />
        <div className="h-[430px]"><DslEditor catalog={catalog} modelPath={`factor-dsl://query/${projectId}/dataset.json`} value={queryDsl(parameters)} onChange={updateDsl} onValidityChange={setDslValid} /></div>
        <TaskRunButton active={activeTask} className="w-full" disabled={!dslValid} label="执行查询" stopping={stopping} submitting={submitting} onRun={runQuery} onStop={stopQuery} />
        <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setParametersOpen(true)}><Braces />展示参数</Button><Button variant="outline" disabled={!taskId} onClick={() => setLogsOpen(true)}><Terminal />任务日志</Button></div>
      </div>
    </div></section>

    <section className="min-w-0">
      <div className="mb-5 flex items-center justify-between gap-3"><Tabs value={activeTab} onValueChange={setActiveTab}><TabsList><TabsTrigger value="result">查询结果</TabsTrigger><TabsTrigger value="sql">SQL 二次查询</TabsTrigger></TabsList></Tabs><Button variant="outline" asChild><Link to="/query"><ArrowLeft />返回数据查询</Link></Button></div>
      {error ? <ErrorMessage message={error} /> : null}
      {taskError ? <ErrorMessage message={taskError} /> : null}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="result"><ResultPanel loading={previewLoading} rows={previewRows} running={running} state={taskState} error={previewError} /></TabsContent>
        <TabsContent value="sql"><div className="space-y-5">
          <Card className="py-0"><CardHeader className="border-b py-4"><CardTitle className="text-sm">数据源</CardTitle></CardHeader><CardContent className="divide-y p-0">{sourceProjects.length ? sourceProjects.map((source) => <label className="flex cursor-pointer items-center gap-4 px-5 py-3" key={source.id}><Switch checked={selectedSources.has(source.id)} onCheckedChange={(checked) => toggleSource(source.id, checked)} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{source.title}</span><code className="text-xs text-muted-foreground">{tableName(source.id, projectId)}</code></label>) : <div className="px-5 py-8 text-center text-sm text-muted-foreground">暂无成功的查询结果</div>}</CardContent></Card>
          <div className="h-[360px]"><SqlEditor modelPath={`sql://query/${projectId}/secondary.sql`} tables={tableNames} value={sql} onChange={setSql} /></div>
          <div className="flex justify-end"><Button disabled={sqlRunning || !sql.trim() || !selectedProjectSources.length} onClick={runSql}>{sqlRunning ? <Loader2 className="animate-spin" /> : <Play />}执行 SQL</Button></div>
          {sqlError ? <ErrorMessage message={sqlError} /> : null}
          {sqlRows.length ? <DataTable rows={sqlRows} /> : <EmptyPanel icon={Database} title="暂无 SQL 结果" description="选择数据源并执行 SQL。" />}
        </div></TabsContent>
      </Tabs>
    </section>
    <RequestBodyDialog endpoint={`/api/v1/query/projects/${projectId}/queries`} open={parametersOpen} value={request} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} taskId={taskId} onOpenChange={setLogsOpen} />
  </div>;
}

function ResultPanel({ error, loading, rows, running, state }: { error: string; loading: boolean; rows: Record<string, unknown>[]; running: boolean; state: string }) {
  if (error) return <ErrorMessage message={error} />;
  if (loading) return <EmptyPanel icon={Loader2} iconClassName="animate-spin" title="正在读取 Parquet" description="DuckDB 正在生成结果预览。" />;
  if (running) return <EmptyPanel icon={Clock3} iconClassName="animate-pulse" title="查询正在运行" description="任务完成后自动读取结果。" />;
  if (state === "SUCCESS") return rows.length ? <DataTable rows={rows} /> : <EmptyPanel icon={Database} title="查询结果为空" description="当前 Parquet 没有数据行。" />;
  return <EmptyPanel icon={FileQuestion} title="尚未执行查询" description="完成 DSL 后执行查询。" />;
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return <Card className="overflow-hidden py-0"><CardContent className="max-h-[calc(100vh-12rem)] overflow-auto p-0"><Table><TableHeader className="sticky top-0 z-10 bg-card"><TableRow>{columns.map((column) => <TableHead className="min-w-32 whitespace-nowrap px-4" key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={index}>{columns.map((column) => <TableCell className="max-w-72 truncate whitespace-nowrap px-4 font-mono text-xs" key={column} title={cellValue(row[column])}>{cellValue(row[column])}</TableCell>)}</TableRow>)}</TableBody></Table></CardContent></Card>;
}

function EmptyPanel({ description, icon: Icon, iconClassName = "", title }: { description: string; icon: typeof Database; iconClassName?: string; title: string }) { return <div className="grid min-h-80 place-items-center rounded-md border bg-card text-center shadow-sm"><div><Icon className={`mx-auto size-6 text-muted-foreground ${iconClassName}`} /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{description}</p></div></div>; }
function ErrorMessage({ message }: { message: string }) { return <div className="mb-5 rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">{message}</div>; }
function QueryField({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) { return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function tableName(id: number, currentId: number) { return id === currentId ? "current_result" : `query_${id}`; }
function cellValue(value: unknown): string { if (value === null || value === undefined) return "NULL"; if (value instanceof Date) return value.toLocaleString("zh-CN"); if (typeof value === "object") return JSON.stringify(value); return String(value); }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
