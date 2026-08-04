import { Clock3, Database, FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrowserDuckDb } from "@/assets/lib/duckdb";
import { queryApi } from "@/assets/lib/query";
import { errorMessage } from "@/assets/lib/utils";
import DateRangeBar from "@/components/bar/DateRangeBar";
import EmptyStatePanel from "@/components/panel/EmptyStatePanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import ParquetDataTable from "@/components/table/ParquetDataTable";
import { useAppStore } from "@/store";
import { emptyParquetTableQuery, type ParquetTableQuery } from "@/types/table";

type QueryDatePoint = { time: string; value: number | null };

type QueryResultPanelProps = {
  error: string;
  running: boolean;
  state: string;
  timeColumn?: string;
  workflowError: string | null;
  workflowInstanceId: number | null;
};

export default function QueryResultPanel({ error, running, state, timeColumn = "time", workflowError, workflowInstanceId }: QueryResultPanelProps) {
  const theme = useAppStore((store) => store.theme);
  const database = useRef<BrowserDuckDb | null>(null);
  const request = useRef(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tableQuery, setTableQuery] = useState<ParquetTableQuery>(emptyParquetTableQuery);
  const [points, setPoints] = useState<QueryDatePoint[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [loadedWorkflow, setLoadedWorkflow] = useState<number | null>(null);

  useEffect(() => {
    if (running || state !== "SUCCESS" || !workflowInstanceId) {
      if (running || !workflowInstanceId) resetPreview();
      return;
    }
    if (loadedWorkflow !== workflowInstanceId) loadPreview(workflowInstanceId);
  }, [loadedWorkflow, running, state, workflowInstanceId]);

  useEffect(() => {
    const activeDatabase = database.current;
    if (!activeDatabase || !startDate || !endDate || loadedWorkflow !== workflowInstanceId) return undefined;
    let cancelled = false;
    const activeRequest = ++request.current;
    const where = tableWhere(columns, timeColumn, startDate, endDate, tableQuery);
    const orderBy = tableOrderBy(columns, timeColumn, tableQuery);
    setLoading(true);
    setPreviewError("");
    Promise.all([
      activeDatabase.rows(`SELECT count(*) AS total FROM read_parquet('current.parquet') ${where}`),
      activeDatabase.rows(`SELECT * FROM read_parquet('current.parquet') ${where} ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`)
    ])
      .then(([countRows, nextRows]) => {
        if (cancelled || request.current !== activeRequest) return;
        setTotal(Math.max(0, Math.trunc(numberValue(countRows[0]?.total) ?? 0)));
        setRows(nextRows);
      })
      .catch((reason) => { if (!cancelled && request.current === activeRequest) setPreviewError(errorMessage(reason)); })
      .finally(() => { if (!cancelled && request.current === activeRequest) setLoading(false); });
    return () => { cancelled = true; };
  }, [columns, endDate, loadedWorkflow, page, pageSize, startDate, tableQuery, timeColumn, workflowInstanceId]);

  useEffect(() => () => {
    request.current += 1;
    const activeDatabase = database.current;
    database.current = null;
    activeDatabase?.close().catch(() => undefined);
  }, []);

  async function loadPreview(nextWorkflowInstanceId: number) {
    setLoading(true);
    setPreviewError("");
    const activeRequest = ++request.current;
    const previous = database.current;
    database.current = null;
    if (previous) await previous.close().catch(() => undefined);
    let nextDatabase: BrowserDuckDb | null = null;
    try {
      const buffer = await queryApi.output(nextWorkflowInstanceId, "data");
      nextDatabase = await BrowserDuckDb.create({ "current.parquet": buffer });
      const column = identifier(timeColumn);
      const [pointRows, schemaRows] = await Promise.all([
        nextDatabase.rows(`SELECT strftime(CAST(${column} AS DATE), '%Y-%m-%d') AS time, count(*) AS value FROM read_parquet('current.parquet') GROUP BY 1 ORDER BY 1`),
        nextDatabase.rows("DESCRIBE SELECT * FROM read_parquet('current.parquet')")
      ]);
      if (request.current !== activeRequest) { await nextDatabase.close(); return; }
      const nextPoints = pointRows.map((row) => ({ time: String(row.time), value: numberValue(row.value) }));
      database.current = nextDatabase;
      nextDatabase = null;
      setColumns(schemaRows.map((row) => String(row.column_name)));
      setPoints(nextPoints);
      setStartDate(nextPoints[0]?.time ?? "");
      setEndDate(nextPoints.at(-1)?.time ?? "");
      setPage(1);
      setTableQuery(emptyParquetTableQuery());
      setLoadedWorkflow(nextWorkflowInstanceId);
      if (!nextPoints.length) setLoading(false);
    } catch (reason) {
      if (request.current === activeRequest) { setPreviewError(errorMessage(reason)); setLoading(false); }
    } finally { if (nextDatabase) await nextDatabase.close().catch(() => undefined); }
  }

  function resetPreview() {
    if (!database.current && !rows.length && !points.length && loadedWorkflow === null) return;
    request.current += 1;
    const activeDatabase = database.current;
    database.current = null;
    activeDatabase?.close().catch(() => undefined);
    setRows([]);
    setColumns([]);
    setTotal(0);
    setPage(1);
    setTableQuery(emptyParquetTableQuery());
    setPoints([]);
    setStartDate("");
    setEndDate("");
    setLoading(false);
    setPreviewError("");
    setLoadedWorkflow(null);
  }

  const minimumDate = points[0]?.time ?? "";
  const maximumDate = points.at(-1)?.time ?? "";
  return <section className="min-w-0"><h2 className="mb-5 text-lg font-semibold">查询结果</h2>{error ? <ErrorPanel className="mb-5" message={error} /> : null}{workflowError ? <ErrorPanel className="mb-5" message={workflowError} /> : null}<div className="space-y-4">{points.length ? <DateRangeBar endDate={endDate} label="结果区间" maximumDate={maximumDate} minimumDate={minimumDate} points={points} startDate={startDate} theme={theme} onEndDate={(value) => { setPage(1); setEndDate(value < startDate ? startDate : value); }} onReset={() => { setPage(1); setStartDate(minimumDate); setEndDate(maximumDate); }} onStartDate={(value) => { setPage(1); setStartDate(value > endDate ? endDate : value); }} /> : null}<ResultContent columns={columns} error={previewError} loading={loading} page={page} pageSize={pageSize} query={tableQuery} rows={rows} running={running} state={state} timeColumn={timeColumn} total={total} onPage={setPage} onPageSize={(value) => { setPage(1); setPageSize(value); }} onQuery={(value) => { setPage(1); setTableQuery(value); }} /></div></section>;
}

function ResultContent({ columns, error, loading, onPage, onPageSize, onQuery, page, pageSize, query, rows, running, state, timeColumn, total }: { columns: string[]; error: string; loading: boolean; onPage: (page: number) => void; onPageSize: (pageSize: number) => void; onQuery: (query: ParquetTableQuery) => void; page: number; pageSize: number; query: ParquetTableQuery; rows: Record<string, unknown>[]; running: boolean; state: string; timeColumn: string; total: number }) {
  if (error) return <ErrorPanel message={error} />;
  if (loading && !columns.length) return <EmptyStatePanel description="DuckDB 正在读取查询结果。" icon={Loader2} iconClassName="animate-spin" title="正在读取 Parquet" />;
  if (running) return <EmptyStatePanel description="任务完成后自动读取结果。" icon={Clock3} iconClassName="animate-pulse" title="查询正在运行" />;
  if (state === "SUCCESS") return total || rows.length ? <ParquetDataTable columns={columns} loading={loading} pagination={{ page, pageSize, total, onPageChange: onPage, onPageSizeChange: onPageSize }} query={{ value: query, onChange: onQuery }} rows={rows} timeColumn={timeColumn} /> : <EmptyStatePanel description="当前条件下没有数据行。" icon={Database} title="查询结果为空" />;
  return <EmptyStatePanel description="完成 DSL 后执行查询。" icon={FileQuestion} title="尚未执行查询" />;
}

function identifier(value: string) { return `"${value.replace(/"/g, "\"\"")}"`; }
function numberValue(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function sqlLiteral(value: string) { return `'${value.replace(/'/g, "''")}'`; }

function tableWhere(columns: string[], timeColumn: string, startDate: string, endDate: string, query: ParquetTableQuery) {
  const available = new Set(columns);
  const predicates = [`CAST(${identifier(timeColumn)} AS DATE) BETWEEN DATE ${sqlLiteral(startDate)} AND DATE ${sqlLiteral(endDate)}`];
  query.filters.forEach((filter) => {
    if (!available.has(filter.id)) return;
    if (typeof filter.value === "string") predicates.push(`contains(lower(CAST(${identifier(filter.id)} AS VARCHAR)), lower(${sqlLiteral(filter.value)}))`);
    else predicates.push(`${identifier(filter.id)} = ${sqlLiteral(String(filter.value))}`);
  });
  return `WHERE ${predicates.join(" AND ")}`;
}

function tableOrderBy(columns: string[], timeColumn: string, query: ParquetTableQuery) {
  const available = new Set(columns);
  const sorts = query.sorting.flatMap((sort) => available.has(sort.id) ? [`${identifier(sort.id)} ${sort.desc ? "DESC" : "ASC"} NULLS LAST`] : []).slice(0, 3);
  if (!sorts.length) sorts.push(`${identifier(timeColumn)} ASC NULLS LAST`);
  return `ORDER BY ${sorts.join(", ")}`;
}
