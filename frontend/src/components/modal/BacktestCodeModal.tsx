import { Braces, Database, FunctionSquare, Loader2, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { validCallback } from "@/assets/lib/backtest";
import { queryApi, queryResultCodes } from "@/assets/lib/query";
import DslEditor from "@/components/editor/DslEditor";
import DolphinDbEditor from "@/components/editor/DolphinDbEditor";
import { TextField } from "@/components/field/FormFields";
import { backtestCodesDsl, backtestDatasetDsl, callbackNames, updateBacktestCodesDsl, updateBacktestDatasetDsl, type BacktestParameters, type CallbackName } from "@/types/backtest";
import type { DslCatalog, FactorQuery } from "@/types/factor";
import type { QueryProject } from "@/types/query";
import { Badge } from "@/ui/badge";
import { Dialog, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";

export type BacktestCodePanel = "callbacks" | "codes" | "dataset" | "utils";

type BacktestCodeModalProps = {
  catalog: DslCatalog;
  onChange: (parameters: BacktestParameters) => void;
  onPanelChange: (panel: BacktestCodePanel | null) => void;
  onValidityChange: (valid: boolean) => void;
  panel: BacktestCodePanel | null;
  parameters: BacktestParameters;
  projectId: number;
  readOnly: boolean;
};

export default function BacktestCodeModal({ catalog, onChange, onPanelChange, onValidityChange, panel, parameters, projectId, readOnly }: BacktestCodeModalProps) {
  const [callback, setCallback] = useState<CallbackName>("onBar");
  const [codesDslValid, setCodesDslValid] = useState(true);
  const [datasetDslValid, setDatasetDslValid] = useState(true);
  const [queryProjects, setQueryProjects] = useState<QueryProject[]>([]);
  const [queryProjectsError, setQueryProjectsError] = useState("");
  const [codesSourceId, setCodesSourceId] = useState<string>();
  const [datasetSourceId, setDatasetSourceId] = useState<string>();
  const codesDsl = backtestCodesDsl(parameters);
  const datasetDsl = backtestDatasetDsl(parameters);
  const callbacksValid = useMemo(() => callbackNames.every((name) => validCallback(name, parameters.callbacks[name])), [parameters.callbacks]);

  useEffect(() => { setCodesDslValid(true); setDatasetDslValid(true); }, [parameters.codes_query, parameters.dataset_query]);
  useEffect(() => onValidityChange(codesDslValid && datasetDslValid && callbacksValid), [callbacksValid, codesDslValid, datasetDslValid, onValidityChange]);
  useEffect(() => {
    let active = true;
    if (!readOnly) queryApi.listProjects(1, 100).then((page) => { if (active) setQueryProjects(page.items); }).catch((reason) => { if (active) setQueryProjectsError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [readOnly]);

  function updateCodesQuery(codesQuery: FactorQuery) { onChange({ ...parameters, codes_query: codesQuery }); }
  function updateDatasetQuery(datasetQuery: FactorQuery) { onChange({ ...parameters, dataset_query: datasetQuery }); }
  function updateCallback(source: string) { onChange({ ...parameters, callbacks: { ...parameters.callbacks, [callback]: source } }); }

  return <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) onPanelChange(null); }}>
    <LargeDialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:!max-w-[1080px] xl:!w-[min(1080px,calc(100vw-96px))]">
      <Tabs className="flex min-h-0 flex-1 flex-col" value={panel ?? "codes"} onValueChange={(value) => onPanelChange(value as BacktestCodePanel)}>
        <div className="px-3 pt-3 pr-10"><TabsList><TabsTrigger value="codes"><Braces />股票池查询 DSL</TabsTrigger><TabsTrigger value="dataset"><Braces />回测数据查询 DSL</TabsTrigger><TabsTrigger value="utils"><Wrench />工具函数</TabsTrigger><TabsTrigger value="callbacks"><FunctionSquare />回调函数</TabsTrigger></TabsList></div>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="codes"><div className="flex h-full min-h-0 flex-col gap-2"><QueryRange projects={queryProjects} projectsError={queryProjectsError} query={parameters.codes_query} readOnly={readOnly} sourceId={codesSourceId} onChange={updateCodesQuery} onSourceId={setCodesSourceId} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} modelPath={`factor-dsl://backtest/${projectId}/codes.json`} onChange={(nextDsl) => onChange(updateBacktestCodesDsl(parameters, nextDsl))} onValidityChange={setCodesDslValid} readOnly={readOnly} value={codesDsl} /></div></div></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="dataset"><div className="flex h-full min-h-0 flex-col gap-2"><QueryRange projects={queryProjects} projectsError={queryProjectsError} query={parameters.dataset_query} readOnly={readOnly} sourceId={datasetSourceId} onChange={updateDatasetQuery} onSourceId={setDatasetSourceId} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} modelPath={`factor-dsl://backtest/${projectId}/dataset.json`} onChange={(nextDsl) => onChange(updateBacktestDatasetDsl(parameters, nextDsl))} onValidityChange={setDatasetDslValid} readOnly={readOnly} value={datasetDsl} /></div></div></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="utils"><DolphinDbEditor modelPath={`dolphindb://backtest/${projectId}/utils.dos`} onChange={(utils) => onChange({ ...parameters, utils })} readOnly={readOnly} value={parameters.utils} /></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="callbacks">
          <div className="flex h-full min-h-0 flex-col"><div className="mb-2 flex items-end justify-between gap-2"><div className="space-y-1"><Label>生命周期回调</Label><Select value={callback} onValueChange={(value) => setCallback(value as CallbackName)}><SelectTrigger className="w-56 font-mono"><SelectValue /></SelectTrigger><SelectContent>{callbackNames.map((name) => <SelectItem className="font-mono" key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div><Badge variant={validCallback(callback, parameters.callbacks[callback]) ? "secondary" : "destructive"}>{validCallback(callback, parameters.callbacks[callback]) ? "签名正确" : "签名错误"}</Badge></div>
          <div className="min-h-0 flex-1"><DolphinDbEditor modelPath={`dolphindb://backtest/${projectId}/callbacks/${callback}.dos`} onChange={updateCallback} readOnly={readOnly} value={parameters.callbacks[callback]} /></div></div>
        </TabsContent>
      </Tabs>
    </LargeDialogContent>
  </Dialog>;
}

function QueryRange({ onChange, onSourceId, projects, projectsError, query, readOnly, sourceId }: { onChange: (query: FactorQuery) => void; onSourceId: (sourceId: string | undefined) => void; projects: QueryProject[]; projectsError: string; query: FactorQuery; readOnly: boolean; sourceId: string | undefined }) {
  return <div className="grid gap-2 sm:grid-cols-4"><TextField label="开始日期" value={query.start_date} disabled={readOnly} onChange={(startDate) => onChange({ ...query, start_date: startDate })} /><TextField label="截至日期" value={query.end_date} disabled={readOnly} onChange={(endDate) => onChange({ ...query, end_date: endDate })} /><TextField label="回溯周期" value={query.lookback} disabled={readOnly} onChange={(lookback) => onChange({ ...query, lookback })} /><QueryResultField error={projectsError} projects={projects} query={query} readOnly={readOnly} sourceId={sourceId} onChange={onChange} onSourceId={onSourceId} /></div>;
}

function QueryResultField({ error, onChange, onSourceId, projects, query, readOnly, sourceId }: { error: string; onChange: (query: FactorQuery) => void; onSourceId: (sourceId: string | undefined) => void; projects: QueryProject[]; query: FactorQuery; readOnly: boolean; sourceId: string | undefined }) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const onChangeRef = useRef(onChange);
  const queryRef = useRef(query);
  onChangeRef.current = onChange;
  queryRef.current = query;
  const sources = useMemo(() => projects.filter((project) => project.current?.state === "SUCCESS" && project.current.workflow_instance_id), [projects]);

  async function selectSource(nextSourceId: string) {
    const project = sources.find((item) => item.id === Number(nextSourceId));
    const workflowInstanceId = project?.current?.workflow_instance_id;
    if (!project || !workflowInstanceId) return;
    onSourceId(nextSourceId);
    setImporting(true);
    setImportError("");
    try { onChangeRef.current({ ...queryRef.current, codes: await queryResultCodes(workflowInstanceId) }); }
    catch (reason) { onSourceId(undefined); setImportError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setImporting(false); }
  }

  const message = importError || error;
  return <div className="field-block" title={message || undefined}><Label className={message ? "text-destructive" : undefined}>查询结果 · {query.codes.length} 个代码</Label><Select disabled={readOnly || importing || !sources.length} value={sourceId} onValueChange={selectSource}><SelectTrigger className={message ? "w-full border-destructive" : "w-full"}>{importing ? <><Loader2 className="animate-spin" />读取 Parquet</> : <><Database /><SelectValue placeholder={sources.length ? "选择查询结果" : "暂无查询结果"} /></>}</SelectTrigger><SelectContent>{sources.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>)}</SelectContent></Select></div>;
}
