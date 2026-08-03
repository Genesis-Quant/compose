import { BrowserDuckDb } from "@/assets/lib/duckdb";
import type { BacktestOutputName, BacktestSummary } from "@/types/backtest";

export type PortfolioPoint = { time: string; netValue: number | null; totalEquity: number | null; cash: number | null; marketValue: number | null; dailyReturn: number | null; totalReturn: number | null; totalFee: number | null; dailyFee: number | null };
export type BacktestTableName = "trade_details" | "daily_positions" | "daily_trading_statistics";
export type BacktestTablePage = { columns: string[]; rows: Record<string, unknown>[]; total: number };
export type BacktestDateRange = { start: string; end: string };
const tableSelects: Record<BacktestTableName, string> = {
  trade_details: "* REPLACE (strftime(sendTime, '%Y-%m-%d %H:%M:%S') AS sendTime, strftime(tradeTime, '%Y-%m-%d %H:%M:%S') AS tradeTime)",
  daily_positions: "* REPLACE (strftime(tradeDate, '%Y-%m-%d') AS tradeDate)",
  daily_trading_statistics: "* REPLACE (strftime(tradeDate, '%Y-%m-%d') AS tradeDate)"
};
const tableDateFields: Record<BacktestTableName, string> = { trade_details: "tradeTime", daily_positions: "tradeDate", daily_trading_statistics: "tradeDate" };

export class BacktestAnalytics {
  private constructor(private readonly database: BrowserDuckDb, private readonly files: Record<BacktestOutputName, string>, private readonly registered: Set<BacktestOutputName>) {}

  static async create(workflowInstanceId: number, buffers: Pick<Record<BacktestOutputName, ArrayBuffer>, "daily_portfolios" | "return_summary">) {
    const names: BacktestOutputName[] = ["trade_details", "daily_positions", "daily_portfolios", "return_summary", "daily_trading_statistics", "engine_stat"];
    const files = Object.fromEntries(names.map((name) => [name, `backtest-${workflowInstanceId}-${name}.parquet`])) as Record<BacktestOutputName, string>;
    const initialFiles = Object.fromEntries(Object.entries(buffers).map(([name, buffer]) => [files[name as BacktestOutputName], buffer]));
    return new BacktestAnalytics(await BrowserDuckDb.create(initialFiles), files, new Set(Object.keys(buffers) as BacktestOutputName[]));
  }

  isRegistered(name: BacktestOutputName) {
    return this.registered.has(name);
  }

  async register(name: BacktestOutputName, buffer: ArrayBuffer) {
    if (this.registered.has(name)) return;
    await this.database.register(this.files[name], buffer);
    this.registered.add(name);
  }

  async summary(): Promise<BacktestSummary> {
    const row = (await this.database.rows(`SELECT * FROM read_parquet(${literal(this.files.return_summary)}) LIMIT 1`))[0] ?? {};
    return Object.fromEntries(Object.entries(row).map(([name, value]) => [name, numberValue(value)]));
  }

  async portfolios(): Promise<PortfolioPoint[]> {
    const rows = await this.database.rows(`
      SELECT tradeDate, netValue, totalEquity, cash, totalMarketValue, ratio, totalReturn, totalFee,
        totalFee - coalesce(lag(totalFee) OVER (ORDER BY tradeDate), 0) AS dailyFee
      FROM read_parquet(${literal(this.files.daily_portfolios)}) ORDER BY tradeDate
    `);
    return rows.map((row) => ({ time: dateValue(row.tradeDate), netValue: numberValue(row.netValue), totalEquity: numberValue(row.totalEquity), cash: numberValue(row.cash), marketValue: numberValue(row.totalMarketValue), dailyReturn: numberValue(row.ratio), totalReturn: numberValue(row.totalReturn), totalFee: numberValue(row.totalFee), dailyFee: numberValue(row.dailyFee) }));
  }

  async tablePage(name: BacktestTableName, page: number, pageSize: number, range: BacktestDateRange): Promise<BacktestTablePage> {
    if (!this.registered.has(name)) throw new Error(`回测结果尚未加载: ${name}`);
    const file = this.files[name];
    const filter = `WHERE CAST(${tableDateFields[name]} AS DATE) BETWEEN DATE ${literal(range.start)} AND DATE ${literal(range.end)}`;
    const totalRow = (await this.database.rows(`SELECT count(*) AS total FROM read_parquet(${literal(file)}) ${filter}`))[0] ?? {};
    const rows = await this.database.rows(`SELECT ${tableSelects[name]} FROM read_parquet(${literal(file)}) ${filter} LIMIT ${Math.trunc(pageSize)} OFFSET ${Math.trunc((page - 1) * pageSize)}`);
    return { columns: rows[0] ? Object.keys(rows[0]) : [], rows, total: Math.max(0, Math.trunc(numberValue(totalRow.total) ?? 0)) };
  }

  close() {
    return this.database.close();
  }
}

function literal(value: string) { return `'${value.replace(/'/g, "''")}'`; }
function numberValue(value: unknown) { if (value === null || value === undefined) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function dateValue(value: unknown) { if (value instanceof Date) return value.toISOString().slice(0, 10); if (typeof value === "number" || typeof value === "bigint") { const number = Number(value); const date = new Date(number > 10_000_000_000_000 ? number / 1000 : number); if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10); } return String(value ?? "").slice(0, 10); }
