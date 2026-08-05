import { client } from "@/assets/lib/request";
import type { DslCatalog } from "@/types/factor";
import { callbackParameters, type BacktestOutput, type BacktestOutputName, type BacktestParameters, type BacktestProject, type BacktestProjectPage, type BacktestSummary, type BacktestVersion, type BacktestWorkflowSubmitted, type CallbackName } from "@/types/backtest";

export function validCallback(callback: CallbackName, source: string) {
  const match = new RegExp(`\\bdef\\s+${callback}\\s*\\(([^)]*)\\)\\s*\\{`).exec(source);
  if (!match) return false;

  const parameters = match[1].trim()
    ? match[1].split(",").map((parameter) => parameter.trim())
    : [];
  const expectedCount = callbackParameters[callback].split(",").length;
  if (parameters.length !== expectedCount) return false;

  const names: string[] = [];
  for (const parameter of parameters) {
    const parameterMatch = /^(?:(mutable)\s+)?([A-Za-z][A-Za-z0-9_]*)$/.exec(parameter);
    if (!parameterMatch) return false;
    names.push(parameterMatch[2]);
  }

  return parameters[0]?.startsWith("mutable ") === true
    && new Set(names).size === names.length;
}

export const backtestApi = {
  listProjects: (page = 1, pageSize = 20) => client.get<BacktestProjectPage>("/backtest/projects", { params: { page, page_size: pageSize } }),
  createProject: (title: string) => client.post<BacktestProject>("/backtest/projects", { title }),
  getProject: (projectId: number) => client.get<BacktestProject>(`/backtest/projects/${projectId}`),
  updateProject: (projectId: number, title: string) => client.patch<BacktestProject>(`/backtest/projects/${projectId}`, { title }),
  deleteProject: (projectId: number) => client.delete<{ id: number }>(`/backtest/projects/${projectId}`),
  run: (projectId: number, parameters: BacktestParameters) => client.post<BacktestWorkflowSubmitted>(`/backtest/projects/${projectId}/runs`, parameters, { timeout: 30000 }),
  listVersions: (projectId: number) => client.get<BacktestVersion[]>(`/backtest/projects/${projectId}/versions`),
  getVersion: (projectId: number, version: number) => client.get<BacktestVersion>(`/backtest/projects/${projectId}/versions/${version}`),
  saveVersion: (projectId: number, workflowInstanceId: number, remark: string, summary: BacktestSummary) => client.post<BacktestVersion>(`/backtest/projects/${projectId}/versions`, { workflow_instance_id: workflowInstanceId, remark, summary }),
  catalog: () => client.get<DslCatalog>("/backtest/dsl/catalog", { timeout: 30000 }),
  outputs: (workflowInstanceId: number) => client.get<BacktestOutput[]>(`/backtest/workflows/${workflowInstanceId}/outputs`),
  output: (workflowInstanceId: number, name: BacktestOutputName) => client.getBinary(`/backtest/workflows/${workflowInstanceId}/outputs/${name}`)
};
