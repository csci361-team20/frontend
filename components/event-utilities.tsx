"use client";

import { useId, useState } from "react";
import { calendarFilename, calendarLinks, createCalendarFile, type CalendarEvent } from "@/lib/calendar";
import { createTicketPdf, ticketPdfFilename } from "@/lib/ticket-export";
import type { Admission, Order } from "@/lib/demo-data";
import { Icon } from "./primitives";
import "./event-utilities.css";
import { useI18n } from "@/lib/i18n";

export type { CalendarEvent } from "@/lib/calendar";

const localUtilityErrors = new Set([
  "The event time is unavailable.",
  "A public event URL is required.",
  "The event end must be after its start.",
  "An event reference is required.",
  "The ticket font could not be loaded. Please try again.",
  "This ticket does not belong to the selected order and ticket type.",
  "This ticket has no admission reference.",
  "This ticket has no valid event time.",
  "The ticket details are too long to fit safely on an A4 ticket.",
]);

function utilityError(reason: unknown, fallback: string, t: (source: string) => string) {
  if (!(reason instanceof Error)) return t(fallback);
  return localUtilityErrors.has(reason.message) ? t(reason.message) : reason.message;
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function CalendarActions({ event }: { event: CalendarEvent }) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const hintId = useId();
  let links: ReturnType<typeof calendarLinks> = null;
  let calendarError = "";
  try {
    links = calendarLinks(event);
  } catch (reason) {
    calendarError = utilityError(reason, "The event calendar is unavailable.", t);
  }
  function download() {
    try {
      downloadFile(new Blob([createCalendarFile(event)], { type: "text/calendar;charset=utf-8" }), calendarFilename(event));
      setError("");
    } catch (reason) {
      setError(utilityError(reason, "The calendar file could not be downloaded.", t));
    }
  }
  return (
    <section className="event-utilities" aria-label={t("Event calendar")}>
      <div className="event-utility-actions">
        <button type="button" className="btn btn-secondary" onClick={download} disabled={!!calendarError} aria-describedby={hintId}>
          <Icon name="calendar" size={16} /> {event.status === "cancelled" ? t("Download cancellation (.ics)") : t("Add to calendar (.ics)")}
        </button>
        {links && <>
          <a href={links.google} className="event-utility-link" target="_blank" rel="noopener noreferrer">{t("Google Calendar")}{" "}<Icon name="external" size={14} /></a>
          <a href={links.outlook} className="event-utility-link" target="_blank" rel="noopener noreferrer">{t("Outlook")} <Icon name="external" size={14} /></a>
        </>}
      </div>
      <p id={hintId} className="event-utility-hint">{calendarError || (event.status === "cancelled" ? t("Import this cancellation into the calendar where you saved the event.") : event.endAt ? t("Times use Almaty time (UTC+05:00). Import a new .ics after event changes to update the saved event.") : t("Duration has not been provided. The .ics includes the start time in Almaty time; no end time is assumed."))}</p>
      {error && <p className="event-utility-error" role="alert">{error}</p>}
    </section>
  );
}

let fontRequest: Promise<ArrayBuffer> | null = null;

function loadTicketFont() {
  fontRequest ??= fetch("/fonts/NotoSans-Regular.ttf").then((response) => {
    if (!response.ok) throw new Error("The ticket font could not be loaded. Please try again.");
    return response.arrayBuffer();
  }).catch((error) => {
    fontRequest = null;
    throw error;
  });
  return fontRequest;
}

export function TicketExportActions({ order, admission, ticketType }: { order: Order; admission: Admission; ticketType: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hintId = useId();
  async function exportPdf(print = false) {
    const preview = print ? window.open("", "_blank") : null;
    if (print && !preview) {
      setError(t("Allow this browser to open the printable PDF, or download it and print from your PDF reader."));
      return;
    }
    if (preview) {
      preview.opener = null;
      preview.document.title = t("Preparing BiletFlow ticket");
      preview.document.body.textContent = t("Preparing your printable demo ticket…");
    }
    setBusy(true);
    setError("");
    try {
      const bytes = await createTicketPdf(order, admission, ticketType, await loadTicketFont());
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      if (preview) {
        const url = URL.createObjectURL(blob);
        preview.location.replace(url);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        downloadFile(blob, ticketPdfFilename(admission.id));
      }
    } catch (reason) {
      preview?.close();
      setError(utilityError(reason, "The ticket PDF could not be created. Please try again.", t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="event-utilities ticket-export-utilities" aria-busy={busy}>
      <div className="event-utility-actions">
        <button type="button" className="btn btn-secondary" onClick={() => void exportPdf()} disabled={busy} aria-describedby={hintId}><Icon name="download" size={16} />{busy ? t("Preparing PDF…") : t("Download PDF")}</button>
        <button type="button" className="event-utility-link" onClick={() => void exportPdf(true)} disabled={busy} aria-describedby={hintId}>{t("Open printable PDF")}{" "}<Icon name="external" size={14} /></button>
      </div>
      <p className="event-utility-hint" id={hintId}>{t("A4 demo ticket. Use your PDF viewer’s print command. Not valid for entry.")}</p>
      {error && <p className="event-utility-error" role="alert">{error}</p>}
    </div>
  );
}
