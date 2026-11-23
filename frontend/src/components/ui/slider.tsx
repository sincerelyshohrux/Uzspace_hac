import * as S from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; className?: string }) {
  return (
    <S.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label}>
      <S.Track className="relative h-1.5 grow rounded-full bg-bg3">
        <S.Range className="absolute h-full rounded-full bg-gradient-to-r from-risk-low via-risk-mid to-risk-high" />
      </S.Track>
      <S.Thumb className="block h-4 w-4 rounded-full border-2 border-accent bg-bg1 shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30" />
    </S.Root>
  );
}
