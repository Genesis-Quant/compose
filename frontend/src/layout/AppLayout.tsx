import { Link, NavLink, Outlet } from "react-router-dom";
import IconLogOut from "~icons/lucide/log-out";
import IconMoon from "~icons/lucide/moon";
import IconSun from "~icons/lucide/sun";

import { BrandMark } from "@/components/auth/BrandMark";
import { useAppStore } from "@/store";
import { Button } from "@/ui/button";

export default function AppLayout() {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-[color:var(--panel)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link to="/" aria-label="Arena 首页"><BrandMark /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
            <NavLink className={({ isActive }) => isActive ? "app-nav-link app-nav-link-active" : "app-nav-link"} end to="/">首页</NavLink>
            <a className="app-nav-link" href="/#applications">研究能力</a>
            <a className="app-nav-link" href="/#workflow">执行流程</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? "切换浅色模式" : "切换深色模式"}>
              {theme === "dark" ? <IconMoon width={17} height={17} /> : <IconSun width={17} height={17} />}
            </Button>
            <Link className="flex h-10 items-center gap-2 rounded-md border border-border px-2.5 text-xs transition-colors hover:bg-accent sm:px-3" to="/profile">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{user?.username.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-28 truncate sm:block">{user?.username}</span>
            </Link>
            <Button type="button" variant="ghost" size="icon" onClick={logout} aria-label="退出登录"><IconLogOut width={17} height={17} /></Button>
          </div>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
