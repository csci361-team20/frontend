"use client";
/** The site's language in React: the provider, `useT()` and the switch. */
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getLang, LANG_COOKIE, LANG_NAMES, LANGS, setCurrentLang, setRenderLang, startLang, subscribeLang, translators, type Lang, type Translate } from "@/lib/i18n";
import { currentSession, refreshSession } from "./session-provider";

const ServerLang = createContext<Lang>("en");

/** Gives every component the language the server rendered the page in. */
export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  // The first render in the browser starts from the server's language
  if (typeof window !== "undefined") startLang(initial);
  return <ServerLang.Provider value={initial}>{children}</ServerLang.Provider>;
}

export function useLang(): Lang {
  const initial = useContext(ServerLang);
  return useSyncExternalStore(subscribeLang, getLang, () => initial);
}

/** The translator for the current language; components re-render when it changes. */
export function useT(): Translate {
  const lang = useLang();
  setRenderLang(lang);
  return translators[lang];
}

/** Use `lang` in this browser, without touching the profile. */
export function applyLanguage(lang: Lang) {
  setCurrentLang(lang);
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = lang;
}

/**
 * Change the site's language. A signed-in account keeps it on its profile, so
 * emails, notifications and the mobile app use it too.
 */
export async function changeLanguage(lang: Lang) {
  applyLanguage(lang);
  const session = currentSession();
  if (session.status === "signed-in" && session.user.preferred_language !== lang) {
    await api.users.updateMe({ preferred_language: lang });
    await refreshSession();
  }
}

/** Қаз / Рус / Eng buttons. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t("Language")}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={t.lang === lang}
          title={failed ? t("The language changed here, but could not be saved to your profile.") : LANG_NAMES[lang]}
          onClick={() => {
            setFailed(false);
            changeLanguage(lang)
              .catch(() => setFailed(true))
              // Server-rendered parts (home page, page titles) follow the new cookie
              .finally(() => router.refresh());
          }}
        >
          {lang === "kk" ? "ҚАЗ" : lang === "ru" ? "РУС" : "ENG"}
        </button>
      ))}
    </div>
  );
}
