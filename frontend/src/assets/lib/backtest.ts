import { client } from "@/assets/lib/request";
import type { DslCatalog } from "@/types/factor";
import type { BacktestOutput, BacktestOutputName, BacktestParameters, BacktestProject, BacktestProjectPage, BacktestRunSubmitted, BacktestSummary, BacktestVersion } from "@/types/backtest";

export const backtestApi = {
  listProjects: (page = 1, pageSize = 20) => client.get<BacktestProjectPage>("/backtest/projects", { params: { page, page_size: pageSize } }),
  createProject: (title: string) => client.post<BacktestProject>("/backtest/projects", { title }),
  getProject: (projectId: number) => client.get<BacktestProject>(`/backtest/projects/${projectId}`),
  updateProject: (projectId: number, title: string) => client.patch<BacktestProject>(`/backtest/projects/${projectId}`, { title }),
  deleteProject: (projectId: number) => client.delete<{ id: number }>(`/backtest/projects/${projectId}`),
  run: (projectId: number, parameters: BacktestParameters) => client.post<BacktestRunSubmitted>(`/backtest/projects/${projectId}/runs`, parameters, { timeout: 30000 }),
  listVersions: (projectId: number) => client.get<BacktestVersion[]>(`/backtest/projects/${projectId}/versions`),
  getVersion: (projectId: number, version: number) => client.get<BacktestVersion>(`/backtest/projects/${projectId}/versions/${version}`),
  saveVersion: (projectId: number, taskId: number, remark: string, summary: BacktestSummary) => client.post<BacktestVersion>(`/backtest/projects/${projectId}/versions`, { task_id: taskId, remark, summary }),
  catalog: () => client.get<DslCatalog>("/backtest/dsl/catalog", { timeout: 30000 }),
  outputs: (taskId: number) => client.get<BacktestOutput[]>(`/backtest/tasks/${taskId}/outputs`),
  output: (taskId: number, name: BacktestOutputName) => client.getBinary(`/backtest/tasks/${taskId}/outputs/${name}`)
};
