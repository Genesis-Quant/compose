import { BarChart, LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { getInstanceByDom, init, use, type EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

use([BarChart, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

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
