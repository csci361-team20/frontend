import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createTicketPdf, ticketDateLabel, ticketExportDetails, ticketPdfFilename } from "../lib/ticket-export";
import type { Order } from "../lib/demo-data";

const order: Order = {
  id: "order-123",
  userId: "user-123",
  eventId: "event-123",
  eventTitle: "Қазақша концерт — Алматы кеші",
  eventDate: "2026-11-05T19:00:00+05:00",
  venue: "Республика сарайы",
  city: "Алматы",
  name: "Әлия Ғалымқызы",
  email: "private@example.com",
  createdAt: "2026-10-29T10:00:00Z",
  lines: [{ ticketId: "standard", name: "Standard", price: 5000, quantity: 2, admissions: [{ id: "BF-DEMO-ONE", checkedIn: false }, { id: "BF-DEMO-TWO", checkedIn: false }] }],
  total: 10000,
  status: "confirmed",
};

test("export selects exactly the existing admission and never creates a new ticket identity", () => {
  const selected = ticketExportDetails(order, order.lines[0].admissions[1], "Standard");
  assert.equal(selected.admissionId, "BF-DEMO-TWO");
  assert.equal(selected.qrValue, "BF-DEMO-TWO");
  assert.equal(order.lines[0].admissions.length, 2);
  assert.equal(selected.status, "DEMO — NOT VALID FOR ENTRY");
});

test("ticket export excludes email, order totals and payment data", () => {
  const ticket = ticketExportDetails(order, order.lines[0].admissions[0], "Standard");
  assert.equal(JSON.stringify(ticket).includes(order.email), false);
  assert.equal("total" in ticket, false);
  assert.equal("orderId" in ticket, false);
  assert.equal(ticket.attendeeName, order.name);
});

test("ticket time uses the configured UTC+05:00 offset even with older runtime timezone data", () => {
  assert.equal(ticketDateLabel(order.eventDate), "Thursday, 5 November 2026 at 19:00");
});

test("foreign admissions and mismatched ticket types cannot be exported", () => {
  assert.throws(() => ticketExportDetails(order, { id: "someone-elses-ticket", checkedIn: false }, "Standard"));
  assert.throws(() => ticketExportDetails(order, order.lines[0].admissions[0], "VIP"));
});

test("cancelled or already scanned tickets export with explicit invalid status", () => {
  assert.equal(ticketExportDetails({ ...order, status: "cancelled" }, order.lines[0].admissions[0], "Standard").status, "CANCELLED — NOT VALID FOR ENTRY");
  const scanned = structuredClone(order);
  scanned.lines[0].admissions[0].checkedIn = true;
  assert.equal(ticketExportDetails(scanned, { ...scanned.lines[0].admissions[0], checkedIn: false }, "Standard").status, "ALREADY CHECKED IN — NOT VALID FOR ENTRY");
});

test("PDF uses one A4 page, embeds Unicode names, and keeps the existing reference in its metadata", async () => {
  const font = await readFile(new URL("../public/fonts/NotoSans-Regular.ttf", import.meta.url));
  const bytes = await createTicketPdf(order, order.lines[0].admissions[1], "Standard", font);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.1);
  assert.ok(Math.abs(height - 841.89) < 0.1);
  assert.equal(pdf.getTitle(), "BiletFlow demo ticket BF-DEMO-TWO");
  assert.equal(pdf.getSubject(), "DEMO — NOT VALID FOR ENTRY");
  assert.equal(pdf.getKeywords()?.includes("BF-DEMO-TWO"), true);
  assert.equal(pdf.getKeywords()?.includes("BF-DEMO-ONE"), false);
  assert.ok(bytes.byteLength > 1000);
});

test("PDF filenames cannot escape a download filename", () => {
  assert.equal(ticketPdfFilename("../../some:id"), "biletflow-demo-ticket-------some-id.pdf");
});
