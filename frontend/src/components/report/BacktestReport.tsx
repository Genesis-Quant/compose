import { Loader2, TableProperties } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { backtestApi } from "@/assets/lib/backtest";
import { BacktestAnalytics, type BacktestTableName, type BacktestTablePage, type PortfolioPoint } from "@/assets/lib/backtestAnalysis";
import { quantStatsReport, type DrawdownPeriod, type QuantStatsReport } from "@/assets/lib/quantstats";
import { AppPagination } from "@/components/AppPagination";
import EChart, { chartRange, formatAxisLabel, type AxisFormat, type ChartRange } from "@/components/chart/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReportDateRangeBar from "@/components/report/ReportDateRangeBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store";
import type { BacktestSummary } from "@/types/backtest";

const tableTabs = [
  { value: "trade_details", label: "交易记录" },
  { value: "daily_positions", label: "每日持仓" },
  { value: "daily_trading_statistics", label: "交易统计" }
] as const;

const tableColumnLabels: Record<BacktestTableName, Record<string, string>> = {
  trade_details: { orderId: "订单编号", symbol: "证券代码", direction: "买卖方向", sendTime: "委托时间", orderPrice: "委托价格", orderQty: "委托数量", tradeTime: "成交时间", tradePrice: "成交价格", tradeQty: "成交数量", orderStatus: "订单状态", label: "策略标签" },
  daily_positions: { symbol: "证券代码", tradeDate: "交易日期", lastDayLongPosition: "昨日多头持仓", lastDayShortPosition: "昨日空头持仓", longPosition: "多头持仓", longPositionAvgPrice: "多头持仓均价", shortPosition: "空头持仓", shortPositionAvgPrice: "空头持仓均价", todayBuyVolume: "当日买入数量", todayBuyValue: "当日买入金额", todaySellVolume: "当日卖出数量", todaySellValue: "当日卖出金额", closePrice: "收盘价" },
  daily_trading_statistics: { symbol: "证券代码", tradeDate: "交易日期", todayBuyOpenTradeVolume: "买入开仓数量", todayBuyOpenTradeValue: "买入开仓金额", todayBuyOpenAvgPrice: "买入开仓均价", todaySellOpenTradeVolume: "卖出开仓数量", todaySellOpenTradeValue: "卖出开仓金额", todaySellOpenAvgPrice: "卖出开仓均价", todaySellCloseTradeVolume: "卖出平仓数量", todaySellCloseTradeValue: "卖出平仓金额", todaySellCloseAvgPrice: "卖出平仓均价", todayBuyCloseTradeVolume: "买入平仓数量", todayBuyCloseTradeValue: "买入平仓金额", todayBuyCloseAvgPrice: "买入平仓均价" }
};

type MetricFormat = "decimal" | "percent" | "integer" | "currency";
type Metric = { label: string; value: number | null; format?: MetricFormat };
export type BacktestChartRanges = { netValue?: ChartRange; totalEquity?: ChartRange; drawdown?: ChartRange; rollingSharpe?: ChartRange };

type BacktestReportProps = {
  activeTab?: string;
  annualTradingDays?: number;
  chartRanges?: BacktestChartRanges;
  headerEnd?: ReactNode;
  onActiveTabChange?: (value: string) => void;
  onChartRanges?: (ranges: BacktestChartRanges) => void;
  onSummary: (summary: BacktestSummary) => void;
  riskFreeRate?: number;
  showTabs?: boolean;
  workflowInstanceId: number;
};

