import type { Transition, Variants } from "motion/react";

export const ease = [0.22, 1, 0.36, 1] as const;
export const spring: Transition = { type: "spring", stiffness: 320, damping: 32 };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14 } },
};

export const listItem: Variants = {
  initial: { opacity: 0, x: -6 },
  animate: (i: number) => ({ opacity: 1, x: 0, transition: { delay: Math.min(i, 12) * 0.02, duration: 0.2, ease } }),
};
