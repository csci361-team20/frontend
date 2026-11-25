/**
 * Translations: every English text the site wraps in t(), tr(), tk() or
 * t.plural() has a Russian and a Kazakh version with the same {placeholders},
 * and the helpers pick the right words and plural forms.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ru from "../locales/ru.json";
import kk from "../locales/kk.json";
import { formatDate, langFromHeader, plural, translate } from "../lib/i18n";

const ROOT = join(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });

const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;
const unquote = (s: string) => JSON.parse(`"${s}"`) as string;

function keys() {
  const found = new Map<string, string>();
  for (const file of ["app", "components", "lib"].flatMap((dir) => files(join(ROOT, dir)))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(new RegExp(String.raw`\b(?:t|tr|tk)\(\s*${STRING}`, "g"))) found.set(unquote(m[1]), file);
    for (const m of src.matchAll(new RegExp(String.raw`\bplural\([^,]+,\s*${STRING},\s*${STRING}`, "g"))) found.set(`${unquote(m[1])}|${unquote(m[2])}`, file);
  }
  return found;
}

const placeholders = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join();

for (const [name, dictionary] of [["Russian", ru], ["Kazakh", kk]] as const) {
  const dict = dictionary as Record<string, string>;

  test(`every text has a ${name} translation`, () => {
    const missing = [...keys()].filter(([key]) => !dict[key]?.trim()).map(([key, file]) => `${key}   (${file.slice(ROOT.length + 1)})`);
    assert.deepEqual(missing, [], `${missing.length} missing`);
  });

  test(`${name} translations keep the placeholders`, () => {
    const wrong = [...keys().keys()]
      .filter((key) => dict[key])
      .flatMap((key) => dict[key].split("|").filter((form) => placeholders(form) !== placeholders(key.split("|")[0])).map((form) => `${key} → ${form}`));
    assert.deepEqual(wrong, []);
  });
}

test("translate falls back to English and fills placeholders", () => {
  assert.equal(translate("ru", "Sign in"), "Войти");
  assert.equal(translate("kk", "Sign in"), "Кіру");
  assert.equal(translate("en", "Sign in"), "Sign in");
  assert.equal(translate("ru", "A text nobody translated"), "A text nobody translated");
  assert.equal(translate("ru", "from {price}", { price: "₸5,000" }), "от ₸5,000");
});

test("Russian plurals use one, few and many forms", () => {
  const tickets = (n: number) => plural("ru", n, "{n} ticket", "{n} tickets");
  assert.equal(tickets(1), "1 билет");
  assert.equal(tickets(3), "3 билета");
  assert.equal(tickets(5), "5 билетов");
  assert.equal(tickets(11), "11 билетов");
  assert.equal(tickets(21), "21 билет");
  assert.equal(tickets(24), "24 билета");
  assert.equal(plural("kk", 5, "{n} ticket", "{n} tickets"), "5 билет");
  assert.equal(plural("en", 1, "{n} ticket", "{n} tickets"), "1 ticket");
  assert.equal(plural("en", 2, "{n} ticket", "{n} tickets"), "2 tickets");
});

test("the browser's preferred language is read from Accept-Language", () => {
  assert.equal(langFromHeader("ru-RU,ru;q=0.9,en;q=0.8"), "ru");
  assert.equal(langFromHeader("kk-KZ"), "kk");
  assert.equal(langFromHeader("de-DE,en;q=0.5"), "en");
  assert.equal(langFromHeader("de-DE"), null);
  assert.equal(langFromHeader(null), null);
});

test("Kazakh dates use Kazakh month and weekday names everywhere", () => {
  const date = new Date("2026-11-26T15:30:00Z"); // 20:30 in Almaty
  const zone = "Asia/Almaty";
  assert.equal(formatDate("kk", date, { timeZone: zone, day: "numeric", month: "short" }), "26 қар.");
  assert.equal(formatDate("kk", date, { timeZone: zone, weekday: "short", day: "numeric", month: "short" }), "26 қар., бс");
  assert.equal(formatDate("kk", date, { timeZone: zone, day: "numeric", month: "long", year: "numeric" }), "26 қараша 2026 ж.");
  assert.equal(formatDate("kk", date, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }), "20:30");
  assert.equal(formatDate("kk", date, { timeZone: zone, dateStyle: "medium", timeStyle: "short" }), "26 қар. 2026 ж., 20:30");
  assert.equal(formatDate("ru", date, { timeZone: zone, day: "numeric", month: "long" }), "26 ноября");
});
