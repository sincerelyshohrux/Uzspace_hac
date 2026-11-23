import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;

export function Tip({ label, children, side = "top", kbd }: { label: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left"; kbd?: string }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          className="z-[100] flex items-center gap-2 rounded-md border bg-bg1 px-2 py-1 text-xs text-fg1 shadow-panel data-[state=delayed-open]:animate-in"
        >
          {label}
          {kbd && <span className="kbd">{kbd}</span>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
