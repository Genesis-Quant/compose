import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { terminalStates } from "@/types/task";

export default function TaskStateBadge({ state }: { state: string }) {
  const tone = state === "SUCCESS" || state === "FORCED_SUCCESS" ? "green" : terminalStates.has(state) ? "red" : state === "IDLE" || state === "LOADING" ? "neutral" : "amber";
  return <StatusBadge className="gap-1.5 font-mono" tone={tone}>{!terminalStates.has(state) && state !== "IDLE" && state !== "LOADING" ? <Loader2 className="animate-spin" /> : null}{state}</StatusBadge>;
}
