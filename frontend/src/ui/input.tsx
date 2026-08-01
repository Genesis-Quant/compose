import type * as React from "react";

import { cn } from "@/assets/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full min-w-0 border-0 bg-transparent px-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/65 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
