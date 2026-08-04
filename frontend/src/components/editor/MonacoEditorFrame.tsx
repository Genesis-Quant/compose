import { Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/assets/lib/utils";
import { Button } from "@/ui/button";

export default function MonacoEditorFrame({ children, className }: { children: ReactNode; className?: string }) {
  const [fullScreen, setFullScreen] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const synchronize = () => setFullScreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", synchronize);
    return () => {
      document.removeEventListener("fullscreenchange", synchronize);
    };
  }, []);

  function toggleFullScreen() {
    if (!frame.current) return;
    const operation = document.fullscreenElement === frame.current ? document.exitFullscreen() : frame.current.requestFullscreen();
    operation.catch(() => setFullScreen(false));
  }

  const label = fullScreen ? "退出全屏" : "全屏编辑";
  return <div className={cn("relative h-full overflow-hidden rounded-md border", className, fullScreen && "h-dvh w-dvw min-h-0 rounded-none border-0 bg-background")} ref={frame}>
    <Button aria-label={label} className="absolute top-2 right-4 z-20 bg-background/90 shadow-sm backdrop-blur" onClick={toggleFullScreen} size="icon-sm" title={label} variant="outline">
      {fullScreen ? <Minimize2 /> : <Maximize2 />}
    </Button>
    <div className="h-full min-h-0 overflow-hidden">{children}</div>
  </div>;
}
