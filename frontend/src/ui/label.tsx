import type * as React from "react";

import { cn } from "@/assets/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-semibold tracking-wide text-foreground", className)} {...props} />;
}

export { Label };
