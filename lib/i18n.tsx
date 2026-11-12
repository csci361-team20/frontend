"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { messages } from "./i18n-messages";

export type Locale = "en" | "kk" | "ru";
export type TranslationParams = Record<string, string | number>;
export const LANGUAGE_STORAGE_KEY = "biletflow-locale";
export const localeCodes: Record<Locale, string> = { en: "en-GB", kk: "kk-KZ", ru: "ru-KZ" };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "kk" || value === "ru";
}

export function translate(locale: Locale, source: string, params: TranslationParams = {}) {
  const text = locale === "en" ? source : messages[source]?.[locale] ?? source;
  return text.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder,
  );
}

let currentLocale: Locale = "en";
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function readLocale() {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    currentLocale = isLocale(value) ? value : "en";
  } catch {
    currentLocale = "en";
  }
  initialized = true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    readLocale();
    emit();
  }
  const sync = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) {
      currentLocale = isLocale(event.newValue) ? event.newValue : "en";
      emit();
    }
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", sync);
  };
}

function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  currentLocale = locale;
  initialized = true;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    emit();
    return;
  }
  emit();
}

type I18nContextValue = {
  locale: Locale;
  t: (source: string, params?: TranslationParams) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (source, params) => translate("en", source, params),
  setLocale,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, () => currentLocale, () => "en" as Locale);
  const t = useCallback((source: string, params?: TranslationParams) => translate(locale, source, params), [locale]);
  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LocalizedSkipLink() {
  const { t } = useI18n();
  return <a className="skip-link" href="#main-content">{t("Skip to content")}</a>;
}

export function LanguageSwitcher() {
  const { locale, t, setLocale } = useI18n();
  return (
    <label className="language-switcher">
      <span>{t("Language")}</span>
      <select aria-label={t("Language")} value={locale} onChange={(event) => {
        if (isLocale(event.target.value)) setLocale(event.target.value);
      }}>
        <option value="en" lang="en">English</option>
        <option value="kk" lang="kk">Қазақша</option>
        <option value="ru" lang="ru">Русский</option>
      </select>
    </label>
  );
}
