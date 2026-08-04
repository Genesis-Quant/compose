import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { backtestApi } from "@/assets/lib/backtest";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import SaveVersionDialog from "@/components/modal/SaveVersionDialog";
import VersionCompareDialog from "@/components/modal/VersionCompareDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import BacktestControlsPanel from "@/components/panel/BacktestControlsPanel";
import BacktestResultsPanel from "@/components/panel/BacktestResultsPanel";
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
  const resultParameters = currentVersion?.parameters ?? project?.draft?.parameters ?? parameters;
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

  return <>
    <AnalysisWorkspace backTo="/backtest" sidebar={<BacktestControlsPanel activeWorkflow={activeWorkflow} catalog={catalog} displayedParameters={displayedParameters} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} project={project} projectId={projectId} readOnly={readOnly} ready={ready} selectedVersion={selectedVersion} stopping={stopping} submitting={submitting} summary={summary} workflowState={workflowState} versions={versions} onCompare={() => setCompareOpen(true)} onContinue={continueFromVersion} onLogs={openTaskLog} onParameters={setParameters} onRun={run} onSave={() => setSaveOpen(true)} onShowParameters={() => setParametersOpen(true)} onStop={stopBacktest} onValidity={setEditorValid} onVersion={(version) => { setSelectedVersion(version); setSummary(null); }} />}>
      <BacktestResultsPanel annualTradingDays={resultParameters.annual_trading_days} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} error={error} readOnly={readOnly} riskFreeRate={resultParameters.risk_free_rate} running={running} workflowError={workflowError} onSummary={captureSummary} />
    </AnalysisWorkspace>
    <SaveVersionDialog latestVersion={project.latest_version} open={saveOpen} remark={remark} submitting={submitting} onClose={() => setSaveOpen(false)} onRemark={setRemark} onSave={saveVersion} />
    <VersionCompareDialog currentVersion={selectedVersion} kind="backtest" open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <RequestBodyDialog endpoint={`/api/v1/backtest/projects/${projectId}/runs`} open={parametersOpen} value={displayedParameters} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
  </>;
}

function validBacktestContract(parameters: BacktestParameters) { return parameters.codes_query !== null && parameters.dataset_query.start_date.length > 0 && parameters.dataset_query.end_date.length > 0 && parameters.dataset_query.factors.length + Object.keys(parameters.dataset_query.derivatives).length > 0 && Object.keys(parameters.callbacks).length > 0; }
