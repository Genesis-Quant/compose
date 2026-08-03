import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconClock3 from "~icons/lucide/clock-3";
import IconCode2 from "~icons/lucide/code-2";
import IconBraces from "~icons/lucide/braces";
import IconFileClock from "~icons/lucide/file-clock";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconPencil from "~icons/lucide/pencil";
import IconSave from "~icons/lucide/save";
import IconTerminal from "~icons/lucide/terminal";

import { factorApi } from "@/assets/lib/factor";
import { tasksApi } from "@/assets/lib/tasks";
import FactorAnalysisEditor from "@/components/editor/FactorAnalysisEditor";
import FactorAnalysisReport from "@/components/report/FactorAnalysisReport";
import RequestBodyDialog from "@/components/research/RequestBodyDialog";
import SaveVersionDialog from "@/components/research/SaveVersionDialog";
import VersionCompareDialog from "@/components/research/VersionCompareDialog";
import VersionNavigator from "@/components/research/VersionNavigator";
import TaskLogModal from "@/components/task/TaskLogModal";
import TaskRunButton from "@/components/task/TaskRunButton";
import { analysisDsl, analysisSettings, applyAnalysisSettings, defaultAnalysisParameters, type DslCatalog, type FactorAnalysisParameters, type FactorMetrics, type FactorProject, type FactorVersion } from "@/types/factor";
import { terminalStates } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FactorAnalysisDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<FactorProject | null>(null);
  const [versions, setVersions] = useState<FactorVersion[]>([]);
  const [catalog, setCatalog] = useState<DslCatalog | null>(null);
  const [parameters, setParameters] = useState<FactorAnalysisParameters>(defaultAnalysisParameters());
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskState, setTaskState] = useState("IDLE");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FactorMetrics | null>(null);
  const [dslValid, setDslValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState("");
  const currentVersion = useMemo(() => versions.find((version) => version.version === selectedVersion), [selectedVersion, versions]);
  const displayedTaskId = currentVersion?.task_id ?? taskId;
  const displayedParameters = useMemo(() => normalizeAnalysisParameters(currentVersion?.parameters ?? parameters), [currentVersion, parameters]);
  const resultParameters = useMemo(() => normalizeAnalysisParameters(currentVersion?.parameters ?? project?.draft?.parameters ?? parameters), [currentVersion, parameters, project?.draft?.parameters]);
  const displayedState = currentVersion ? "SUCCESS" : taskState;
  const readOnly = currentVersion !== undefined;
  const activeTask = !currentVersion && taskId !== null && !terminalStates.has(taskState);
  const running = submitting || activeTask;
  const analysisReady = dslValid && validAnalysisContract(parameters, catalog);
  const captureMetrics = useCallback((value: FactorMetrics) => setMetrics(value), []);

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      navigate("/factor", { replace: true });
      return;
    }
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
          const refreshed = await factorApi.getProject(projectId);
          setProject(refreshed);
        }
      } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [projectId, taskId, taskState]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextProject, nextVersions, nextCatalog] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId), factorApi.catalog()]);
      setProject(nextProject);
      setVersions(nextVersions);
      setCatalog(nextCatalog);
      setStopping(false);
      if (nextProject.draft) {
        setSelectedVersion(null);
        setParameters(normalizeAnalysisParameters(nextProject.draft.parameters));
        setTaskId(nextProject.draft.task_id);
        setTaskState(nextProject.draft.state);
        setTaskError(nextProject.draft.error);
      } else if (nextVersions[0]) {
        setSelectedVersion(nextVersions[0].version);
        setParameters(nextVersions[0].parameters);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }

  async function analyze() {
    if (!analysisReady || running || readOnly) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setMetrics(null);
    setTaskError(null);
    try {
      const submitted = await factorApi.analyze(projectId, normalizeAnalysisParameters(parameters));
      setTaskId(submitted.task_id);
      setTaskState("SUBMITTED");
      setSelectedVersion(null);
      const refreshed = await factorApi.getProject(projectId);
      setProject(refreshed);
      if (refreshed.draft) setParameters(normalizeAnalysisParameters(refreshed.draft.parameters));
      setTaskState(refreshed.draft?.state ?? "SUBMITTED");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopAnalysis() {
    if (!taskId || !activeTask || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await tasksApi.stop(taskId);
      setTaskState(response.task.state);
      setTaskError(response.task.error);
      if (terminalStates.has(response.task.state)) {
        setStopping(false);
        setProject(await factorApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function saveVersion() {
    if (!taskId || !metrics) return;
    setSubmitting(true);
    setError("");
    try {
      const saved = await factorApi.saveVersion(projectId, taskId, remark, metrics);
      const [nextProject, nextVersions] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setSelectedVersion(saved.version);
      setSaveOpen(false);
      setRemark("");
      setTaskId(null);
      setTaskState("IDLE");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSubmitting(false); }
  }

  function continueFromVersion() {
    if (!currentVersion) return;
    setParameters(structuredClone(currentVersion.parameters));
    setSelectedVersion(null);
    setTaskId(project?.draft?.task_id ?? null);
    setTaskState(project?.draft?.state ?? "IDLE");
    setMetrics(null);
  }

  if (loading || !project || !catalog) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><IconLoaderCircle className="animate-spin text-primary" width={26} height={26} /></div>;

  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.8fr)] xl:gap-6">
    <section className="space-y-4 xl:sticky xl:top-24 xl:self-start">
    <AnalysisControls
      catalog={catalog}
      activeTask={activeTask}
      displayedParameters={displayedParameters}
      displayedState={displayedState}
      displayedTaskId={displayedTaskId}
      dslValid={analysisReady}
      metrics={metrics}
      project={project}
      readOnly={readOnly}
      stopping={stopping}
      submitting={submitting}
      selectedVersion={selectedVersion}
      taskState={taskState}
      versions={versions}
      projectId={projectId}
      onAnalyze={analyze}
      onCompare={() => setCompareOpen(true)}
      onContinue={continueFromVersion}
      onLogs={() => setLogsOpen(true)}
      onShowParameters={() => setParametersOpen(true)}
      onSave={() => setSaveOpen(true)}
      onStop={stopAnalysis}
      onParameters={setParameters}
      onValidity={setDslValid}
      onVersion={(version) => { setSelectedVersion(version); setMetrics(null); }}
    />
    </section>
    <AnalysisResults
      displayedParameters={resultParameters}
      displayedState={displayedState}
      displayedTaskId={displayedTaskId}
      error={error}
      readOnly={readOnly}
      running={running}
      taskError={taskError}
      onMetrics={captureMetrics}
    />
    <SaveVersionDialog
      latestVersion={project.latest_version}
      open={saveOpen}
      remark={remark}
      submitting={submitting}
      onClose={() => setSaveOpen(false)}
      onRemark={setRemark}
      onSave={saveVersion}
    />
    <VersionCompareDialog currentVersion={selectedVersion} kind="factor" open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <RequestBodyDialog endpoint={`/api/v1/factor/projects/${projectId}/analyses`} open={parametersOpen} value={displayedParameters} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} taskId={displayedTaskId} onOpenChange={setLogsOpen} />
  </div>;
}

type AnalysisControlsProps = {
  activeTask: boolean;
  catalog: DslCatalog;
  displayedParameters: FactorAnalysisParameters;
  displayedState: string;
  displayedTaskId: number | null;
  dslValid: boolean;
  metrics: FactorMetrics | null;
  project: FactorProject;
  projectId: number;
  readOnly: boolean;
  stopping: boolean;
  submitting: boolean;
  selectedVersion: number | null;
  taskState: string;
  versions: FactorVersion[];
  onAnalyze: () => void;
  onCompare: () => void;
  onContinue: () => void;
  onLogs: () => void;
  onShowParameters: () => void;
  onParameters: (parameters: FactorAnalysisParameters) => void;
  onSave: () => void;
  onStop: () => void;
  onValidity: (valid: boolean) => void;
  onVersion: (version: number | null) => void;
};

function AnalysisControls({ activeTask, catalog, displayedParameters, displayedState, displayedTaskId, dslValid, metrics, project, projectId, readOnly, selectedVersion, stopping, submitting, taskState, versions, onAnalyze, onCompare, onContinue, onLogs, onParameters, onSave, onShowParameters, onStop, onValidity, onVersion }: AnalysisControlsProps) {
  return <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-md border bg-card shadow-sm">
    <div className="space-y-4 px-5 pb-0 pt-5">
      <div className="flex items-center gap-3"><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{project.title}</h1><IconPencil className="text-foreground" width={16} height={16} aria-hidden="true" /></div>
      <p className="text-sm leading-6 text-muted-foreground">切换历史版本，或重新执行后保存为新版本。</p>
      <VersionNavigator displayedState={displayedState} displayedTaskId={displayedTaskId} hasDraft={Boolean(project.draft)} onCompare={selectedVersion !== null && versions.length > 1 ? onCompare : undefined} selectedVersion={selectedVersion} versions={versions} onVersion={onVersion} />
    </div>
    <div className="space-y-5 p-5">
      <FactorAnalysisEditor catalog={catalog} parameters={displayedParameters} projectId={projectId} readOnly={readOnly} onChange={onParameters} onValidityChange={onValidity} />
      <div className="grid grid-cols-2 gap-3">
        {readOnly ? <Button className="col-span-2" onClick={onContinue}><IconCode2 />基于此版本研究</Button> : <><TaskRunButton active={activeTask} disabled={!dslValid} label="执行分析" stopping={stopping} submitting={submitting} onRun={onAnalyze} onStop={onStop} /><Button variant="outline" disabled={!metrics || taskState !== "SUCCESS"} onClick={onSave}><IconSave />保存</Button></>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onShowParameters}><IconBraces />展示参数</Button>
        <Button variant="outline" disabled={!displayedTaskId} onClick={onLogs}><IconTerminal />任务日志</Button>
      </div>
    </div>
  </div>;
}

type AnalysisResultsProps = {
  displayedParameters: FactorAnalysisParameters;
  displayedState: string;
  displayedTaskId: number | null;
  error: string;
  readOnly: boolean;
  running: boolean;
  taskError: string | null;
  onMetrics: (metrics: FactorMetrics) => void;
};

function AnalysisResults({ displayedParameters, displayedState, displayedTaskId, error, readOnly, running, taskError, onMetrics }: AnalysisResultsProps) {
  const [factor, setFactor] = useState(displayedParameters.factor_columns[0] ?? "");

  useEffect(() => {
    if (!displayedParameters.factor_columns.includes(factor)) setFactor(displayedParameters.factor_columns[0] ?? "");
  }, [displayedParameters.factor_columns, factor]);

  return <section className="min-w-0 space-y-5">
    <div className="sticky top-20 z-30 flex items-center justify-between gap-3">
      <Tabs value={factor} onValueChange={setFactor}><TabsList>{displayedParameters.factor_columns.map((column) => <TabsTrigger key={column} value={column}>{column}</TabsTrigger>)}</TabsList></Tabs>
      <Button variant="outline" asChild><Link to="/factor"><IconArrowLeft />返回因子分析</Link></Button>
    </div>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-xs text-destructive">{error}</div>}
    {taskError && <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-xs text-destructive">{taskError}</div>}
    {running && <div className="grid min-h-80 place-items-center rounded-md border bg-card text-center shadow-sm"><div><IconClock3 className="mx-auto animate-pulse text-primary" width={24} height={24} /><h3 className="mt-4 font-semibold">DolphinScheduler 正在执行分析</h3><p className="mt-2 text-sm text-muted-foreground">中间过程由 Tasks API 轮询，页面刷新后仍可恢复。</p></div></div>}
    {displayedTaskId && displayedState === "SUCCESS" && factor && <FactorAnalysisReport factor={factor} key={displayedTaskId} parameters={displayedParameters} taskId={displayedTaskId} onMetrics={onMetrics} />}
    {!displayedTaskId && !readOnly && <div className="grid min-h-80 place-items-center rounded-md border bg-card text-center shadow-sm"><div><IconFileClock className="mx-auto text-muted-foreground" width={24} height={24} /><h3 className="mt-4 font-semibold">尚未运行分析</h3><p className="mt-2 text-sm text-muted-foreground">填写左侧参数和 DSL 后执行分析。</p></div></div>}
  </section>;
}

function normalizeAnalysisParameters(parameters: FactorAnalysisParameters): FactorAnalysisParameters {
  return applyAnalysisSettings(parameters, analysisDsl(parameters), analysisSettings(parameters));
}

function validAnalysisContract(parameters: FactorAnalysisParameters, catalog: DslCatalog | null) {
  if (!catalog) return false;
  const numericDerivatives = Object.entries(parameters.dataset_query.derivatives)
    .filter(([, node]) => catalog.operators.find((operator) => operator.op === node.op)?.output_kind !== "BOOL")
    .map(([name]) => name);
  const outputs = new Set([...parameters.dataset_query.factors, ...numericDerivatives]);
  const derivatives = new Set(numericDerivatives);
  return parameters.codes_query !== null
    && parameters.factor_columns.length > 0
    && parameters.factor_columns.every((column) => outputs.has(column))
    && parameters.return_columns.length > 0
    && parameters.return_columns.every((column) => derivatives.has(column));
}
