export type AdminWorkflow = {
  name: string;
  code: number;
  version: number;
  release_state: string;
  execution_type: string | null;
  updated_at: string | null;
};

export type AdminTaskGroup = {
  id: number;
  name: string;
  group_size: number;
  use_size: number;
  status: string;
  description: string;
};

export type AdminWorker = {
  id: number;
  host: string;
  port: number;
  status: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  thread_pool_usage: number | null;
  last_heartbeat_at: string | null;
};

export type AdminProcessInstance = {
  id: number;
  name: string;
  workflow_code: number;
  state: string;
  worker_group: string;
  started_at: string | null;
  finished_at: string | null;
  duration: string | null;
};

export type AdminOverview = {
  users: { total: number; administrators: number };
  workflow_instances: { total: number; active: number; success: number; failure: number };
  scheduler: {
    available: boolean;
    error: string | null;
    project_name: string;
    project_code: number | null;
    workflows: AdminWorkflow[];
    task_groups: AdminTaskGroup[];
    worker_groups: string[];
    workers: AdminWorker[];
    recent_instances: AdminProcessInstance[];
  };
};

export type AdminUserList = { items: ArenaUser[] };

export type AdminActionResponse = {
  message: string;
  result: unknown;
};

export type IncrementalUpdateRun = {
  message: string;
  job_id: string;
  record_id: number;
  workflow_instance_id: number;
  project_code: number;
  workflow_definition_code: number;
  scheduler_submission: unknown;
};
