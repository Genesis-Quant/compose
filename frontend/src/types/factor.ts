export type DerivativeNode = {
  type: "DIRECT" | "TS" | "CS";
  op: string;
  fields: Record<string, unknown>;
  params: Record<string, unknown>;
  on?: string | boolean | DerivativeNode | null;
};

export type DslDocument = {
  factors: string[];
  derivatives: Record<string, DerivativeNode>;
  filters: string[];
};

export type QueryParameters = {
  start_date: string;
  end_date: string;
  lookback: string;
  codes: string[];
};

export type FactorQuery = QueryParameters & DslDocument;

export type FactorAnalysisParameters = {
  codes_query: FactorQuery | null;
  dataset_query: FactorQuery;
  factor_columns: string[];
  return_columns: string[];
  n_groups: number;
  preprocess: boolean;
  market_value_column: string;
};

export type StockPoolCode = "000016.SH" | "000300.SH" | "000905.SH" | "000852.SH";
export type PriceField = "close" | "close_hfq";
export type MarketValueField = "circ_mv" | "total_mv";

export type FactorAnalysisSettings = {
  stockPool: StockPoolCode;
  priceField: PriceField;
  marketValueField: MarketValueField;
  nGroups: number;
  maxLags: number;
};

export const stockPools: { label: string; value: StockPoolCode; factor: string }[] = [
  { label: "上证 50", value: "000016.SH", factor: "weight_000016SH" },
  { label: "沪深 300", value: "000300.SH", factor: "weight_000300SH" },
  { label: "中证 500", value: "000905.SH", factor: "weight_000905SH" },
  { label: "中证 1000", value: "000852.SH", factor: "weight_000852SH" }
];

export const priceFields: { label: string; value: PriceField }[] = [
  { label: "收盘价", value: "close" },
  { label: "后复权收盘价", value: "close_hfq" }
];

export const marketValueFields: { label: string; value: MarketValueField }[] = [
  { label: "流通市值", value: "circ_mv" },
  { label: "总市值", value: "total_mv" }
];

export const analysisReturnColumns = (maxLags: number) => Array.from({ length: maxLags }, (_, lag) => `ret${lag}`);
export const analysisManagedFactors = ["circ_mv", "total_mv"];

export type FactorWorkflowSummary = {
  record_id: number;
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  parameters: FactorAnalysisParameters;
  updated_at: string;
};

export type FactorMetricSummary = {
  observations: number;
  ic_mean: number | null;
  ic_std: number | null;
  ic_ir: number | null;
  ic_positive_ratio: number | null;
  rank_ic_mean: number | null;
  rank_ic_std: number | null;
  rank_ic_ir: number | null;
  rank_ic_positive_ratio: number | null;
  long_short_cumulative_return: number | null;
  long_short_annual_return: number | null;
  long_short_annual_volatility: number | null;
  long_short_sharpe: number | null;
  long_short_max_drawdown: number | null;
};

export type FactorMetrics = Record<string, Record<string, FactorMetricSummary>>;

export type FactorProject = {
  id: number;
  title: string;
  latest_version: number | null;
  latest_metrics: FactorMetrics | null;
  draft: FactorWorkflowSummary | null;
  created_at: string;
  updated_at: string;
};

export type FactorProjectPage = {
  items: FactorProject[];
  page: number;
  page_size: number;
  total: number;
};

export type FactorWorkflowSubmitted = {
  record_id: number;
  workflow_instance_id: number;
};

export type FactorVersion = {
  id: number;
  project_id: number;
  workflow_instance_id: number;
  version: number;
  remark: string;
  parameters: FactorAnalysisParameters;
  metrics: FactorMetrics;
  created_at: string;
};

export type JsonSchema = {
  $defs?: Record<string, JsonSchema>;
  $ref?: string;
  anyOf?: JsonSchema[];
  const?: unknown;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  maximum?: number;
  minimum?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  title?: string;
  type?: string | string[];
};

export type DslOperator = {
  op: string;
  type: "DIRECT" | "TS" | "CS";
  output_kind: "BOOL" | "NUMBER" | "ANY";
  description: string;
  definition: JsonSchema;
};

export type DslCatalog = {
  factors: string[];
  operators: DslOperator[];
};

export type FactorOutput = {
  name: "processed_data" | "information_coefficient" | "group_returns";
  filename: string;
  size: number;
  modified_at: string;
};

export const stockPoolQuery = (stockPool: StockPoolCode, startDate: string, endDate: string): FactorQuery => {
  const factor = stockPools.find((item) => item.value === stockPool)?.factor ?? stockPools[1].factor;
  return {
    start_date: startDate,
    end_date: endDate,
    lookback: "P0D",
    codes: [],
    factors: [],
    derivatives: {
      stock_pool_member: {
        type: "DIRECT",
        op: "binary.gt",
        fields: { left: factor, right: 0 },
        params: {}
      }
    },
    filters: ["stock_pool_member"]
  };
};

