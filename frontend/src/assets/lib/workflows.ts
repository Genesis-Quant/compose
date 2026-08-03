import { client } from "@/assets/lib/request";
import type { WorkflowActionResponse, WorkflowInformation, WorkflowListFilters, WorkflowListPage } from "@/types/workflow";

export const workflowsApi = {
  list: (filters: WorkflowListFilters) => client.get<WorkflowListPage>("/workflows", { params: filters }),
  status: (workflowInstanceId: number) => client.get<WorkflowInformation>(`/workflows/${workflowInstanceId}`),
  stop: (workflowInstanceId: number) => client.post<WorkflowActionResponse>(`/workflows/${workflowInstanceId}/actions/stop`, null)
};
