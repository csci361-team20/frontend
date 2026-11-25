import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../lib/csv";
import { canManageRole, fromLocalInputs, toLocalInputs } from "../lib/organizer";

test("CSV cells are quoted and spreadsheet formulas neutralised", () => {
  assert.equal(csvCell("Aliya"), "Aliya");
  assert.equal(csvCell('Say "hi", please'), '"Say ""hi"", please"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("-5"), "'-5");
  assert.equal(csvCell(null), "");
  assert.equal(toCsv([["Name", "Seat"], ["Bolat", null]]), "Name,Seat\r\nBolat,\r\n");
});

test("event times round-trip through the Kazakhstan date and time inputs", () => {
  assert.deepEqual(toLocalInputs("2026-12-20T14:00:00Z"), { date: "2026-12-20", time: "19:00" });
  assert.deepEqual(toLocalInputs(null), { date: "", time: "" });
  assert.equal(fromLocalInputs("2026-12-20", "19:00"), "2026-12-20T19:00:00+05:00");
  assert.equal(fromLocalInputs("", "19:00"), null);
});

test("only owners and managers run an event", () => {
  assert.ok(canManageRole("owner"));
  assert.ok(canManageRole("manager"));
  assert.ok(!canManageRole("checkin_staff"));
  assert.ok(!canManageRole(undefined));
});