export const stockPoolCode = (parameters: FactorAnalysisParameters): StockPoolCode => {
  const member = parameters.codes_query?.derivatives.stock_pool_member ?? parameters.dataset_query.derivatives.stock_pool_member;
  const factor = member?.fields.left;
  return stockPools.find((item) => item.factor === factor)?.value ?? "000300.SH";
};

export const analysisSettings = (parameters: FactorAnalysisParameters): FactorAnalysisSettings => ({
  stockPool: stockPoolCode(parameters),
  priceField: returnPriceField(parameters),
  marketValueField: parameters.market_value_column === "total_mv" ? "total_mv" : "circ_mv",
  nGroups: parameters.n_groups,
  maxLags: Math.max(1, parameters.return_columns.filter((column) => /^ret\d+$/.test(column)).length || 10)
});

export const analysisDsl = (parameters: FactorAnalysisParameters): DslDocument => ({
  factors: parameters.dataset_query.factors.filter((factor) => !analysisManagedFactors.includes(factor) && !stockPools.some((pool) => pool.factor === factor)),
  derivatives: Object.fromEntries(Object.entries(parameters.dataset_query.derivatives).filter(([name]) => name !== "stock_pool_member" && !/^ret\d+$/.test(name) && !parameters.return_columns.includes(name))),
  filters: parameters.dataset_query.filters.filter((filter) => filter !== "stock_pool_member")
});

export const factorQueryDsl = (parameters: FactorAnalysisParameters): DslDocument => ({
  factors: parameters.dataset_query.factors.filter((factor) => !analysisManagedFactors.includes(factor)),
  derivatives: Object.fromEntries(Object.entries(parameters.dataset_query.derivatives).filter(([name]) => !/^ret\d+$/.test(name) && !parameters.return_columns.includes(name))),
  filters: parameters.dataset_query.filters
});

export const applyAnalysisSettings = (parameters: FactorAnalysisParameters, dsl: DslDocument, settings = analysisSettings(parameters)): FactorAnalysisParameters => {
  const factor = Object.keys(dsl.derivatives).at(-1) ?? "";
  const poolFactor = stockPools.find((item) => item.value === settings.stockPool)?.factor ?? stockPools[1].factor;
  const returnColumns = analysisReturnColumns(settings.maxLags);
  const datasetQuery = {
    ...parameters.dataset_query,
    codes: [],
    factors: [...dsl.factors],
    derivatives: {
      stock_pool_member: {
        type: "DIRECT" as const,
        op: "binary.gt",
        fields: { left: poolFactor, right: 0 },
        params: {}
      },
      ...dsl.derivatives,
      ...forwardReturnDerivatives(settings.priceField, settings.maxLags)
    },
    filters: ["stock_pool_member", ...dsl.filters]
  };
  return {
    codes_query: stockPoolQuery(settings.stockPool, datasetQuery.start_date, datasetQuery.end_date),
    dataset_query: datasetQuery,
    factor_columns: factor ? [factor] : [],
    return_columns: returnColumns,
    n_groups: settings.nGroups,
    preprocess: true,
    market_value_column: settings.marketValueField
  };
};

export const defaultCodesQuery = (): FactorQuery => stockPoolQuery("000300.SH", "2020-01-01", "2026-01-01");

export const defaultAnalysisParameters = (): FactorAnalysisParameters => {
  const parameters: FactorAnalysisParameters = {
    codes_query: defaultCodesQuery(),
    dataset_query: {
      start_date: "2020-01-01",
      end_date: "2026-01-01",
      lookback: "P30D",
      codes: [],
      factors: [],
      derivatives: {
        momentum_20d: {
          type: "TS",
          op: "unary.pct_change",
          fields: { col: "close_hfq" },
          params: { periods: 20 }
        }
      },
      filters: []
    },
    factor_columns: [],
    return_columns: [],
    n_groups: 5,
    preprocess: true,
    market_value_column: "circ_mv"
  };
  return applyAnalysisSettings(parameters, analysisDsl(parameters), { stockPool: "000300.SH", priceField: "close_hfq", marketValueField: "circ_mv", nGroups: 5, maxLags: 10 });
};

function forwardReturnDerivatives(priceField: PriceField, maxLags: number): Record<string, DerivativeNode> {
  return Object.fromEntries(analysisReturnColumns(maxLags).map((name, lag) => [name, {
    type: "DIRECT",
    op: "unary.log",
    fields: {
      col: {
        type: "DIRECT",
        op: "binary.div",
        fields: { left: shift(priceField, -lag - 1), right: shift(priceField, -lag) },
        params: {}
      }
    },
    params: {}
  }]));
}

function shift(column: string, periods: number): DerivativeNode {
  return { type: "TS", op: "unary.shift", fields: { col: column }, params: { periods } };
}

function returnPriceField(parameters: FactorAnalysisParameters): PriceField {
  const returnNode = parameters.dataset_query.derivatives.ret0;
  const division = returnNode?.fields.col as DerivativeNode | undefined;
  const shiftedPrice = division?.fields.left as DerivativeNode | undefined;
  return shiftedPrice?.fields.col === "close" ? "close" : "close_hfq";
}
