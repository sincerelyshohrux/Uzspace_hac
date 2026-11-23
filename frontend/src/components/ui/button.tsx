import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "primary" | "ghost" | "outline" | "danger" | "violet";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  default: "bg-bg2 border text-fg1 hover:bg-bg3 hover:border-line-strong/25",
  primary: "bg-accent2 text-white border border-accent2 hover:brightness-110 shadow-[0_4px_14px_rgb(var(--accent-2)/.35)]",
  violet: "bg-st-confirmed text-white border border-st-confirmed hover:brightness-110 shadow-[0_4px_14px_rgb(var(--st-confirmed)/.3)]",
  ghost: "text-fg2 hover:text-fg1 hover:bg-bg3",
  outline: "border text-fg1 hover:bg-bg3",
  danger: "bg-risk-high text-white hover:brightness-110",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3 text-[13px] gap-2",
  lg: "h-11 px-4 text-sm gap-2",
  icon: "h-9 w-9",
  "icon-sm": "h-8 w-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "default", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex select-none items-center justify-center rounded-lg font-medium transition-[background,color,border,filter,transform] duration-150 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";
