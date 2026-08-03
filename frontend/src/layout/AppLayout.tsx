import { CandlestickChart, DatabaseZap, FlaskConical, Home, Menu, Moon, Sun, Workflow } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store";

const navigation = [
  { id: "home", label: "首页", path: "/", icon: Home },
  { id: "query", label: "数据查询", path: "/query", icon: DatabaseZap },
  { id: "factor", label: "因子分析", path: "/factor", icon: FlaskConical },
  { id: "backtest", label: "策略回测", path: "/backtest", icon: CandlestickChart },
  { id: "tasks", label: "任务", path: "/tasks", icon: Workflow }
];

export default function AppLayout() {
  const location = useLocation();
  const active = activePage(location.pathname);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const user = useAppStore((state) => state.user);

  return <main className="min-h-screen text-foreground">
    <header className="sticky top-0 z-40 border-b border-border/35 bg-background/80 backdrop-blur-xl lg:border-border lg:bg-background/95">
      <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-6 lg:h-16 lg:flex-nowrap lg:gap-0 lg:py-0">
        <div className="flex items-center gap-1">
          <Sheet>
            <SheetTrigger asChild><Button className="size-9 text-muted-foreground lg:hidden" size="icon" variant="ghost"><Menu className="size-[18px]" /><span className="sr-only">打开导航</span></Button></SheetTrigger>
            <SheetContent side="left" className="w-[280px] gap-0 p-0 sm:max-w-[320px]">
              <SheetHeader className="border-b px-4 py-4"><SheetTitle className="flex items-center gap-2"><FlaskConical className="size-5 text-primary" />Arena</SheetTitle></SheetHeader>
              <nav className="space-y-1 p-2">{navigation.map(({ id, icon: Icon, label, path }) => <SheetClose asChild key={id}><NavLink className={id === active ? "flex items-center gap-3 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" : "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"} to={path}><Icon className="size-4" />{label}</NavLink></SheetClose>)}</nav>
            </SheetContent>
          </Sheet>
          <Button className="h-9 gap-2 px-1.5 lg:h-10 lg:gap-3 lg:px-2" variant="ghost" asChild><Link to="/"><FlaskConical className="size-[18px] lg:size-5" /><span className="text-base font-semibold lg:text-lg">Arena</span></Link></Button>
        </div>

        <Tabs value={active} className="hidden lg:block"><TabsList>{navigation.map(({ id, icon: Icon, label, path }) => <TabsTrigger asChild key={id} value={id}><NavLink aria-label={label} title={label} to={path}><Icon />{label}</NavLink></TabsTrigger>)}</TabsList></Tabs>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2"><Sun className="size-4 text-muted-foreground" /><Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} /><Moon className="size-4 text-muted-foreground" /></div>
          <Button className="border-border/40 bg-background/35 lg:bg-background" size="icon" variant={active === "profile" ? "default" : "outline"} asChild><Link to="/profile"><Avatar className="size-7"><AvatarFallback>{user?.username.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span className="sr-only">{user?.username}</span></Link></Button>
        </div>
      </div>
    </header>
    {active === "home" ? <Outlet /> : <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1440px] px-3 py-5 sm:px-6 sm:py-8 lg:py-10"><Outlet /></section>}
  </main>;
}

function activePage(pathname: string) {
  if (pathname.startsWith("/query")) return "query";
  if (pathname.startsWith("/factor")) return "factor";
  if (pathname.startsWith("/backtest")) return "backtest";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/profile")) return "profile";
  return "home";
}
