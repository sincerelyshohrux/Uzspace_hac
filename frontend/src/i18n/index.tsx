import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en } from "./en";
import { uz, type Dict } from "./uz";

export type Lang = "uz" | "en";
export type I18nKey = keyof Dict;
type Vars = Record<string, string | number>;

const dicts: Record<Lang, Dict> = { uz, en };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: I18nKey, vars?: Vars) => string;
}
const I18nCtx = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const v = localStorage.getItem("ss-lang");
    if (v === "uz" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "uz";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("ss-lang", l);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (k, vars) => {
        let s: string = dicts[lang][k] ?? String(k);
        if (vars) for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
        return s;
      },
    }),
    [lang, setLang],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("I18nProvider missing");
  return c;
}
