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

const PREVIEW_LIMIT = 200;
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
    const column = identifier(timeColumn);
    setLoading(true);
    setRows([]);
    activeDatabase.rows(`SELECT * FROM read_parquet('current.parquet') WHERE CAST(${column} AS DATE) BETWEEN DATE ${sqlLiteral(startDate)} AND DATE ${sqlLiteral(endDate)} ORDER BY ${column} LIMIT ${PREVIEW_LIMIT}`)
      .then((nextRows) => { if (!cancelled && request.current === activeRequest) setRows(nextRows); })
      .catch((reason) => { if (!cancelled && request.current === activeRequest) setPreviewError(errorMessage(reason)); })
      .finally(() => { if (!cancelled && request.current === activeRequest) setLoading(false); });
    return () => { cancelled = true; };
  }, [endDate, loadedWorkflow, startDate, timeColumn, workflowInstanceId]);

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
      const pointRows = await nextDatabase.rows(`SELECT strftime(CAST(${column} AS DATE), '%Y-%m-%d') AS time, count(*) AS value FROM read_parquet('current.parquet') GROUP BY 1 ORDER BY 1`);
      if (request.current !== activeRequest) { await nextDatabase.close(); return; }
      const nextPoints = pointRows.map((row) => ({ time: String(row.time), value: numberValue(row.value) }));
      database.current = nextDatabase;
      nextDatabase = null;
      setPoints(nextPoints);
      setStartDate(nextPoints[0]?.time ?? "");
      setEndDate(nextPoints.at(-1)?.time ?? "");
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
    setPoints([]);
    setStartDate("");
    setEndDate("");
    setLoading(false);
    setPreviewError("");
    setLoadedWorkflow(null);
  }

  const minimumDate = points[0]?.time ?? "";
  const maximumDate = points.at(-1)?.time ?? "";
  return <section className="min-w-0"><h2 className="mb-5 text-lg font-semibold">查询结果</h2>{error ? <ErrorPanel className="mb-5" message={error} /> : null}{workflowError ? <ErrorPanel className="mb-5" message={workflowError} /> : null}<div className="space-y-4">{points.length ? <DateRangeBar endDate={endDate} label="结果区间" maximumDate={maximumDate} minimumDate={minimumDate} points={points} startDate={startDate} theme={theme} onEndDate={(value) => setEndDate(value < startDate ? startDate : value)} onReset={() => { setStartDate(minimumDate); setEndDate(maximumDate); }} onStartDate={(value) => setStartDate(value > endDate ? endDate : value)} /> : null}<ResultContent error={previewError} loading={loading} rows={rows} running={running} state={state} timeColumn={timeColumn} /></div></section>;
}

function ResultContent({ error, loading, rows, running, state, timeColumn }: { error: string; loading: boolean; rows: Record<string, unknown>[]; running: boolean; state: string; timeColumn: string }) {
  if (error) return <ErrorPanel message={error} />;
  if (loading) return <EmptyStatePanel description="DuckDB 正在生成结果预览。" icon={Loader2} iconClassName="animate-spin" title="正在读取 Parquet" />;
  if (running) return <EmptyStatePanel description="任务完成后自动读取结果。" icon={Clock3} iconClassName="animate-pulse" title="查询正在运行" />;
  if (state === "SUCCESS") return rows.length ? <ParquetDataTable rows={rows} timeColumn={timeColumn} /> : <EmptyStatePanel description="当前 Parquet 没有数据行。" icon={Database} title="查询结果为空" />;
  return <EmptyStatePanel description="完成 DSL 后执行查询。" icon={FileQuestion} title="尚未执行查询" />;
}

function identifier(value: string) { return `"${value.replace(/"/g, "\"\"")}"`; }
function numberValue(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function sqlLiteral(value: string) { return `'${value.replace(/'/g, "''")}'`; }
