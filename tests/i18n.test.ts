import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";
import { isLocale, LANGUAGE_STORAGE_KEY, LanguageSwitcher, LocaleProvider, translate } from "../lib/i18n";
import { messages } from "../lib/i18n-messages";
import { dateLabel, timeLabel } from "../lib/demo-data";

test("supported locales and the browser storage key stay explicit", () => {
  for (const locale of ["en", "kk", "ru"]) assert.equal(isLocale(locale), true);
  for (const locale of ["kk-KZ", "ru-RU", "", null, undefined, "../ru"]) assert.equal(isLocale(locale), false);
  assert.equal(LANGUAGE_STORAGE_KEY, "biletflow-locale");
});

test("Kazakh and Russian translate primary labels while English and unknown content retain their source", () => {
  assert.equal(translate("kk", "Language"), "Тіл");
  assert.equal(translate("ru", "Language"), "Язык");
  assert.equal(translate("en", "Language"), "Language");
  const customTitle = "My event 287ba5f0 / Алматы";
  for (const locale of ["en", "kk", "ru"] as const) assert.equal(translate(locale, customTitle), customTitle);
});

test("interpolation preserves zero, unknown placeholders and supplied content", () => {
  assert.equal(translate("ru", "{count} unread notifications", { count: 0 }), "Непрочитанных уведомлений: 0");
  assert.equal(translate("kk", "{count} unread notifications", { count: 5 }), "Оқылмаған хабарландырулар: 5");
  assert.equal(translate("en", "{name}: {missing}", { name: "Dulat {count}" }), "Dulat {count}: {missing}");
  assert.equal(translate("en", "{toString}"), "{toString}");
});

test("every catalog entry has both translations with matching interpolation parameters", () => {
  const placeholders = (value: string) => [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
  for (const [source, translations] of Object.entries(messages)) {
    assert.ok(translations.kk.trim(), `Kazakh missing: ${source}`);
    assert.ok(translations.ru.trim(), `Russian missing: ${source}`);
    assert.deepEqual(placeholders(translations.kk), placeholders(source), `Kazakh parameters: ${source}`);
    assert.deepEqual(placeholders(translations.ru), placeholders(source), `Russian parameters: ${source}`);
  }
});

test("all explicitly translated static UI strings exist in both catalogs", () => {
  const files = readdirSync(join(process.cwd(), "components")).filter((name) => name.endsWith(".tsx")).map((name) => join("components", name));
  files.push(join("app", "page.tsx"));
  const missing = new Set<string>();
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const text = node.arguments[0].text;
        if (!messages[text]?.kk || !messages[text]?.ru) missing.add(`${file}: ${text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual([...missing], []);
});

test("server rendering starts in English and does not require browser storage", () => {
  const markup = renderToString(createElement(LocaleProvider, null, createElement(LanguageSwitcher)));
  assert.match(markup, /aria-label="Language"/);
  assert.match(markup, /<option[^>]*value="en"[^>]*selected="">English/);
  assert.match(markup, /Қазақша/);
  assert.match(markup, /Русский/);
});

test("Kazakh dates use numeric months and time-only labels stay in UTC+05", () => {
  const instant = "2026-12-01T14:00:00Z";
  const numeric = dateLabel(instant, { weekday: "long", year: "numeric" }, "kk-KZ");
  assert.doesNotMatch(numeric, /[A-Za-z]/);
  assert.match(numeric, /2026/);
  assert.doesNotThrow(() => dateLabel(instant, { dateStyle: "long", timeStyle: "short" }, "kk-KZ"));
  assert.equal(timeLabel(instant, "kk-KZ"), "19:00");
  assert.match(dateLabel(instant, { month: "long" }, "en-GB"), /December/);
});
