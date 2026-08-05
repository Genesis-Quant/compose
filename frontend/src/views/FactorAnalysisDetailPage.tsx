import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import { factorApi } from "@/assets/lib/factor";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import SaveVersionDialog from "@/components/modal/SaveVersionDialog";
import VersionCompareDialog from "@/components/modal/VersionCompareDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import FactorAnalysisControlsPanel from "@/components/panel/FactorAnalysisControlsPanel";
import FactorAnalysisResultsPanel from "@/components/panel/FactorAnalysisResultsPanel";
import { analysisDsl, analysisSettings, applyAnalysisSettings, defaultAnalysisParameters, type DslCatalog, type FactorAnalysisParameters, type FactorMetrics, type FactorProject, type FactorVersion } from "@/types/factor";
import { terminalStates } from "@/types/workflow";

export default function FactorAnalysisDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<FactorProject | null>(null);
  const [versions, setVersions] = useState<FactorVersion[]>([]);
  const [catalog, setCatalog] = useState<DslCatalog | null>(null);
  const [parameters, setParameters] = useState<FactorAnalysisParameters>(defaultAnalysisParameters());
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [workflowState, setWorkflowState] = useState("IDLE");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [logTaskInstanceId, setLogTaskInstanceId] = useState<number | null>(null);
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
  const displayedWorkflowInstanceId = currentVersion?.workflow_instance_id ?? workflowInstanceId;
  const displayedParameters = useMemo(() => normalizeAnalysisParameters(currentVersion?.parameters ?? parameters), [currentVersion, parameters]);
  const resultParameters = useMemo(() => normalizeAnalysisParameters(currentVersion?.parameters ?? project?.draft?.parameters ?? parameters), [currentVersion, parameters, project?.draft?.parameters]);
  const displayedState = currentVersion ? "SUCCESS" : workflowState;
  const readOnly = currentVersion !== undefined;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
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
    if (!workflowInstanceId || terminalStates.has(workflowState)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const workflow = await workflowsApi.status(workflowInstanceId);
        setWorkflowState(workflow.state);
        setWorkflowError(workflow.error);
        if (terminalStates.has(workflow.state)) {
          setStopping(false);
          window.clearInterval(timer);
          const refreshed = await factorApi.getProject(projectId);
          setProject(refreshed);
        }
      } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [projectId, workflowInstanceId, workflowState]);

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
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
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
    setWorkflowError(null);
    try {
      const submitted = await factorApi.analyze(projectId, normalizeAnalysisParameters(parameters));
      setWorkflowInstanceId(submitted.workflow_instance_id);
      setWorkflowState("SUBMITTED_SUCCESS");
      setSelectedVersion(null);
      const refreshed = await factorApi.getProject(projectId);
      setProject(refreshed);
      if (refreshed.draft) setParameters(normalizeAnalysisParameters(refreshed.draft.parameters));
      setWorkflowState(refreshed.draft?.state ?? "SUBMITTED_SUCCESS");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopAnalysis() {
    if (!workflowInstanceId || !activeWorkflow || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await workflowsApi.stop(workflowInstanceId);
      setWorkflowState(response.workflow.state);
      setWorkflowError(response.workflow.error);
      if (terminalStates.has(response.workflow.state)) {
        setStopping(false);
        setProject(await factorApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function openTaskLog() {
    if (!displayedWorkflowInstanceId) return;
    try {
      const workflow = await workflowsApi.status(displayedWorkflowInstanceId);
      const task = workflow.tasks.find((item) => item.task_instance_id !== null) ?? workflow.tasks[0];
      setLogTaskInstanceId(task?.task_instance_id ?? null);
      setLogsOpen(true);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function saveVersion() {
    if (!workflowInstanceId || !metrics) return;
    setSubmitting(true);
    setError("");
    try {
      const saved = await factorApi.saveVersion(projectId, workflowInstanceId, remark, metrics);
      const [nextProject, nextVersions] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setSelectedVersion(saved.version);
      setSaveOpen(false);
      setRemark("");
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSubmitting(false); }
  }

  function continueFromVersion() {
    if (!currentVersion) return;
    setParameters(structuredClone(currentVersion.parameters));
    setSelectedVersion(null);
    setWorkflowInstanceId(project?.draft?.workflow_instance_id ?? null);
    setWorkflowState(project?.draft?.state ?? "IDLE");
    setMetrics(null);
  }

  if (loading || !project || !catalog) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><IconLoaderCircle className="animate-spin text-primary" width={26} height={26} /></div>;

  return <>
    <AnalysisWorkspace backTo="/factor" sidebar={<FactorAnalysisControlsPanel
      catalog={catalog}
      activeWorkflow={activeWorkflow}
      displayedParameters={displayedParameters}
      displayedState={displayedState}
      displayedWorkflowInstanceId={displayedWorkflowInstanceId}
      dslValid={analysisReady}
      metrics={metrics}
      project={project}
      readOnly={readOnly}
      stopping={stopping}
      submitting={submitting}
      selectedVersion={selectedVersion}
      workflowState={workflowState}
      versions={versions}
      projectId={projectId}
      onAnalyze={analyze}
      onCompare={() => setCompareOpen(true)}
      onContinue={continueFromVersion}
      onLogs={openTaskLog}
      onShowParameters={() => setParametersOpen(true)}
      onSave={() => setSaveOpen(true)}
      onStop={stopAnalysis}
      onParameters={setParameters}
      onValidity={setDslValid}
      onVersion={(version) => { setSelectedVersion(version); setMetrics(null); }}
    />}>
      <FactorAnalysisResultsPanel
        displayedParameters={resultParameters}
        displayedState={displayedState}
        displayedWorkflowInstanceId={displayedWorkflowInstanceId}
        error={error}
        readOnly={readOnly}
        running={running}
        workflowError={workflowError}
        onMetrics={captureMetrics}
      />
    </AnalysisWorkspace>
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
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
  </>;
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