export default function BacktestReport({ activeTab, annualTradingDays = 252, chartRanges, headerEnd, onActiveTabChange, onChartRanges, onSummary, riskFreeRate = 0, showTabs = true, workflowInstanceId }: BacktestReportProps) {
  const theme = useAppStore((state) => state.theme);
  const analytics = useRef<BacktestAnalytics | null>(null);
  const [localTab, setLocalTab] = useState("overview");
  const [backendSummary, setBackendSummary] = useState<BacktestSummary>({});
  const [portfolio, setPortfolio] = useState<PortfolioPoint[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([backtestApi.output(workflowInstanceId, "daily_portfolios"), backtestApi.output(workflowInstanceId, "return_summary")])
      .then(async ([dailyPortfolios, returnSummary]) => {
        const instance = await BacktestAnalytics.create(workflowInstanceId, { daily_portfolios: dailyPortfolios, return_summary: returnSummary });
        if (cancelled) { await instance.close(); return; }
        analytics.current = instance;
        const [nextSummary, nextPortfolio] = await Promise.all([instance.summary(), instance.portfolios()]);
        if (cancelled) return;
        setBackendSummary(nextSummary);
        setPortfolio(nextPortfolio);
        setStartDate(nextPortfolio[0]?.time ?? "");
        setEndDate(nextPortfolio.at(-1)?.time ?? "");
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; const instance = analytics.current; analytics.current = null; instance?.close(); };
  }, [workflowInstanceId]);

  const fullReport = useMemo(() => createReport(portfolio, annualTradingDays, riskFreeRate), [annualTradingDays, portfolio, riskFreeRate]);
  useEffect(() => {
    if (!fullReport) return;
    onSummary({ ...backendSummary, totalReturn: fullReport.totalReturn, annualReturn: fullReport.cagr, annualVolatility: fullReport.volatility, sharpeRatio: fullReport.sharpe, maxDrawdown: fullReport.maxDrawdown, dailyWinningRate: fullReport.winRate });
  }, [backendSummary, fullReport, onSummary]);

  const selectedPortfolio = useMemo(() => portfolio.filter((row) => (!startDate || row.time >= startDate) && (!endDate || row.time <= endDate)), [endDate, portfolio, startDate]);
  const rangePoints = useMemo(() => portfolio.map((row) => ({ time: row.time, value: row.dailyReturn })), [portfolio]);
  const report = useMemo(() => createReport(selectedPortfolio, annualTradingDays, riskFreeRate), [annualTradingDays, riskFreeRate, selectedPortfolio]);

  useEffect(() => {
    if (!onChartRanges || !report) return;
    onChartRanges({
      netValue: chartRange(report.netValue.map((row) => row.value)),
      totalEquity: chartRange(selectedPortfolio.map((row) => row.totalEquity)),
      drawdown: chartRange(report.drawdown.map((row) => row.value), true),
      rollingSharpe: chartRange(report.rollingSharpe.map((row) => row.value), true)
    });
  }, [onChartRanges, report, selectedPortfolio]);

  let overview: ReactNode;
  if (loading) overview = <ReportLoading />;
  else if (error) overview = <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>;
  else if (!report) overview = <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">所选日期范围内暂无回测数据</div>;
  else overview = <ReportOverview chartRanges={chartRanges} portfolio={selectedPortfolio} report={report} theme={theme} />;

  return <Tabs value={activeTab ?? localTab} onValueChange={(value) => { setLocalTab(value); onActiveTabChange?.(value); }} className="relative">
    {headerEnd ? <div className="absolute right-0 top-0 z-20">{headerEnd}</div> : null}
    {showTabs ? <div className="sticky top-20 z-30 mb-2 w-fit pb-1"><TabsList><TabsTrigger value="overview">回测概览</TabsTrigger>{tableTabs.map((tab) => <TabsTrigger disabled={loading || Boolean(error)} key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}</TabsList></div> : null}
    {!loading && !error && portfolio.length ? <ReportDateRangeBar endDate={endDate} maximumDate={portfolio.at(-1)?.time ?? ""} minimumDate={portfolio[0]?.time ?? ""} points={rangePoints} startDate={startDate} theme={theme} onEndDate={(value) => setEndDate(value < startDate ? startDate : value)} onReset={() => { setStartDate(portfolio[0]?.time ?? ""); setEndDate(portfolio.at(-1)?.time ?? ""); }} onStartDate={(value) => setStartDate(value > endDate ? endDate : value)} /> : null}
    <TabsContent value="overview" className="space-y-4">{overview}</TabsContent>
    {tableTabs.map((tab) => <TabsContent className="min-h-[calc(100dvh-20rem)]" key={`${tab.value}:${startDate}:${endDate}`} value={tab.value}><BacktestTable analytics={analytics.current} endDate={endDate} name={tab.value} startDate={startDate} workflowInstanceId={workflowInstanceId} /></TabsContent>)}
  </Tabs>;
}

function ReportOverview({ chartRanges, portfolio, report, theme }: { chartRanges?: BacktestChartRanges; portfolio: PortfolioPoint[]; report: QuantStatsReport; theme: string }) {
  const returnMetrics = [
    { label: "累计收益", value: report.totalReturn, format: "percent" },
    { label: "年化收益", value: report.cagr, format: "percent" },
    { label: "夏普比率", value: report.sharpe },
    { label: "年化波动", value: report.volatility, format: "percent" }
  ] satisfies Metric[];
  const periods = [...report.drawdownPeriods].sort((left, right) => left.maxDrawdownPercent - right.maxDrawdownPercent);
  const drawdownMetrics = [
    { label: "平均回撤", value: periods.length ? average(periods.map((row) => row.maxDrawdownPercent)) / 100 : null, format: "percent" },
    { label: "平均回撤持续天数", value: periods.length ? average(periods.map((row) => row.days)) : null, format: "integer" },
    { label: "恢复因子", value: report.recoveryFactor },
    { label: "收益/痛苦比率", value: report.gainToPainRatio }
  ] satisfies Metric[];

  return <div className="space-y-4">
    <ReportCard title="收益分析">
      <MetricGrid metrics={returnMetrics} />
      <MetricGrid metrics={feeMetrics(portfolio)} />
      <ChartCard title="累计收益与总资产"><EChart height={360} option={portfolioOption(portfolio, report, theme, chartRanges)} /></ChartCard>
      <ChartCard title="滚动夏普比率"><EChart height={340} option={rollingSharpeOption(report, theme, chartRanges?.rollingSharpe)} /></ChartCard>
      <PerformanceTable report={report} />
    </ReportCard>
    <ReportCard title="回撤分析">
      <MetricGrid metrics={drawdownMetrics} />
      <ChartCard title="回撤曲线"><EChart height={340} option={drawdownOption(report, theme, chartRanges?.drawdown)} /></ChartCard>
      <DrawdownTable rows={periods.slice(0, 5)} />
    </ReportCard>
  </div>;
}

function ReportCard({ children, title }: { children: ReactNode; title: string }) { return <Card className="rounded-md py-5 shadow-sm"><CardHeader className="px-5 pb-2"><CardTitle className="text-base font-semibold">{title}</CardTitle></CardHeader><CardContent className="space-y-4 px-5">{children}</CardContent></Card>; }
function ChartCard({ children, title }: { children: ReactNode; title: string }) { return <Card className="rounded-md py-4 shadow-sm"><CardHeader className="px-4 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader><CardContent className="px-4">{children}</CardContent></Card>; }
function MetricGrid({ metrics }: { metrics: Metric[] }) { return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{metrics.map((metric) => <div className="rounded-md border bg-card px-4 py-3 shadow-sm" key={metric.label}><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-2 text-lg font-semibold tabular-nums tracking-tight">{formatMetric(metric.value, metric.format)}</p></div>)}</div>; }
function ReportLoading() { return <div className="grid min-h-80 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">DuckDB 正在读取回测结果...</p></div></div>; }

function PerformanceTable({ report }: { report: QuantStatsReport }) {
  const longestDrawdown = report.drawdownPeriods.length ? Math.max(...report.drawdownPeriods.map((row) => row.days)) : null;
  const rows = [
    { label: "累计收益率", value: report.totalReturn, format: "percent" },
    { label: "年化收益率", value: report.cagr, format: "percent" },
    { label: "夏普比率", value: report.sharpe },
    { label: "最大回撤", value: report.maxDrawdown, format: "percent" },
    { label: "索提诺比率", value: report.sortino },
    { label: "年化波动率", value: report.volatility, format: "percent" },
    { label: "卡尔玛比率", value: report.calmar },
    { label: "盈亏比", value: report.payoffRatio },
    { label: "平均日收益率", value: report.averageReturn, format: "percent" },
    { label: "最大连续亏损次数", value: report.maxConsecutiveLosses, format: "integer" },
    { label: "盈利因子", value: report.profitFactor },
    { label: "恢复因子", value: report.recoveryFactor },
    { label: "预期年化收益率", value: report.expectedAnnualReturn, format: "percent" },
    { label: "最长回撤持续天数", value: longestDrawdown, format: "integer" },
    { label: "偏度", value: report.skew },
    { label: "峰度", value: report.kurtosis },
    { label: "日风险价值（95%）", value: report.valueAtRisk, format: "percent" },
    { label: "预期短缺（95%）", value: report.conditionalValueAtRisk, format: "percent" },
    { label: "胜率", value: report.winRate, format: "percent" },
    { label: "收益/痛苦比率", value: report.gainToPainRatio }
  ] satisfies Metric[];
  return <div className="max-h-[440px] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur"><TableRow><TableHead>指标</TableHead><TableHead className="text-right">策略</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatMetric(row.value, row.format)}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function DrawdownTable({ rows }: { rows: DrawdownPeriod[] }) {
  if (!rows.length) return <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">暂无回撤区间</div>;
  return <div className="overflow-auto rounded-md border"><Table><TableHeader className="bg-muted/70"><TableRow><TableHead>开始</TableHead><TableHead>谷底</TableHead><TableHead>结束</TableHead><TableHead className="text-right">天数</TableHead><TableHead className="text-right">最大回撤</TableHead><TableHead className="text-right">99% 最大回撤</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={`${row.start}-${row.end}`}><TableCell>{row.start}</TableCell><TableCell>{row.valley}</TableCell><TableCell>{row.end}</TableCell><TableCell className="text-right tabular-nums">{row.days}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatMetric(row.maxDrawdownPercent / 100, "percent")}</TableCell><TableCell className="text-right font-mono tabular-nums">{formatMetric(row.maxDrawdown99Percent / 100, "percent")}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function BacktestTable({ analytics, endDate, name, startDate, workflowInstanceId }: { analytics: BacktestAnalytics | null; endDate: string; name: BacktestTableName; startDate: string; workflowInstanceId: number }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BacktestTablePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 50;
  useLayoutEffect(() => {
    if (!analytics || !startDate || !endDate) return undefined;
    const instance = analytics;
    let cancelled = false;
    setData(null);
    setLoading(true);
    setError("");
    async function load() {
      if (!instance.isRegistered(name)) await instance.register(name, await backtestApi.output(workflowInstanceId, name));
      const result = await instance.tablePage(name, page, pageSize, { start: startDate, end: endDate });
      if (!cancelled) setData(result);
    }
    load().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [analytics, endDate, name, page, startDate, workflowInstanceId]);
  if (loading) return <div className="grid min-h-64 place-items-center rounded-md border bg-card"><Loader2 className="animate-spin text-primary" /></div>;
  if (error) return <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!data?.rows.length) return <div className="grid min-h-64 place-items-center rounded-md border bg-card text-sm text-muted-foreground"><TableProperties className="mb-3 size-5" />暂无数据</div>;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  return <Card className="overflow-hidden py-0"><CardContent className="p-0"><div className="max-h-[calc(100dvh-20rem)] overflow-auto"><Table><TableHeader className="sticky top-0 z-10 bg-card"><TableRow>{data.columns.map((column) => <TableHead className="whitespace-nowrap" key={column}>{tableColumnLabels[name][column]}</TableHead>)}</TableRow></TableHeader><TableBody>{data.rows.map((row, index) => <TableRow key={index}>{data.columns.map((column) => <TableCell className="max-w-72 whitespace-nowrap font-mono text-xs" key={column}>{displayValue(row[column])}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between border-t px-4 py-3"><span className="text-xs text-muted-foreground">共 {data.total} 条</span><AppPagination page={page} totalPages={totalPages} onPageChange={setPage} /></div></CardContent></Card>;
}

function createReport(rows: PortfolioPoint[], periods: number, riskFreeRate: number) { return rows.length ? quantStatsReport(rows.map((row) => ({ time: row.time, value: row.dailyReturn ?? 0 })), periods, riskFreeRate) : null; }

function feeMetrics(rows: PortfolioPoint[]): Metric[] {
  const fees = rows.map((row) => row.dailyFee).filter((value): value is number => value !== null && value >= 0);
  const paid = fees.filter((value) => value > 0);
  const total = fees.reduce((sum, value) => sum + value, 0);
  const first = rows[0];
  const initialCapital = first?.totalEquity !== null && first?.netValue !== null && first.netValue > 0 ? first.totalEquity / first.netValue : null;
  return [
    { label: "累计手续费", value: fees.length ? total : null, format: "currency" },
    { label: "平均交易日手续费", value: paid.length ? total / paid.length : fees.length ? 0 : null, format: "currency" },
    { label: "最大单日手续费", value: fees.length ? Math.max(...fees) : null, format: "currency" },
    { label: "手续费占初始资金", value: initialCapital ? total / initialCapital : null, format: "percent" }
  ];
}

function formatMetric(value: number | null | undefined, format: MetricFormat = "decimal") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (format === "percent") return `${(value * 100).toFixed(2)}%`;
  if (format === "integer") return Math.round(value).toLocaleString("zh-CN");
  if (format === "currency") return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value.toFixed(3);
}

function displayValue(value: unknown) { if (value === null || value === undefined) return "—"; if (value instanceof Date) return value.toLocaleString("zh-CN", { hour12: false }); if (typeof value === "bigint") return value.toString(); if (typeof value === "object") return JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item); return String(value); }
function average(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }

function portfolioOption(rows: PortfolioPoint[], report: QuantStatsReport, theme: string, ranges?: BacktestChartRanges) { return baseOption(theme, rows.map((row) => row.time), [{ name: "策略净值", type: "line", data: report.netValue.map((row) => row.value), showSymbol: false, lineStyle: { width: 2.2 }, color: "#2563eb" }, { name: "总资产", type: "line", yAxisIndex: 1, data: rows.map((row) => row.totalEquity), showSymbol: false, lineStyle: { width: 1.5 }, color: "#059669" }], ranges?.netValue, ranges?.totalEquity, true, "decimal", "integer"); }
function drawdownOption(report: QuantStatsReport, theme: string, range?: ChartRange) { return baseOption(theme, report.drawdown.map((row) => row.time), [{ name: "回撤", type: "line", data: report.drawdown.map((row) => row.value), showSymbol: false, lineStyle: { width: 2 }, areaStyle: { opacity: 0.12 }, color: "#dc2626" }], range, undefined, false, "percent"); }
function rollingSharpeOption(report: QuantStatsReport, theme: string, range?: ChartRange) { return baseOption(theme, report.rollingSharpe.map((row) => row.time), [{ name: "滚动夏普比率", type: "line", data: report.rollingSharpe.map((row) => row.value), showSymbol: false, lineStyle: { width: 1.8 }, color: "#d97706" }], range); }
function baseOption(theme: string, dates: string[], series: unknown[], primaryRange?: ChartRange, secondaryRange?: ChartRange, dualAxis = false, primaryFormat: AxisFormat = "decimal", secondaryFormat: AxisFormat = "decimal") { const color = theme === "dark" ? "#8996a5" : "#687771"; const line = theme === "dark" ? "rgba(160,184,210,.10)" : "rgba(24,66,54,.10)"; const axis = (range?: ChartRange, format: AxisFormat = "decimal") => ({ type: "value", scale: true, min: range?.min, max: range?.max, axisLabel: { color, fontSize: 9, formatter: (value: number) => formatAxisLabel(value, format) }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: line } } }); return { animationDuration: 180, grid: { left: 48, right: dualAxis ? 58 : 28, top: 42, bottom: 38, containLabel: true }, legend: { top: 0, left: 0, textStyle: { color, fontSize: 10 } }, tooltip: { trigger: "axis", backgroundColor: theme === "dark" ? "#151b24" : "#fff", borderColor: line, textStyle: { color: theme === "dark" ? "#eef4f7" : "#13201d", fontSize: 11 } }, xAxis: { type: "category", data: dates, boundaryGap: false, axisLine: { lineStyle: { color: line } }, axisLabel: { color, fontSize: 9, hideOverlap: true }, axisTick: { show: false } }, yAxis: dualAxis ? [axis(primaryRange, primaryFormat), { ...axis(secondaryRange, secondaryFormat), splitLine: { show: false } }] : axis(primaryRange, primaryFormat), series } as Record<string, unknown>; }
