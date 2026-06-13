"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import zhDict from "./zh-CN";
import enDict from "./en-US";

export type Language = "zh-CN" | "en-US";

export interface Translations {
  [key: string]: string | Translations;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const STORAGE_KEY = "agnes_language";

const DICTS: Record<Language, Record<string, any>> = {
  "zh-CN": zhDict,
  "en-US": enDict,
};

function resolveValue(dict: Record<string, any>, key: string): string | null {
  // Try direct lookup first (for flat keys like "menu.home")
  if (key in dict && typeof dict[key] === "string") {
    return dict[key];
  }
  // Fall back to nested traversal (for dotted keys like "prompt.categories.general")
  const parts = key.split(".");
  let val: any = dict;
  for (const p of parts) {
    if (val && typeof val === "object" && p in val) {
      val = val[p];
    } else {
      return null;
    }
  }
  return typeof val === "string" ? val : null;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "zh-CN",
  setLanguage: () => {},
  t: (key: string, params?: Record<string, string | number>) => {
    const val = resolveValue(DICTS["zh-CN"], key);
    let result = val ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace("{" + k + "}", String(v));
      }
    }
    return result;
  },
});

export function getBrowserLanguage(): Language {
  if (typeof window === "undefined") return "zh-CN";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh-CN" || stored === "en-US") return stored;
  } catch (_e) { /* ignore */ }
  return "zh-CN";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh-CN");

  useEffect(() => {
    setLanguageState(getBrowserLanguage());
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_e) { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = DICTS[language];
      let result = resolveValue(dict, key) ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace("{" + k + "}", String(v));
        }
      }
      return result;
    },
    [language]
  );

  return React.createElement(LanguageContext.Provider, { value: { language, setLanguage, t } }, children);
}

export function useLanguage() {
  return useContext(LanguageContext);
}



export function useTranslation() {
  const { t, language } = useContext(LanguageContext);
  return { t, language };
}
