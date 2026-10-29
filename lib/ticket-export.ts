import type { Admission, Order } from "./demo-data";

export type ExportedTicket = {
  admissionId: string;
  qrValue: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  attendeeName: string;
  ticketType: string;
  status: "DEMO — NOT VALID FOR ENTRY" | "CANCELLED — NOT VALID FOR ENTRY" | "ALREADY CHECKED IN — NOT VALID FOR ENTRY";
};

export function ticketExportDetails(order: Order, admission: Admission, ticketType: string): ExportedTicket {
  const line = order.lines.find((item) => item.admissions.some((ticket) => ticket.id === admission.id));
  const selected = line?.admissions.find((ticket) => ticket.id === admission.id);
  if (!line || !selected || line.name !== ticketType) throw new Error("This ticket does not belong to the selected order and ticket type.");
  if (!selected.id.trim()) throw new Error("This ticket has no admission reference.");
  if (!Number.isFinite(new Date(order.eventDate).getTime())) throw new Error("This ticket has no valid event time.");
  return {
    admissionId: selected.id,
    qrValue: selected.id,
    eventTitle: order.eventTitle,
    eventDate: order.eventDate,
    venue: [order.venue, order.city].filter(Boolean).join(", "),
    attendeeName: order.name,
    ticketType: line.name,
    status: order.status === "cancelled" ? "CANCELLED — NOT VALID FOR ENTRY" : selected.checkedIn ? "ALREADY CHECKED IN — NOT VALID FOR ENTRY" : "DEMO — NOT VALID FOR ENTRY",
  };
}

export function ticketPdfFilename(id: string): string {
  return `biletflow-demo-ticket-${id.replace(/[^a-z0-9_-]/gi, "-")}.pdf`;
}

export function ticketDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Etc/GMT-5", dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

export async function createTicketPdf(order: Order, admission: Admission, ticketType: string, fontBytes: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const ticket = ticketExportDetails(order, admission, ticketType);
  const [{ PDFDocument, PageSizes, rgb }, { default: fontkit }, { default: QRCode }] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
    import("qrcode"),
  ]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(fontBytes);
  const page = document.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const ink = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.35, 0.35, 0.35);
  const margin = 44;
  const contentWidth = width - margin * 2;
  const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  const text = (value: string, x: number, y: number, size: number, color = ink) => page.drawText(clean(value), { x, y, size, font, color });
  const wrap = (value: string, size: number, available: number) => {
    const lines: string[] = [];
    let current = "";
    for (const word of clean(value).split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= available) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      for (const character of word) {
        if (current && font.widthOfTextAtSize(current + character, size) > available) {
          lines.push(current);
          current = "";
        }
        current += character;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const block = (value: string, y: number, preferred: number, maxLines: number, available = contentWidth, x = margin) => {
    let size = preferred;
    let lines = wrap(value, size, available);
    while (lines.length > maxLines && size > 6) {
      size -= 0.5;
      lines = wrap(value, size, available);
    }
    if (lines.length > maxLines) throw new Error("The ticket details are too long to fit safely on an A4 ticket.");
    for (const [index, line] of lines.entries()) text(line, x, y - index * (size + 4), size);
    return y - lines.length * (size + 4);
  };

  document.setTitle(`BiletFlow demo ticket ${ticket.admissionId}`);
  document.setSubject(ticket.status);
  document.setCreator("BiletFlow");
  document.setProducer("BiletFlow");
  document.setKeywords(["BiletFlow", "demo", "not valid for entry", ticket.admissionId]);
  text("BiletFlow.", margin, height - 66, 27);
  text("YOUR DEMO TICKET · A4 PRINT COPY", margin, height - 87, 9, muted);
  page.drawLine({ start: { x: margin, y: height - 104 }, end: { x: width - margin, y: height - 104 }, thickness: 1, color: ink });
  page.drawRectangle({ x: margin, y: height - 173, width: contentWidth, height: 50, color: rgb(0.94, 0.94, 0.94), borderWidth: 1, borderColor: ink });
  block(ticket.status, height - 144, 15, 2, contentWidth - 24, margin + 12);
  let y = block(ticket.eventTitle, height - 208, 23, 3);
  y -= 15;
  text("WHEN · ALMATY TIME (UTC+05:00)", margin, y, 9, muted);
  y = block(ticketDateLabel(ticket.eventDate), y - 21, 12, 2);
  y -= 16;
  text("WHERE", margin, y, 9, muted);
  y = block(ticket.venue, y - 21, 12, 2);
  y -= 15;
  text("ATTENDEE", margin, y, 9, muted);
  y = block(ticket.attendeeName, y - 21, 14, 2);
  y -= 15;
  text("TICKET TYPE", margin, y, 9, muted);
  block(ticket.ticketType, y - 21, 12, 2, contentWidth - 202);
  const qr = await QRCode.toDataURL(ticket.qrValue, { errorCorrectionLevel: "M", margin: 4, width: 600, color: { dark: "#000000", light: "#ffffff" } });
  const qrImage = await document.embedPng(qr);
  page.drawImage(qrImage, { x: width - margin - 184, y: 119, width: 184, height: 184 });
  text("EXISTING DEMO ADMISSION REFERENCE", margin, 149, 8, muted);
  block(ticket.admissionId, 130, 10, 2, contentWidth - 202);
  page.drawLine({ start: { x: margin, y: 100 }, end: { x: width - margin, y: 100 }, thickness: 1, color: ink });
  text("DEMONSTRATION ONLY. THIS IS NOT AN ISSUED ADMISSION TICKET.", margin, 78, 9);
  text("The QR contains the existing demo ticket reference. No payment details are included.", margin, 61, 8, muted);
  return document.save();
}
