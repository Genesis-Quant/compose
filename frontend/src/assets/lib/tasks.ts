import { client } from "@/assets/lib/request";
import type { TaskActionResponse, TaskListFilters, TaskListPage, TaskLog, TaskStatus } from "@/types/task";

export const tasksApi = {
  list: (filters: TaskListFilters) => client.get<TaskListPage>("/tasks", { params: filters }),
  status: (taskId: number) => client.get<TaskStatus>(`/tasks/${taskId}`),
  stop: (taskId: number) => client.post<TaskActionResponse>(`/tasks/${taskId}/actions/stop`, null),
  logs: (taskId: number, skipLineNum = 0, limit = 500) => client.get<TaskLog>(`/tasks/${taskId}/logs`, { params: { skip_line_num: skipLineNum, limit } })
};
