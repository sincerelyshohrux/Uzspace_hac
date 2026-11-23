import { CheckCircle2, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Alert, Status } from "@/api/types";
import { useUpdateAlert } from "@/api/hooks";
import { addMine, CURRENT_USER } from "@/app/state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

const draftKey = (id: string) => `ss-draft-${id}`;

export function InspectorActions({ a, pending, onPending }: { a: Alert; pending: Status | null; onPending: (s: Status | null) => void }) {
  const { t } = useI18n();
  const update = useUpdateAlert(a.alert_id);
  const [note, setNote] = useState("");

  useEffect(() => {
    let d: string | null = null;
    try {
      d = localStorage.getItem(draftKey(a.alert_id));
    } catch {
      /* ignore */
    }
    setNote(d ?? a.note ?? "");
  }, [a.alert_id, a.note]);

  const onNote = (v: string) => {
    setNote(v);
    try {
      localStorage.setItem(draftKey(a.alert_id), v);
    } catch {
      /* ignore */
    }
  };

  const save = (status: Status) => {
    onPending(null);
    update.mutate(
      { status, note: note.trim() || null, user: CURRENT_USER },
      {
        onSuccess: () => {
          addMine(a.alert_id);
          try {
            localStorage.removeItem(draftKey(a.alert_id));
          } catch {
            /* ignore */
          }
          toast.success(t("saved"), { description: `${a.alert_id} → ${t(`st_${status}`)}` });
        },
        onError: (e) => toast.error(t("save_failed", { e: e instanceof Error ? e.message : String(e) })),
      },
    );
  };
  const request = (s: Status) => (s === "in_review" ? save(s) : onPending(s));
  const busy = update.isPending;

  const btn = (s: Status, label: string, Icon: typeof CheckCircle2, variant: "primary" | "violet" | "default", kbd: string) => (
    <Button
      size="lg"
      variant={variant}
      onClick={() => request(s)}
      disabled={busy}
      className={cn("h-12 flex-col gap-0.5 px-1 text-xs sm:h-11 sm:flex-row sm:gap-1.5", a.status === s && "ring-2 ring-accent ring-offset-2 ring-offset-bg1")}
      aria-pressed={a.status === s}
      aria-keyshortcuts={kbd}
    >
      {busy && update.variables?.status === s ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      <span className="leading-tight">{label}</span>
    </Button>
  );

  return (
    <div>
      <textarea
        className="field mb-2 h-20 w-full resize-none py-2"
        placeholder={t("note_ph")}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        maxLength={1000}
        aria-label={t("note_ph")}
      />
      <div className="grid grid-cols-3 gap-1.5">
        {btn("in_review", t("a_review"), ClipboardCheck, "primary", "1")}
        {btn("confirmed", t("a_confirm"), CheckCircle2, "violet", "2")}
        {btn("false_positive", t("a_false"), XCircle, "default", "3")}
      </div>
      <Dialog open={!!pending} onOpenChange={(o) => !o && onPending(null)}>
        {pending && (
          <DialogContent title={t(pending === "confirmed" ? "confirm_q_confirmed" : "confirm_q_false_positive")} description={t("confirm_body")}>
            <div className="mb-4 rounded-lg border bg-bg2 px-3 py-2 font-mono text-xs">{a.alert_id}{note.trim() && <div className="mt-1 font-sans italic text-fg2">“{note.trim()}”</div>}</div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="ghost">{t("cancel")}</Button></DialogClose>
              <Button variant={pending === "confirmed" ? "violet" : "primary"} onClick={() => save(pending)} autoFocus>{t("yes")}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
