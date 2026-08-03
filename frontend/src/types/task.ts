export type TaskApplication = "query" | "factor" | "backtest" | "incremental";

export type WorkflowTaskInformation = {
  task_code: number | null;
  task_id: number | null;
  name: string;
  task_type: string | null;
  state: string;
};

export type TaskInformation = {
  application: TaskApplication;
  record_id: number;
  user_id: number;
  task_id: number | null;
  task_id_history: number[];
  process_instance_id: number | null;
  process_instance_history: number[];
  workflow_tasks: WorkflowTaskInformation[];
  project_code: number | null;
  process_definition_code: number | null;
  workflow_name: string | null;
  process_state: string | null;
  state: string;
  error: string | null;
  host: string | null;
  retry_times: number | null;
  max_retry_times: number | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  state_history: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

export type TaskStatus = TaskInformation & {
  requested_task_id: number;
};

export type TaskActionResponse = {
  action: "stop";
  scheduler_submission: unknown;
  task: TaskStatus;
};

export type TaskListItem = TaskInformation & {
  owner_username: string;
  payload: Record<string, unknown>;
  requested_outputs: string[];
};

export type TaskListPage = {
  items: TaskListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type TaskListFilters = {
  page: number;
  page_size: number;
  application?: TaskApplication;
  state?: "active" | "success" | "failure";
};

export type TaskLog = {
  task_id: number;
  state: string;
  skip_line_num: number;
  returned_lines: number;
  next_line_num: number;
  has_more: boolean;
  message: string;
};

export const terminalStates = new Set(["SUCCESS", "FAILURE", "STOP", "KILL", "FORCED_SUCCESS", "SUBMIT_FAILED"]);
