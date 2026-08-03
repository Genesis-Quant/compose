import type { DslCatalog, DslDocument, FactorQuery } from "@/types/factor";

export type QueryTaskSummary = {
  record_id: number;
  task_id: number | null;
  state: string;
  error: string | null;
  parameters: FactorQuery;
  updated_at: string;
};

export type QueryProject = {
  id: number;
  title: string;
  current: QueryTaskSummary | null;
  created_at: string;
  updated_at: string;
};

export type QueryProjectPage = {
  items: QueryProject[];
  page: number;
  page_size: number;
  total: number;
  limit: number;
};

export type QueryProjectSubmitted = { record_id: number; task_id: number; reused: boolean };
export type QueryOutput = { name: "source_data" | "computed_data" | "filtered_data" | "data"; filename: string; size: number; modified_at: string };
export type QueryCatalog = DslCatalog;

export function defaultQueryParameters(): FactorQuery {
  return {
    start_date: "2020-01-01",
    end_date: "2026-01-01",
    lookback: "P0D",
    codes: [],
    factors: ["close", "vol"],
    derivatives: {},
    filters: []
  };
}

export function queryDsl(query: FactorQuery): DslDocument {
  return { factors: query.factors, derivatives: query.derivatives, filters: query.filters };
}

export function applyQueryDsl(query: FactorQuery, dsl: DslDocument): FactorQuery {
  return { ...query, ...dsl };
}
