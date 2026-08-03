import { BarChart, LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { getInstanceByDom, init, use, type EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

use([BarChart, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type ChartRange = { min: number; max: number };
export type AxisFormat = "decimal" | "integer" | "percent";

export function chartRange(values: Array<number | null | undefined>, includeZero = false): ChartRange | undefined {
  let min = includeZero ? 0 : Number.POSITIVE_INFINITY;
  let max = includeZero ? 0 : Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const value of values) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    count += 1;
  }
  return count ? { min, max } : undefined;
}

export function mergeChartRanges(...ranges: Array<ChartRange | undefined>): ChartRange | undefined {
  const present = ranges.filter((range): range is ChartRange => range !== undefined);
  if (!present.length) return undefined;
  let min = Math.min(...present.map((range) => range.min));
  let max = Math.max(...present.map((range) => range.max));
  if (min === max) {
    const padding = Math.abs(min) * 0.05 || 1;
    min -= padding;
    max += padding;
  }
  const interval = niceInterval((max - min) / 5);
  return { min: cleanNumber(Math.floor(min / interval) * interval), max: cleanNumber(Math.ceil(max / interval) * interval) };
}

export function formatAxisLabel(value: number, format: AxisFormat = "decimal") {
  if (!Number.isFinite(value)) return String(value);
  if (format === "integer") return Math.round(value).toLocaleString("zh-CN");
  const display = format === "percent" ? value * 100 : value;
  if (Math.abs(display) >= 1e8 || Math.abs(display) < 1e-5 && display !== 0) return `${display.toExponential(2)}${format === "percent" ? "%" : ""}`;
  return `${Number(display.toFixed(format === "percent" ? 2 : 4))}${format === "percent" ? "%" : ""}`;
}

function niceInterval(value: number) {
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

function cleanNumber(value: number) { return Number(value.toPrecision(12)); }

export default function EChart({ height, onDataZoomChange, option }: { height: number; onDataZoomChange?: (event: unknown) => void; option: EChartsCoreOption }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    const chart = init(container.current);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = container.current ? getInstanceByDom(container.current) : undefined;
    chart?.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const chart = container.current ? getInstanceByDom(container.current) : undefined;
    if (!chart || !onDataZoomChange) return undefined;
    chart.on("datazoom", onDataZoomChange);
    return () => { chart.off("datazoom", onDataZoomChange); };
  }, [onDataZoomChange]);

  return <div ref={container} style={{ height }} />;
}
