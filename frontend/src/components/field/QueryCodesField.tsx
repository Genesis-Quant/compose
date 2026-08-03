import { Database, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { queryResultCodes } from "@/assets/lib/query";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import type { QueryProject } from "@/types/query";

type QueryCodesFieldProps = {
  codes: string[];
  disabled?: boolean;
  projects: QueryProject[];
  projectsError?: string;
  onChange: (codes: string[]) => void;
};

export default function QueryCodesField({ codes, disabled = false, onChange, projects, projectsError = "" }: QueryCodesFieldProps) {
  const [text, setText] = useState(() => formatCodes(codes));
  const [sourceId, setSourceId] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lastCodes = useRef(canonicalCodes(codes));
  const sources = useMemo(() => projects.filter((project) => project.current?.state === "SUCCESS" && project.current.workflow_instance_id), [projects]);

  useEffect(() => {
    const nextCodes = canonicalCodes(codes);
    if (nextCodes === lastCodes.current) return;
    lastCodes.current = nextCodes;
    setText(formatCodes(codes));
    setSourceId(undefined);
    setMessage("");
  }, [codes]);

  function updateText(value: string) {
    const nextCodes = parseCodes(value);
    setText(value);
    setSourceId(undefined);
    setMessage("");
    setError("");
    lastCodes.current = canonicalCodes(nextCodes);
    onChange(nextCodes);
  }

  async function importProject(projectId: string) {
    const project = sources.find((item) => item.id === Number(projectId));
    const workflowInstanceId = project?.current?.workflow_instance_id;
    if (!project || !workflowInstanceId) return;
    setSourceId(projectId);
    setImporting(true);
    setMessage("");
    setError("");
    try {
      const nextCodes = await queryResultCodes(workflowInstanceId);
      lastCodes.current = canonicalCodes(nextCodes);
      setText(formatCodes(nextCodes));
      setMessage(`已导入 ${nextCodes.length} 个去重代码`);
      onChange(nextCodes);
    } catch (reason) {
      setSourceId(undefined);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setImporting(false);
    }
  }

  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3"><Label>股票代码</Label><span className="text-xs text-muted-foreground">{codes.length} 个</span></div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
      <Input disabled={disabled || importing} placeholder="000001.SZ, 600000.SH" value={text} onChange={(event) => updateText(event.target.value)} />
      <Select disabled={disabled || importing || !sources.length} value={sourceId} onValueChange={importProject}>
        <SelectTrigger className="w-full">{importing ? <><Loader2 className="animate-spin" />读取 Parquet</> : <><Database /><SelectValue placeholder={sources.length ? "从查询结果导入" : "暂无查询结果"} /></>}</SelectTrigger>
        <SelectContent>{sources.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    {error || projectsError ? <p className="text-xs text-destructive">{error || projectsError}</p> : null}
  </div>;
}

function parseCodes(value: string) { return [...new Set(value.split(/[,，\s]+/).map((code) => code.trim()).filter(Boolean))]; }
function formatCodes(codes: string[]) { return codes.join(", "); }
function canonicalCodes(codes: string[]) { return JSON.stringify(codes); }
