import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import IconArrowRight from "~icons/lucide/arrow-right";
import IconBraces from "~icons/lucide/braces";
import IconChartColumn from "~icons/lucide/chart-column";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconChevronRight from "~icons/lucide/chevron-right";
import IconCirclePlay from "~icons/lucide/circle-play";
import IconDatabase from "~icons/lucide/database";
import IconFlaskConical from "~icons/lucide/flask-conical";
import IconGitBranch from "~icons/lucide/git-branch";
import IconRadar from "~icons/lucide/radar";
import IconRoute from "~icons/lucide/route";

import { Button } from "@/ui/button";

type IconComponent = ComponentType<{ className?: string; width?: number; height?: number }>;

const heroImage = "https://typora-1304907527.cos.ap-nanjing.myqcloud.com/arena-quant-hero.png";
const researchSlides = [
  {
    id: "query",
    eyebrow: "DATA RESEARCH",
    title: ["统一数据查询", "从可信数据开始。"],
    description: "以结构化参数提交数据查询，在后台完成计算，并以 Parquet 结果保留可复现的数据快照。",
    action: "了解 Query",
    icon: IconDatabase,
    endpoint: "POST /api/v1/query/workflows",
    signals: [["DATASET", "统一数据集"], ["CODES", "股票池筛选"], ["OUTPUT", "按需生成结果"]]
  },
  {
    id: "factor",
    eyebrow: "FACTOR RESEARCH",
    title: ["因子有效性分析", "验证每一个研究假设。"],
    description: "完成因子预处理、信息系数和分组收益分析，将多输出结果交给后台任务统一管理。",
    action: "了解 Factor",
    icon: IconFlaskConical,
    endpoint: "POST /api/v1/factor/workflows",
    signals: [["PROCESSED", "因子预处理"], ["IC", "信息系数"], ["GROUP", "分组收益"]]
  },
  {
    id: "backtest",
    eyebrow: "STRATEGY RESEARCH",
    title: ["策略回测", "验证收益与风险。"],
    description: "提交策略参数与数据集查询，由 DolphinScheduler 在后台执行，并持续追踪状态、日志和最终报告。",
    action: "了解 Backtest",
    icon: IconChartColumn,
    endpoint: "POST /api/v1/backtest/workflows",
    signals: [["RETURNS", "收益表现"], ["RISK", "风险指标"], ["LOGS", "执行日志"]]
  }
] as const;
const marketTape = ["QUERY", "FACTOR", "BACKTEST", "DOLPHINSCHEDULER", "PARQUET", "IC", "GROUP RETURN", "SHARPE", "DRAWDOWN"];

export default function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const activeSlide = researchSlides[activeIndex];
  const ActiveIcon = activeSlide.icon;

  useEffect(() => {
    const timer = reducedMotion ? undefined : window.setInterval(() => setActiveIndex((current) => (current + 1) % researchSlides.length), 7000);
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, [reducedMotion]);

  function selectSlide(index: number) {
    setActiveIndex((index + researchSlides.length) % researchSlides.length);
  }

  function showApplication(id: string) {
    document.getElementById(`application-${id}`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  }

  return (
    <div className="overflow-hidden">
      <section className="home-hero relative min-h-[calc(100vh-4rem)] overflow-hidden bg-black text-white">
        <img className="absolute inset-0 size-full object-cover object-center opacity-75" src={heroImage} alt="" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.96)_0%,rgba(0,0,0,.82)_40%,rgba(0,0,0,.16)_78%,rgba(0,0,0,.58)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.1)_0%,rgba(0,0,0,.04)_55%,rgba(0,0,0,.92)_100%)]" />
        <div className="home-grid absolute inset-0" />
        <MarketTape />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col justify-end px-5 pb-10 pt-28 sm:px-8 sm:pb-14 lg:px-12">
          <AnimatePresence mode="wait">
            <motion.div key={activeSlide.id} className="max-w-3xl" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.48, ease: "easeOut" }}>
              <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-white/60">
                <span className="grid size-9 place-items-center border border-white/15 bg-black/35 text-emerald-300"><ActiveIcon width={17} height={17} /></span>
                {activeSlide.eyebrow}
              </div>
              <h1 className="display-type max-w-4xl text-[clamp(2.8rem,6vw,6.2rem)] leading-[0.98] font-normal tracking-[-0.055em]">
                {activeSlide.title[0]}<br /><span className="text-white/82">{activeSlide.title[1]}</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-white/62 sm:text-[15px]">{activeSlide.description}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button className="h-12 bg-white px-6 text-black shadow-none hover:bg-white/90" type="button" onClick={() => showApplication(activeSlide.id)}><IconCirclePlay width={17} height={17} />{activeSlide.action}</Button>
                <Button className="h-12 border-white/20 bg-black/20 px-6 text-white hover:border-white/35 hover:bg-white/10" type="button" variant="outline" onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })}>执行流程<IconArrowRight width={16} height={16} /></Button>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex flex-col gap-6 lg:mt-14 lg:flex-row lg:items-end lg:justify-between">
            <motion.div key={`${activeSlide.id}-signals`} className="grid max-w-3xl flex-1 border-y border-white/15 bg-black/20 backdrop-blur-sm sm:grid-cols-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }}>
              {activeSlide.signals.map(([label, value], index) => <div className={index ? "border-t border-white/15 px-5 py-4 sm:border-l sm:border-t-0" : "px-5 py-4"} key={label}><div className="text-[9px] font-bold tracking-[0.18em] text-white/42">{label}</div><div className="mt-2 text-sm text-white/88">{value}</div></div>)}
            </motion.div>
            <CarouselControls activeIndex={activeIndex} onSelect={selectSlide} />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background" id="applications">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
            <div>
              <p className="text-[10px] font-bold tracking-[0.24em] text-primary">RESEARCH APPLICATIONS</p>
              <h2 className="display-type mt-4 max-w-lg text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">三种应用，一套任务生命周期。</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">应用负责提交与结果，中间状态、日志和操作统一交给 Tasks API，保持职责清晰。</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {researchSlides.map((slide, index) => <ApplicationCard key={slide.id} index={index} slide={slide} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--panel-soft)]" id="workflow">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.35fr] lg:gap-20 lg:px-12 lg:py-24">
          <div>
            <p className="text-[10px] font-bold tracking-[0.24em] text-primary">TASK LIFECYCLE</p>
            <h2 className="display-type mt-4 text-4xl tracking-[-0.04em] sm:text-5xl">从提交到结果，每一步都可追踪。</h2>
          </div>
          <div className="grid border-y border-border sm:grid-cols-3">
            <ResearchStep icon={IconBraces} label="01" title="提交" detail="应用 API 校验参数并创建后台任务" />
            <ResearchStep icon={IconRadar} label="02" title="追踪" detail="Tasks API 统一提供状态、日志与操作" />
            <ResearchStep icon={IconRoute} label="03" title="获取" detail="完成后由对应应用 API 返回结果文件" />
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-[10px] tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>ARENA · QUANT RESEARCH INFRASTRUCTURE</span><span className="numeric">QUERY / FACTOR / BACKTEST</span>
        </div>
      </footer>
    </div>
  );
}

