import { lazy, Suspense } from "react";

import {
  analysisDsl,
  analysisSettings,
  applyAnalysisSettings,
  factorQueryDsl,
  marketValueFields,
  priceFields,
  stockPools,
  type DslCatalog,
  type DslDocument,
  type FactorAnalysisParameters,
  type FactorQuery,
  type MarketValueField,
  type PriceField,
  type StockPoolCode
} from "@/types/factor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DslEditor = lazy(() => import("@/components/editor/DslEditor"));

type FactorAnalysisEditorProps = {
  catalog: DslCatalog;
  parameters: FactorAnalysisParameters;
  projectId: number;
  readOnly?: boolean;
  onChange: (parameters: FactorAnalysisParameters) => void;
  onValidityChange: (valid: boolean) => void;
};

export default function FactorAnalysisEditor({ catalog, onChange, onValidityChange, parameters, projectId, readOnly = false }: FactorAnalysisEditorProps) {
  const dsl = analysisDsl(parameters);
  const editorDsl = factorQueryDsl(parameters);
  const settings = analysisSettings(parameters);

  function updateStockPool(stockPool: StockPoolCode) {
    onChange(applyAnalysisSettings(parameters, dsl, { ...settings, stockPool }));
  }

  function updateQuery(datasetQuery: FactorQuery) {
    onChange(applyAnalysisSettings({ ...parameters, dataset_query: datasetQuery }, dsl, settings));
  }

  function updateDsl(nextDsl: DslDocument) {
    const nextParameters = { ...parameters, dataset_query: { ...parameters.dataset_query, ...nextDsl } };
    const userDsl = analysisDsl(nextParameters);
    onChange(applyAnalysisSettings(parameters, userDsl, settings));
    onValidityChange(Object.keys(userDsl.derivatives).length > 0);
  }

  return <div className="space-y-5">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="股票池" value={settings.stockPool} options={stockPools} disabled={readOnly} onChange={(value) => updateStockPool(value as StockPoolCode)} />
        <SelectField label="价格字段" value={settings.priceField} options={priceFields} disabled={readOnly} onChange={(priceField) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, priceField: priceField as PriceField }))} />
        <SelectField label="市值字段" value={settings.marketValueField} options={marketValueFields} disabled={readOnly} onChange={(marketValueField) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, marketValueField: marketValueField as MarketValueField }))} />
        <NumberField label="分组数量" value={settings.nGroups} min={2} disabled={readOnly} onChange={(nGroups) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, nGroups }))} />
        <NumberField label="最大滞后阶数" value={settings.maxLags} min={1} max={60} disabled={readOnly} onChange={(maxLags) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, maxLags }))} />
        <TextField label="回溯周期" value={parameters.dataset_query.lookback} disabled={readOnly} onChange={(lookback) => updateQuery({ ...parameters.dataset_query, lookback })} />
        <TextField label="开始日期" value={parameters.dataset_query.start_date.replace(/-/g, ".")} disabled={readOnly} onChange={(startDate) => updateQuery({ ...parameters.dataset_query, start_date: startDate.replace(/\./g, "-") })} />
        <TextField label="结束日期" value={parameters.dataset_query.end_date.replace(/-/g, ".")} disabled={readOnly} onChange={(endDate) => updateQuery({ ...parameters.dataset_query, end_date: endDate.replace(/\./g, "-") })} />
      </div>
    </div>

    <div className="h-[420px]">
      <Suspense fallback={<div className="h-full rounded-md border bg-card" />}>
        <DslEditor
          catalog={catalog}
          modelPath={`factor-dsl://project/${projectId}/dataset.json`}
          onChange={updateDsl}
          onValidityChange={(valid) => onValidityChange(valid && Object.keys(dsl.derivatives).length > 0)}
          readOnly={readOnly}
          value={editorDsl}
        />
      </Suspense>
    </div>
  </div>;
}

function SelectField({ disabled, label, onChange, options, value }: { disabled: boolean; label: string; onChange: (value: string) => void; options: { label: string; value: string }[]; value: string }) {
  return <div className="field-block"><Label className="field-label">{label}</Label><Select disabled={disabled} value={value} onValueChange={onChange}><SelectTrigger className="research-input w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function NumberField({ disabled, label, max, min, onChange, value }: { disabled: boolean; label: string; max?: number; min: number; onChange: (value: number) => void; value: number }) {
  return <div className="field-block"><Label className="field-label">{label}</Label><Input className="research-input" disabled={disabled} max={max} min={min} type="number" value={value} onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.max(min, max === undefined ? next : Math.min(max, next))); }} /></div>;
}

function TextField({ disabled, label, onChange, type = "text", value }: { disabled?: boolean; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <div className="field-block"><Label className="field-label">{label}</Label><Input className="research-input" disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}
