import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES_BY_AUDIENCE, caseRef, safeLink } from "../lib/support";

test("notification links only lead to pages on this site", () => {
  assert.equal(safeLink("/orders/1"), "/orders/1");
  assert.equal(safeLink("//evil.example/x"), null);
  assert.equal(safeLink("https://evil.example"), null);
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink(null), null);
});

test("organizers ask the platform only about account, activation, payment or technical issues", () => {
  assert.deepEqual(CATEGORIES_BY_AUDIENCE.organizer, ["account", "activation", "payment", "technical"]);
  assert.ok(!CATEGORIES_BY_AUDIENCE.attendee.includes("activation"));
});

test("case references are short and readable", () => {
  assert.equal(caseRef("442c011d-617f-4716-8beb-d05a4a7d287b"), "SC-442C011D");
});
