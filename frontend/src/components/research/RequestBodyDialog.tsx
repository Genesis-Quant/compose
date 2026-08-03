import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function RequestBodyDialog({ endpoint, onClose, open, value }: { endpoint: string; onClose: () => void; open: boolean; value: unknown }) {
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}><DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-4xl"><DialogHeader className="border-b px-5 py-4 pr-12"><DialogTitle className="text-base">完整 JSON 请求体</DialogTitle><DialogDescription className="font-mono text-[11px]">POST {endpoint}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-5"><pre className="m-0 min-w-max font-mono text-xs leading-6 text-foreground"><code>{JSON.stringify(value, null, 2)}</code></pre></div><DialogFooter className="border-t px-5 py-3"><span className="mr-auto text-xs text-muted-foreground">内容与执行时提交的请求体一致</span><Button variant="outline" onClick={onClose}>关闭</Button></DialogFooter></DialogContent></Dialog>;
}
