import { Braces, FunctionSquare, Settings2, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { queryApi } from "@/assets/lib/query";
import { validCallback } from "@/assets/lib/backtest";
import DslEditor from "@/components/editor/DslEditor";
import DolphinDbEditor from "@/components/editor/DolphinDbEditor";
import { NumberField, SelectField, TextField } from "@/components/field/FormFields";
import QueryCodesField from "@/components/field/QueryCodesField";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { backtestCodesDsl, backtestDatasetDsl, callbackNames, updateBacktestCodesDsl, updateBacktestDatasetDsl, type BacktestParameters, type CallbackName } from "@/types/backtest";
import type { DslCatalog, FactorQuery } from "@/types/factor";
import type { QueryProject } from "@/types/query";

type CodePanel = "callbacks" | "codes" | "dataset" | "utils";

export default function BacktestEditor({ catalog, onChange, onValidityChange, parameters, projectId, readOnly = false }: { catalog: DslCatalog; onChange: (parameters: BacktestParameters) => void; onValidityChange: (valid: boolean) => void; parameters: BacktestParameters; projectId: number; readOnly?: boolean }) {
  const [codePanel, setCodePanel] = useState<CodePanel | null>(null);
  const [callback, setCallback] = useState<CallbackName>("onBar");
  const [codesDslValid, setCodesDslValid] = useState(true);
  const [datasetDslValid, setDatasetDslValid] = useState(true);
  const [queryProjects, setQueryProjects] = useState<QueryProject[]>([]);
  const [queryProjectsError, setQueryProjectsError] = useState("");
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

  function updateCallback(source: string) {
    const callbacks = { ...parameters.callbacks, [callback]: source };
    onChange({ ...parameters, callbacks });
  }

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="复权方式" value={parameters.adj ?? "none"} options={[{ label: "不复权", value: "none" }, { label: "后复权", value: "hfq" }, { label: "前复权", value: "qfq" }]} disabled={readOnly} onChange={(value) => onChange({ ...parameters, adj: value === "none" ? null : value as "hfq" | "qfq" })} />
      <NumberField label="初始资金" min={1} value={numberConfig(parameters, "cash", 1_000_000)} disabled={readOnly} onChange={(cash) => onChange(updateConfig(parameters, "cash", cash))} />
      <NumberField label="手续费率" min={0} step={0.0001} value={numberConfig(parameters, "commission", 0)} disabled={readOnly} onChange={(commission) => onChange(updateConfig(parameters, "commission", commission))} />
      <NumberField label="印花税率" min={0} step={0.0001} value={numberConfig(parameters, "tax", 0)} disabled={readOnly} onChange={(tax) => onChange(updateConfig(parameters, "tax", tax))} />
      <NumberField label="年化交易日" min={1} value={parameters.annual_trading_days} disabled={readOnly} onChange={(annualTradingDays) => onChange({ ...parameters, annual_trading_days: annualTradingDays })} />
      <NumberField label="无风险利率" min={0} step={0.001} value={parameters.risk_free_rate} disabled={readOnly} onChange={(riskFreeRate) => onChange({ ...parameters, risk_free_rate: riskFreeRate })} />
    </div>

    <div className="rounded-md border bg-muted/15 p-4">
      <div className="flex items-center gap-2"><Settings2 className="size-4" /><h3 className="text-sm font-medium">策略代码</h3></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => setCodePanel("codes")}><Braces />股票池查询</Button>
        <Button variant="outline" onClick={() => setCodePanel("dataset")}><Braces />回测数据查询</Button>
        <Button variant="outline" onClick={() => setCodePanel("utils")}><Wrench />工具函数</Button>
        <Button variant="outline" onClick={() => setCodePanel("callbacks")}><FunctionSquare />回调函数</Button>
      </div>
    </div>

    <Dialog open={codePanel !== null} onOpenChange={(open) => { if (!open) setCodePanel(null); }}>
      <LargeDialogContent className="flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12"><DialogTitle>策略代码</DialogTitle><DialogDescription className="sr-only">编辑查询 DSL 或回调函数</DialogDescription></DialogHeader>
        <Tabs className="flex min-h-0 flex-1 flex-col" value={codePanel ?? "codes"} onValueChange={(value) => setCodePanel(value as CodePanel)}>
          <div className="border-b px-5 py-3"><TabsList><TabsTrigger value="codes"><Braces />股票池查询 DSL</TabsTrigger><TabsTrigger value="dataset"><Braces />回测数据查询 DSL</TabsTrigger><TabsTrigger value="utils"><Wrench />工具函数</TabsTrigger><TabsTrigger value="callbacks"><FunctionSquare />回调函数</TabsTrigger></TabsList></div>
          <TabsContent className="min-h-0 flex-1 overflow-hidden p-5" value="codes"><div className="flex h-full min-h-0 flex-col gap-4"><QueryRange projects={queryProjects} projectsError={queryProjectsError} query={parameters.codes_query} readOnly={readOnly} onChange={updateCodesQuery} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} modelPath={`factor-dsl://backtest/${projectId}/codes.json`} onChange={(nextDsl) => onChange(updateBacktestCodesDsl(parameters, nextDsl))} onValidityChange={setCodesDslValid} readOnly={readOnly} value={codesDsl} /></div></div></TabsContent>
          <TabsContent className="min-h-0 flex-1 overflow-hidden p-5" value="dataset"><div className="flex h-full min-h-0 flex-col gap-4"><QueryRange projects={queryProjects} projectsError={queryProjectsError} query={parameters.dataset_query} readOnly={readOnly} onChange={updateDatasetQuery} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} modelPath={`factor-dsl://backtest/${projectId}/dataset.json`} onChange={(nextDsl) => onChange(updateBacktestDatasetDsl(parameters, nextDsl))} onValidityChange={setDatasetDslValid} readOnly={readOnly} value={datasetDsl} /></div></div></TabsContent>
          <TabsContent className="min-h-0 flex-1 overflow-hidden p-5" value="utils"><DolphinDbEditor modelPath={`dolphindb://backtest/${projectId}/utils.dos`} onChange={(utils) => onChange({ ...parameters, utils })} readOnly={readOnly} value={parameters.utils} /></TabsContent>
          <TabsContent className="min-h-0 flex-1 overflow-hidden p-5" value="callbacks">
            <div className="flex h-full min-h-0 flex-col"><div className="mb-3 flex items-end justify-between gap-4"><div className="space-y-2"><Label>生命周期回调</Label><Select value={callback} onValueChange={(value) => setCallback(value as CallbackName)}><SelectTrigger className="w-56 font-mono"><SelectValue /></SelectTrigger><SelectContent>{callbackNames.map((name) => <SelectItem className="font-mono" key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div><Badge variant={validCallback(callback, parameters.callbacks[callback]) ? "secondary" : "destructive"}>{validCallback(callback, parameters.callbacks[callback]) ? "签名正确" : "签名错误"}</Badge></div>
            <div className="min-h-0 flex-1"><DolphinDbEditor modelPath={`dolphindb://backtest/${projectId}/callbacks/${callback}.dos`} onChange={updateCallback} readOnly={readOnly} value={parameters.callbacks[callback]} /></div></div>
          </TabsContent>
        </Tabs>
      </LargeDialogContent>
    </Dialog>
  </div>;
}

function QueryRange({ onChange, projects, projectsError, query, readOnly }: { onChange: (query: FactorQuery) => void; projects: QueryProject[]; projectsError: string; query: FactorQuery; readOnly: boolean }) { return <div className="space-y-3 rounded-md border bg-muted/10 p-4"><div className="grid gap-3 sm:grid-cols-3"><TextField label="开始日期" value={query.start_date} disabled={readOnly} onChange={(startDate) => onChange({ ...query, start_date: startDate })} /><TextField label="结束日期" value={query.end_date} disabled={readOnly} onChange={(endDate) => onChange({ ...query, end_date: endDate })} /><TextField label="回溯周期" value={query.lookback} disabled={readOnly} onChange={(lookback) => onChange({ ...query, lookback })} /></div><QueryCodesField codes={query.codes} disabled={readOnly} projects={projects} projectsError={projectsError} onChange={(codes) => onChange({ ...query, codes })} /></div>; }
function numberConfig(parameters: BacktestParameters, name: string, fallback: number) { const value = Number(parameters.config[name]); return Number.isFinite(value) ? value : fallback; }
function updateConfig(parameters: BacktestParameters, name: string, value: number): BacktestParameters { return { ...parameters, config: { ...parameters.config, [name]: value } }; }
