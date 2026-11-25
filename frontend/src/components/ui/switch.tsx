import * as S from "@radix-ui/react-switch";

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <S.Root checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} className="disabled:opacity-50 relative h-5 w-9 shrink-0 rounded-full bg-bg3 transition-colors data-[state=checked]:bg-accent2">
      <S.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}
