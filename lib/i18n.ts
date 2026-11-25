/**
 * The site's language: Kazakh, Russian or English.
 *
 * Text in the pages is written in English and wrapped in `t("…")`; the Russian
 * and Kazakh versions live in `locales/{ru,kk}.json`, keyed by the English
 * text. Missing entries fall back to English. `{name}` placeholders are filled
 * from the second argument.
 *
 * The language is kept in the `biletflow-lang` cookie, so the server renders
 * pages in it; a signed-in profile's language replaces it after sign-in.
 */
import ru from "@/locales/ru.json";
import kk from "@/locales/kk.json";

export type Lang = "en" | "ru" | "kk";
export const LANGS: Lang[] = ["kk", "ru", "en"];
export const LANG_NAMES: Record<Lang, string> = { kk: "Қазақша", ru: "Русский", en: "English" };
export const LANG_COOKIE = "biletflow-lang";

const dictionaries: Record<Exclude<Lang, "en">, Record<string, string>> = { ru, kk };

export type Vars = Record<string, string | number | null | undefined>;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name] ?? "") : match)) : text;

export const isLang = (value: unknown): value is Lang => value === "en" || value === "ru" || value === "kk";

/** Translate English `text` into `lang`. */
export function translate(lang: Lang, text: string, vars?: Vars) {
  return fill(lang === "en" ? text : (dictionaries[lang][text] ?? text), vars);
}

/** Which plural form to use: 0 = one, 1 = few, 2 = many (Russian rules). */
function pluralForm(lang: Lang, n: number) {
  if (lang === "kk") return 0;
  if (lang === "en") return n === 1 ? 0 : 1;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
}

/**
 * Count-dependent text: `plural(lang, 3, "{n} ticket", "{n} tickets")`. The
 * dictionary entry is keyed "one|other" and holds the forms separated by "|"
 * (Russian: one|few|many; Kazakh: a single form).
 */
export function plural(lang: Lang, n: number, one: string, other: string, vars?: Vars) {
  const all = { n, ...vars };
  const forms = lang === "en" ? undefined : dictionaries[lang][`${one}|${other}`]?.split("|");
  if (!forms) return fill(n === 1 ? one : other, all);
  return fill(forms[Math.min(pluralForm(lang, n), forms.length - 1)], all);
}

/** Marks English text for translation where it is defined; translate it with `t()` where it is shown. */
export const tk = (text: string) => text;

/** Locale for dates and numbers. */
export const localeOf = (lang: Lang) => (lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-GB");

/** First supported language in an Accept-Language header. */
export function langFromHeader(header: string | null | undefined): Lang | null {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return null;
}

export type Translate = ((text: string, vars?: Vars) => string) & {
  lang: Lang;
  locale: string;
  plural: (n: number, one: string, other: string, vars?: Vars) => string;
};

const makeTranslator = (lang: Lang): Translate =>
  Object.assign((text: string, vars?: Vars) => translate(lang, text, vars), {
    lang,
    locale: localeOf(lang),
    plural: (n: number, one: string, other: string, vars?: Vars) => plural(lang, n, one, other, vars),
  });
export const translators: Record<Lang, Translate> = { en: makeTranslator("en"), ru: makeTranslator("ru"), kk: makeTranslator("kk") };

/* ---- the browser's current language (set by <LanguageProvider>) ---- */

let current: Lang | null = null;
const listeners = new Set<() => void>();

export const getLang = (): Lang => current ?? "en";

export function setCurrentLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  listeners.forEach((listener) => listener());
}

/**
 * While the server renders a page, components set the request's language
 * just before they run, so helpers that call `tr()` and format dates match
 * what the browser renders.
 */
export function setRenderLang(lang: Lang) {
  if (typeof window === "undefined") current = lang;
}

/** Set the language once, on the first render in the browser. */
export function startLang(lang: Lang) {
  if (current === null) current = lang;
}

export function subscribeLang(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Translate into the current language outside a component (helpers called while rendering). */
export const tr = (text: string, vars?: Vars) => translate(getLang(), text, vars);

/** A label map whose values are read in the current language. */
export function translatedRecord<K extends string>(record: Record<K, string>): Record<K, string> {
  return new Proxy(record, {
    get: (target, key) => (typeof key === "string" && key in target ? tr(target[key as K]) : Reflect.get(target, key)),
  });
}

/** Options whose `label` is read in the current language. */
export function translatedOptions<O extends { label: string }>(options: readonly O[]): O[] {
  return options.map((option) => {
    const english = option.label;
    const copy = { ...option };
    Object.defineProperty(copy, "label", { get: () => tr(english), enumerable: true });
    return copy;
  });
}

/* ---- dates ---- */

const KK_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
const KK_MONTHS_SHORT = ["қаң.", "ақп.", "нау.", "сәу.", "мам.", "мау.", "шіл.", "там.", "қыр.", "қаз.", "қар.", "жел."];
const KK_WEEKDAYS = ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"];
const KK_WEEKDAYS_SHORT = ["жс", "дс", "сс", "ср", "бс", "жм", "сн"];

/**
 * Format a date in `lang`. Kazakh is put together here, because many browsers
 * and phones lack Kazakh month names and would show "M11" instead.
 */
export function formatDate(lang: Lang, date: Date, options: Intl.DateTimeFormatOptions) {
  if (lang !== "kk") return new Intl.DateTimeFormat(localeOf(lang), options).format(date);
  const { dateStyle, timeStyle, timeZone } = options;
  const want = dateStyle || timeStyle
    ? {
        day: dateStyle ? "numeric" : undefined,
        month: dateStyle === "long" || dateStyle === "full" ? "long" : dateStyle ? "short" : undefined,
        year: dateStyle ? "numeric" : undefined,
        weekday: dateStyle === "full" ? "long" : undefined,
        hour: timeStyle ? "2-digit" : undefined,
        minute: timeStyle ? "2-digit" : undefined,
      }
    : options;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const month = Number(parts.month) - 1;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const day = [
    want.day ? String(Number(parts.day)) : "",
    want.month ? (want.month === "long" ? KK_MONTHS[month] : want.month === "numeric" || want.month === "2-digit" ? parts.month : KK_MONTHS_SHORT[month]) : "",
    want.year ? `${parts.year} ж.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const out = [day, want.weekday ? (want.weekday === "long" ? KK_WEEKDAYS[weekday] : KK_WEEKDAYS_SHORT[weekday]) : ""].filter(Boolean).join(", ");
  const time = want.hour ? `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}` : "";
  return [out, time].filter(Boolean).join(", ");
}
