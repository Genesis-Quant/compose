import { useCallback, useEffect, useMemo, useRef } from "react";
import IconCalendarRange from "~icons/lucide/calendar-range";
import IconRotateCcw from "~icons/lucide/rotate-ccw";

import EChart from "@/components/chart/EChart";
import { Button } from "@/components/ui/button";

type DateRangePoint = { time: string; value: number | null };
type DataZoomEvent = { batch?: DataZoomEvent[]; end?: number; endValue?: unknown; start?: number; startValue?: unknown };

export default function ReportDateRangeBar({ endDate, maximumDate, minimumDate, onEndDate, onReset, onStartDate, points, startDate, theme }: { endDate: string; maximumDate: string; minimumDate: string; onEndDate: (value: string) => void; onReset: () => void; onStartDate: (value: string) => void; points: DateRangePoint[]; startDate: string; theme: string }) {
  const timer = useRef<number | null>(null);
  const dates = useMemo(() => points.map((row) => row.time), [points]);
  const tradingDays = useMemo(() => dates.filter((date) => date >= startDate && date <= endDate).length, [dates, endDate, startDate]);
  const option = useMemo(() => dateRangeOption(points, startDate, endDate, theme), [endDate, points, startDate, theme]);
  const changeRange = useCallback((event: unknown) => {
    const root = event as DataZoomEvent;
    const zoom = root.batch?.[0] ?? root;
    const nextStart = zoomDate(zoom.startValue, zoom.start, dates, "start");
    const nextEnd = zoomDate(zoom.endValue, zoom.end, dates, "end");
    if (!nextStart || !nextEnd || nextStart === startDate && nextEnd === endDate) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      onStartDate(nextStart);
      onEndDate(nextEnd);
      timer.current = null;
    }, 250);
  }, [dates, endDate, onEndDate, onStartDate, startDate]);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  if (!minimumDate || !maximumDate) return null;
  return <div className="rounded-md border bg-muted/20 px-3 pb-2 pt-2.5">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <IconCalendarRange className="text-muted-foreground" width={16} height={16} />
      <span className="font-medium">报告区间</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{startDate}</span>
      <span className="text-xs text-muted-foreground">至</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{endDate}</span>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{tradingDays.toLocaleString("zh-CN")} 个交易日</span>
      <Button aria-label="恢复全部报告区间" className="size-8" disabled={startDate === minimumDate && endDate === maximumDate} size="icon" title="恢复全部区间" variant="ghost" onClick={onReset}><IconRotateCcw width={15} height={15} /></Button>
    </div>
    <div aria-label="拖动选择报告日期范围" className="h-[72px] min-w-0 w-full"><EChart height={72} onDataZoomChange={changeRange} option={option} /></div>
  </div>;
}

function dateRangeOption(rows: DateRangePoint[], startDate: string, endDate: string, theme: string) {
  const dark = theme === "dark";
  const accent = dark ? "#34d399" : "#059669";
  const preview = dark ? "#64748b" : "#94a3b8";
  const border = dark ? "#3f3f46" : "#d4d4d8";
  const background = dark ? "#18181b" : "#ffffff";
  return {
    animation: false,
    grid: { left: 10, right: 10, top: 0, bottom: 40 },
    tooltip: { show: false },
    xAxis: { type: "category", data: rows.map((row) => row.time), show: false },
    yAxis: { type: "value", show: false, scale: true },
    series: [{ type: "line", data: rows.map((row) => row.value ?? 0), showSymbol: false, lineStyle: { opacity: 0 } }],
    dataZoom: [{
      type: "slider",
      bottom: 0,
      height: 38,
      startValue: startDate,
      endValue: endDate,
      filterMode: "none",
      realtime: true,
      brushSelect: true,
      showDetail: false,
      backgroundColor: background,
      borderColor: border,
      fillerColor: dark ? "rgba(52,211,153,.16)" : "rgba(5,150,105,.12)",
      dataBackground: { lineStyle: { color: preview, opacity: 0.8, width: 1 }, areaStyle: { color: preview, opacity: dark ? 0.16 : 0.12 } },
      selectedDataBackground: { lineStyle: { color: accent, width: 1.4 }, areaStyle: { color: accent, opacity: dark ? 0.18 : 0.2 } },
      handleStyle: { color: background, borderColor: accent, borderWidth: 1.5 },
      moveHandleStyle: { color: accent, opacity: 0.22 }
    }]
  };
}

function zoomDate(value: unknown, percent: number | undefined, dates: string[], edge: "start" | "end") {
  if (!dates.length) return "";
  if (typeof value === "string" && dates.includes(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return dates[Math.max(0, Math.min(dates.length - 1, Math.round(value)))] ?? "";
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "";
  const position = Math.max(0, Math.min(dates.length - 1, percent / 100 * (dates.length - 1)));
  return dates[edge === "start" ? Math.floor(position) : Math.ceil(position)] ?? "";
}