function MarketTape() {
  return <motion.div className="absolute inset-x-0 top-0 flex h-9 items-center overflow-hidden border-b border-white/10 bg-black/35 text-[9px] tracking-[0.16em] text-white/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}><motion.div className="flex shrink-0 items-center gap-10 whitespace-nowrap px-6" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>{[...marketTape, ...marketTape].map((item, index) => <span className="flex items-center gap-2" key={`${item}-${index}`}><span className="size-1 rounded-full bg-emerald-400" />{item}</span>)}</motion.div></motion.div>;
}

function CarouselControls({ activeIndex, onSelect }: { activeIndex: number; onSelect: (index: number) => void }) {
  return <div className="flex shrink-0 items-center gap-3"><Button className="border-white/20 bg-black/20 text-white hover:bg-white/10" size="icon" variant="outline" onClick={() => onSelect(activeIndex - 1)} aria-label="上一项研究"><IconChevronLeft width={17} height={17} /></Button><div className="flex items-center gap-2">{researchSlides.map((slide, index) => <Button className={index === activeIndex ? "h-1 w-8 min-w-0 rounded-none bg-white p-0 hover:bg-white" : "h-1 w-4 min-w-0 rounded-none bg-white/30 p-0 hover:bg-white/60"} key={slide.id} size="icon-xs" type="button" onClick={() => onSelect(index)} aria-label={`查看${slide.title[0]}`} />)}</div><Button className="border-white/20 bg-black/20 text-white hover:bg-white/10" size="icon" variant="outline" onClick={() => onSelect(activeIndex + 1)} aria-label="下一项研究"><IconChevronRight width={17} height={17} /></Button></div>;
}

function ApplicationCard({ index, slide }: { index: number; slide: typeof researchSlides[number] }) {
  const Icon = slide.icon;
  return <motion.article className="group bg-background p-6 md:min-h-[310px]" id={`application-${slide.id}`} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.42, delay: index * 0.08 }}><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-md border border-border bg-[color:var(--panel-soft)] text-primary"><Icon width={18} height={18} /></span><span className="numeric text-[10px] text-muted-foreground">0{index + 1}</span></div><h3 className="display-type mt-16 text-2xl tracking-[-0.03em]">{slide.title[0]}</h3><p className="mt-3 text-xs leading-6 text-muted-foreground">{slide.description}</p><div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-[9px] tracking-[0.08em] text-muted-foreground"><IconGitBranch width={13} height={13} /><code>{slide.endpoint}</code></div></motion.article>;
}

function ResearchStep({ detail, icon: Icon, label, title }: { detail: string; icon: IconComponent; label: string; title: string }) {
  return <motion.div className="group border-b border-border px-5 py-6 last:border-b-0 sm:border-b-0 sm:border-x sm:border-l-0 sm:last:border-r-0" whileHover={{ y: -4 }}><div className="flex items-center justify-between"><Icon className="text-muted-foreground transition-colors group-hover:text-primary" width={17} height={17} /><span className="numeric text-xs text-muted-foreground">{label}</span></div><div className="mt-12 font-semibold">{title}</div><div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div></motion.div>;
}
