import { client } from "@/assets/lib/request";
import type {
  AdminActionResponse,
  AdminOverview,
  AdminUserList,
  IncrementalUpdateRun
} from "@/types/admin";

export const adminApi = {
  overview: () => client.get<AdminOverview>("/admin/overview"),
  users: () => client.get<AdminUserList>("/admin/users"),
  updateUser: (userId: number, isAdmin: boolean) =>
    client.patch<ArenaUser>(`/admin/users/${userId}`, { is_admin: isAdmin }),
  ensureWorkflows: () =>
    client.post<AdminActionResponse>("/admin/workflows/ensure", null, { timeout: 120000 }),
  runIncrementalUpdate: () =>
    client.post<IncrementalUpdateRun>("/admin/incremental-update/runs", null)
};
