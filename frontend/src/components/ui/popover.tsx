import * as P from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;

export function PopoverContent({ children, className, align = "start", side = "bottom" }: { children: ReactNode; className?: string; align?: "start" | "center" | "end"; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <P.Portal>
      <P.Content align={align} side={side} sideOffset={8} collisionPadding={12} className={cn("z-[75] rounded-xl border bg-bg1 p-3 shadow-panel focus:outline-none", className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}
