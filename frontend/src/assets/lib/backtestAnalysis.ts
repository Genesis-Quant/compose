import { BrowserDuckDb } from "@/assets/lib/duckdb";
import { backtestTableConfigs } from "@/assets/lib/backtestTable";
import type { ParquetColumnFilterState, ParquetTableQuery } from "@/types/table";

export type PortfolioPoint = { time: string; netValue: number | null; totalEquity: number | null; cash: number | null; marketValue: number | null; dailyReturn: number | null; totalReturn: number | null; totalFee: number | null; dailyFee: number | null };
export type BacktestTableName = "trade_details" | "daily_positions" | "daily_trading_statistics";
type BacktestAnalyticsOutputName = BacktestTableName | "daily_portfolios";
export type BacktestTablePage = { columns: string[]; rows: Record<string, unknown>[]; total: number };
export type BacktestDateRange = { start: string; end: string };
const tableSelects: Record<BacktestTableName, string> = {
  trade_details: "* REPLACE (strftime(sendTime, '%Y-%m-%d %H:%M:%S') AS sendTime, strftime(tradeTime, '%Y-%m-%d %H:%M:%S') AS tradeTime)",
  daily_positions: "* REPLACE (strftime(tradeDate, '%Y-%m-%d') AS tradeDate)",
  daily_trading_statistics: "* REPLACE (strftime(tradeDate, '%Y-%m-%d') AS tradeDate)"
};
export const backtestTableTimeColumns: Record<BacktestTableName, string> = { trade_details: "tradeTime", daily_positions: "tradeDate", daily_trading_statistics: "tradeDate" };

export class BacktestAnalytics {
  private constructor(private readonly database: BrowserDuckDb, private readonly files: Record<BacktestAnalyticsOutputName, string>, private readonly registered: Set<BacktestAnalyticsOutputName>) {}

  static async create(workflowInstanceId: number, dailyPortfolios: ArrayBuffer) {
    const names: BacktestAnalyticsOutputName[] = ["trade_details", "daily_positions", "daily_portfolios", "daily_trading_statistics"];
    const files = Object.fromEntries(names.map((name) => [name, `backtest-${workflowInstanceId}-${name}.parquet`])) as Record<BacktestAnalyticsOutputName, string>;
    return new BacktestAnalytics(await BrowserDuckDb.create({ [files.daily_portfolios]: dailyPortfolios }), files, new Set<BacktestAnalyticsOutputName>(["daily_portfolios"]));
  }

  isRegistered(name: BacktestTableName) {
    return this.registered.has(name);
  }

  async register(name: BacktestTableName, buffer: ArrayBuffer) {
    if (this.registered.has(name)) return;
    await this.database.register(this.files[name], buffer);
    this.registered.add(name);
  }

  async portfolios(): Promise<PortfolioPoint[]> {
    const rows = await this.database.rows(`
      SELECT tradeDate, netValue, totalEquity, cash, totalMarketValue, ratio, totalReturn, totalFee,
        totalFee - coalesce(lag(totalFee) OVER (ORDER BY tradeDate), 0) AS dailyFee
      FROM read_parquet(${literal(this.files.daily_portfolios)}) ORDER BY tradeDate
    `);
    return rows.map((row) => ({ time: dateValue(row.tradeDate), netValue: numberValue(row.netValue), totalEquity: numberValue(row.totalEquity), cash: numberValue(row.cash), marketValue: numberValue(row.totalMarketValue), dailyReturn: numberValue(row.ratio), totalReturn: numberValue(row.totalReturn), totalFee: numberValue(row.totalFee), dailyFee: numberValue(row.dailyFee) }));
  }

  async tablePage(name: BacktestTableName, page: number, pageSize: number, range: BacktestDateRange, query: ParquetTableQuery = { filters: [], sorting: [] }): Promise<BacktestTablePage> {
    if (!this.registered.has(name)) throw new Error(`回测结果尚未加载: ${name}`);
    const file = this.files[name];
    const safePage = Math.max(1, Math.trunc(page));
    const safePageSize = Math.min(500, Math.max(1, Math.trunc(pageSize)));
    const where = tableWhere(name, range, query.filters);
    const orderBy = tableOrderBy(name, query);
    const totalRow = (await this.database.rows(`SELECT count(*) AS total FROM read_parquet(${literal(file)}) ${where}`))[0] ?? {};
    const rows = await this.database.rows(`SELECT ${tableSelects[name]} FROM read_parquet(${literal(file)}) ${where} ${orderBy} LIMIT ${safePageSize} OFFSET ${(safePage - 1) * safePageSize}`);
    return { columns: Object.keys(backtestTableConfigs[name]), rows, total: Math.max(0, Math.trunc(numberValue(totalRow.total) ?? 0)) };
  }

  close() {
    return this.database.close();
  }
}

function literal(value: string) { return `'${value.replace(/'/g, "''")}'`; }
function identifier(value: string) { return `"${value.replace(/"/g, "\"\"")}"`; }
function numberValue(value: unknown) { if (value === null || value === undefined) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function dateValue(value: unknown) { if (value instanceof Date) return value.toISOString().slice(0, 10); if (typeof value === "number" || typeof value === "bigint") { const number = Number(value); const date = new Date(number > 10_000_000_000_000 ? number / 1000 : number); if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10); } return String(value ?? "").slice(0, 10); }

function tableWhere(name: BacktestTableName, range: BacktestDateRange, filters: ParquetColumnFilterState[]) {
  const predicates = [`CAST(${identifier(backtestTableTimeColumns[name])} AS DATE) BETWEEN DATE ${literal(range.start)} AND DATE ${literal(range.end)}`];
  filters.forEach((filter) => {
    const config = backtestTableConfigs[name][filter.id];
    if (!config?.filter) return;
    if (config.filter === "text") predicates.push(`contains(lower(CAST(${identifier(filter.id)} AS VARCHAR)), lower(${literal(String(filter.value))}))`);
    else if (config.filter === "enum" && config.enum?.[String(filter.value)]) predicates.push(`CAST(${identifier(filter.id)} AS VARCHAR) = ${literal(String(filter.value))}`);
  });
  return `WHERE ${predicates.join(" AND ")}`;
}

function tableOrderBy(name: BacktestTableName, query: ParquetTableQuery) {
  const sorts = query.sorting.flatMap((sort) => backtestTableConfigs[name][sort.id]?.sortable ? [`${identifier(sort.id)} ${sort.desc ? "DESC" : "ASC"} NULLS LAST`] : []).slice(0, 3);
  if (!sorts.length) sorts.push(`${identifier(backtestTableTimeColumns[name])} ASC NULLS LAST`);
  return `ORDER BY ${sorts.join(", ")}`;
}
