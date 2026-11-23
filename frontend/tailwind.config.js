/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg0: c("bg-0"), bg1: c("bg-1"), bg2: c("bg-2"), bg3: c("bg-3"),
        line: c("line"), "line-strong": c("line-strong"),
        fg1: c("fg-1"), fg2: c("fg-2"), fg3: c("fg-3"),
        accent: c("accent"), accent2: c("accent-2"),
        risk: { high: c("risk-high"), mid: c("risk-mid"), low: c("risk-low") },
        ok: c("ok"),
        st: { new: c("st-new"), review: c("st-review"), confirmed: c("st-confirmed"), fp: c("st-fp") },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: { "2xs": ["11px", "14px"] },
      borderRadius: { xl: "12px", "2xl": "16px" },
      boxShadow: {
        panel: "0 8px 32px rgb(0 0 0 / var(--shadow-a))",
        glow: "0 0 0 1px rgb(var(--accent) / .55), 0 0 24px rgb(var(--accent) / .22)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        pulsering: { "0%": { transform: "scale(.6)", opacity: ".9" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
      },
      animation: { shimmer: "shimmer 1.4s infinite", pulsering: "pulsering 2s ease-out infinite" },
    },
  },
  plugins: [],
};
