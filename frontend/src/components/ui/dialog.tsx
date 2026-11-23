import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[90] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-bg1 p-5 shadow-panel focus:outline-none",
          className,
        )}
      >
        <D.Title className="text-base font-semibold">{title}</D.Title>
        {description && <D.Description className="mt-1 text-sm text-fg2">{description}</D.Description>}
        <div className="mt-4">{children}</div>
        <D.Close className="absolute right-3 top-3 rounded-md p-1.5 text-fg2 hover:bg-bg3 hover:text-fg1" aria-label="Close">
          <X size={16} />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/** Side/bottom sheet used for drawers on tablet and mobile. */
export function SheetContent({ side, title, children, className }: { side: "left" | "right" | "bottom"; title: string; children: ReactNode; className?: string }) {
  const pos = {
    left: "inset-y-0 left-0 w-[min(88vw,380px)] border-r",
    right: "inset-y-0 right-0 w-[min(92vw,440px)] border-l",
    bottom: "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t",
  }[side];
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[60] bg-black/40" />
      <D.Content className={cn("fixed z-[70] flex flex-col bg-bg1 shadow-panel focus:outline-none", pos, className)} aria-describedby={undefined}>
        <D.Title className="sr-only">{title}</D.Title>
        {children}
      </D.Content>
    </D.Portal>
  );
}
