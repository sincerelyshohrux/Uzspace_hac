import { useId } from "react";

export function Logo({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} opacity=".16" />
      <rect x=".5" y=".5" width="31" height="31" rx="8.5" fill="none" stroke={`url(#${id})`} strokeOpacity=".5" />
      <path d="M8 22 L16 8 L24 22 Z" fill="none" stroke={`url(#${id})`} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="17.2" r="2.4" fill="#22D3EE" />
    </svg>
  );
}
