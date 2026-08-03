import { client } from "@/assets/lib/request";
import type { DslCatalog } from "@/types/factor";
import { callbackParameters, type BacktestOutput, type BacktestOutputName, type BacktestParameters, type BacktestProject, type BacktestProjectPage, type BacktestSummary, type BacktestVersion, type BacktestWorkflowSubmitted, type CallbackName } from "@/types/backtest";

export function validCallback(callback: CallbackName, source: string) {
  const signature = callbackParameters[callback].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  return new RegExp(`\\bdef\\s+${callback}\\s*\\(\\s*${signature}\\s*\\)\\s*\\{`).test(source);
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
