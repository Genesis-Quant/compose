import { ArrowLeft, Braces, Clock3, Code2, FileClock, Loader2, Pencil, Save, Terminal } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { backtestApi } from "@/assets/lib/backtest";
import { workflowsApi } from "@/assets/lib/workflows";
import BacktestEditor from "@/components/editor/BacktestEditor";
import BacktestReport from "@/components/report/BacktestReport";
import RequestBodyDialog from "@/components/research/RequestBodyDialog";
import SaveVersionDialog from "@/components/research/SaveVersionDialog";
import VersionCompareDialog from "@/components/research/VersionCompareDialog";
import VersionNavigator from "@/components/research/VersionNavigator";
import TaskLogModal from "@/components/task/TaskLogModal";
import WorkflowRunButton from "@/components/workflow/WorkflowRunButton";
import { Button } from "@/components/ui/button";
import { defaultBacktestParameters, type BacktestParameters, type BacktestProject, type BacktestSummary, type BacktestVersion } from "@/types/backtest";
import type { DslCatalog } from "@/types/factor";
import { terminalStates } from "@/types/workflow";

export default function BacktestDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<BacktestProject | null>(null);
  const [versions, setVersions] = useState<BacktestVersion[]>([]);
  const [catalog, setCatalog] = useState<DslCatalog | null>(null);
  const [parameters, setParameters] = useState<BacktestParameters>(defaultBacktestParameters());
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [workflowState, setWorkflowState] = useState("IDLE");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [logTaskInstanceId, setLogTaskInstanceId] = useState<number | null>(null);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [editorValid, setEditorValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const currentVersion = useMemo(() => versions.find((version) => version.version === selectedVersion), [selectedVersion, versions]);
  const displayedWorkflowInstanceId = currentVersion?.workflow_instance_id ?? workflowInstanceId;
  const displayedParameters = currentVersion?.parameters ?? parameters;
  const displayedState = currentVersion ? "SUCCESS" : workflowState;
  const readOnly = currentVersion !== undefined;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
  const ready = editorValid && validBacktestContract(parameters);
  const captureSummary = useCallback((value: BacktestSummary) => setSummary(value), []);

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) { navigate("/backtest", { replace: true }); return; }
    load();
  }, [projectId]);

  useEffect(() => {
    if (!workflowInstanceId || terminalStates.has(workflowState)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const workflow = await workflowsApi.status(workflowInstanceId);
        setWorkflowState(workflow.state);
        setWorkflowError(workflow.error);
        if (terminalStates.has(workflow.state)) { setStopping(false); window.clearInterval(timer); setProject(await backtestApi.getProject(projectId)); }
      } catch (reason) { setError(errorMessage(reason)); }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [projectId, workflowInstanceId, workflowState]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextProject, nextVersions, nextCatalog] = await Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId), backtestApi.catalog()]);
      setProject(nextProject);
      setVersions(nextVersions);
      setCatalog(nextCatalog);
      setStopping(false);
      if (nextProject.draft) {
        setSelectedVersion(null);
        setParameters(nextProject.draft.parameters);
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
      } else if (nextVersions[0]) {
        setSelectedVersion(nextVersions[0].version);
        setParameters(nextVersions[0].parameters);
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function run() {
    if (!ready || running || readOnly) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setWorkflowError(null);
    setSummary(null);
    try {
      const submitted = await backtestApi.run(projectId, parameters);
      setWorkflowInstanceId(submitted.workflow_instance_id);
      setWorkflowState("SUBMITTED_SUCCESS");
      setProject(await backtestApi.getProject(projectId));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopBacktest() {
    if (!workflowInstanceId || !activeWorkflow || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await workflowsApi.stop(workflowInstanceId);
      setWorkflowState(response.workflow.state);
      setWorkflowError(response.workflow.error);
      if (terminalStates.has(response.workflow.state)) {
        setStopping(false);
        setProject(await backtestApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(errorMessage(reason));
    }
  }

  async function openTaskLog() {
    if (!displayedWorkflowInstanceId) return;
    try {
      const workflow = await workflowsApi.status(displayedWorkflowInstanceId);
      const task = workflow.tasks.find((item) => item.task_instance_id !== null);
      if (!task?.task_instance_id) throw new Error("工作流尚未创建 Task instance");
      setLogTaskInstanceId(task.task_instance_id);
      setLogsOpen(true);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function saveVersion() {
    if (!workflowInstanceId || !summary) return;
    setSubmitting(true);
    setError("");
    try {
      const saved = await backtestApi.saveVersion(projectId, workflowInstanceId, remark, summary);
      const [nextProject, nextVersions] = await Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setSelectedVersion(saved.version);
      setSaveOpen(false);
      setRemark("");
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSubmitting(false); }
  }

  function continueFromVersion() {
    if (!currentVersion) return;
    setParameters(structuredClone(currentVersion.parameters));
    setSelectedVersion(null);
    setWorkflowInstanceId(project?.draft?.workflow_instance_id ?? null);
    setWorkflowState(project?.draft?.state ?? "IDLE");
    setSummary(null);
  }

  if (loading || !project || !catalog) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><Loader2 className="animate-spin text-primary" /></div>;

  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.8fr)] xl:gap-6">
    <BacktestControls activeWorkflow={activeWorkflow} catalog={catalog} displayedParameters={displayedParameters} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} project={project} projectId={projectId} readOnly={readOnly} ready={ready} selectedVersion={selectedVersion} stopping={stopping} submitting={submitting} summary={summary} workflowState={workflowState} versions={versions} onCompare={() => setCompareOpen(true)} onContinue={continueFromVersion} onLogs={openTaskLog} onParameters={setParameters} onRun={run} onSave={() => setSaveOpen(true)} onShowParameters={() => setParametersOpen(true)} onStop={stopBacktest} onValidity={setEditorValid} onVersion={(version) => { setSelectedVersion(version); setSummary(null); }} />
    <BacktestResults annualTradingDays={displayedParameters.annual_trading_days} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} error={error} readOnly={readOnly} riskFreeRate={displayedParameters.risk_free_rate} running={running} workflowError={workflowError} onSummary={captureSummary} />
    <SaveVersionDialog latestVersion={project.latest_version} open={saveOpen} remark={remark} submitting={submitting} onClose={() => setSaveOpen(false)} onRemark={setRemark} onSave={saveVersion} />
    <VersionCompareDialog currentVersion={selectedVersion} kind="backtest" open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <RequestBodyDialog endpoint={`/api/v1/backtest/projects/${projectId}/runs`} open={parametersOpen} value={displayedParameters} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
  </div>;
}

type BacktestControlsProps = {
  activeWorkflow: boolean;
  catalog: DslCatalog;
  displayedParameters: BacktestParameters;
  displayedState: string;
  displayedWorkflowInstanceId: number | null;
  project: BacktestProject;
  projectId: number;
  readOnly: boolean;
  ready: boolean;
  selectedVersion: number | null;
  stopping: boolean;
  submitting: boolean;
  summary: BacktestSummary | null;
  workflowState: string;
  versions: BacktestVersion[];
  onContinue: () => void;
  onCompare: () => void;
  onLogs: () => void;
  onParameters: (parameters: BacktestParameters) => void;
  onRun: () => void;
  onSave: () => void;
  onShowParameters: () => void;
  onStop: () => void;
  onValidity: (valid: boolean) => void;
  onVersion: (version: number | null) => void;
};

function BacktestControls({ activeWorkflow, catalog, displayedParameters, displayedState, displayedWorkflowInstanceId, project, projectId, readOnly, ready, selectedVersion, stopping, submitting, summary, workflowState, versions, onCompare, onContinue, onLogs, onParameters, onRun, onSave, onShowParameters, onStop, onValidity, onVersion }: BacktestControlsProps) {
  return <section className="space-y-4 xl:sticky xl:top-24 xl:self-start"><div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-md border bg-card shadow-sm">
    <div className="space-y-4 px-5 pt-5"><div className="flex items-center gap-3"><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{project.title}</h1><Pencil className="size-4" /></div><p className="text-sm leading-6 text-muted-foreground">切换历史版本，或重新执行后保存为新版本。</p><VersionNavigator displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} hasDraft={Boolean(project.draft)} onCompare={selectedVersion !== null && versions.length > 1 ? onCompare : undefined} selectedVersion={selectedVersion} versions={versions} onVersion={onVersion} /></div>
    <div className="space-y-5 p-5"><BacktestEditor catalog={catalog} parameters={displayedParameters} projectId={projectId} readOnly={readOnly} onChange={onParameters} onValidityChange={onValidity} /><div className="grid grid-cols-2 gap-3">{readOnly ? <Button className="col-span-2" onClick={onContinue}><Code2 />基于此版本回测</Button> : <><WorkflowRunButton active={activeWorkflow} disabled={!ready} label="执行回测" stopping={stopping} submitting={submitting} onRun={onRun} onStop={onStop} /><Button variant="outline" disabled={!summary || workflowState !== "SUCCESS"} onClick={onSave}><Save />保存</Button></>}</div><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={onShowParameters}><Braces />展示参数</Button><Button variant="outline" disabled={!displayedWorkflowInstanceId} onClick={onLogs}><Terminal />Task 日志</Button></div></div>
  </div></section>;
}

function BacktestResults({ annualTradingDays, displayedState, displayedWorkflowInstanceId, error, onSummary, readOnly, riskFreeRate, running, workflowError }: { annualTradingDays: number; displayedState: string; displayedWorkflowInstanceId: number | null; error: string; onSummary: (summary: BacktestSummary) => void; readOnly: boolean; riskFreeRate: number; running: boolean; workflowError: string | null }) {
  const returnAction = <Button variant="outline" asChild><Link to="/backtest"><ArrowLeft />返回策略回测</Link></Button>;
  let content: ReactNode;
  if (displayedWorkflowInstanceId && displayedState === "SUCCESS") content = <BacktestReport annualTradingDays={annualTradingDays} headerEnd={returnAction} key={displayedWorkflowInstanceId} riskFreeRate={riskFreeRate} workflowInstanceId={displayedWorkflowInstanceId} onSummary={onSummary} />;
  else content = <>
    <div className="sticky top-20 z-30 flex justify-end">{returnAction}</div>
    {running ? <div className="grid min-h-80 place-items-center rounded-md border bg-card text-center shadow-sm"><div><Clock3 className="mx-auto animate-pulse text-primary" /><h3 className="mt-4 font-semibold">DolphinScheduler 正在执行回测</h3><p className="mt-2 text-sm text-muted-foreground">中间过程由 Tasks API 轮询，页面刷新后仍可恢复。</p></div></div> : null}
    {!displayedWorkflowInstanceId && !readOnly ? <div className="grid min-h-80 place-items-center rounded-md border bg-card text-center shadow-sm"><div><FileClock className="mx-auto text-muted-foreground" /><h3 className="mt-4 font-semibold">尚未运行回测</h3><p className="mt-2 text-sm text-muted-foreground">填写左侧参数，在代码弹窗中完成 DSL 与回调后执行。</p></div></div> : null}
  </>;
  return <section className="min-w-0 space-y-5">
    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-xs text-destructive">{error}</div> : null}
    {workflowError ? <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-xs text-destructive">{workflowError}</div> : null}
    {content}
  </section>;
}

function validBacktestContract(parameters: BacktestParameters) { return parameters.codes_query !== null && parameters.dataset_query.start_date.length > 0 && parameters.dataset_query.end_date.length > 0 && parameters.dataset_query.factors.length + Object.keys(parameters.dataset_query.derivatives).length > 0 && Object.keys(parameters.callbacks).length > 0; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
