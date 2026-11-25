/** Orders, tickets, quotes and seat maps as the BiletFlow backend returns them. */

import { tk, translatedRecord } from "./i18n";

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "refunded" | "expired";
export type TicketStatus = "valid" | "checked_in" | "cancelled" | "refunded";

export type OrderItem = {
  id: string;
  ticket_type_id: string;
  ticket_type_name: string;
  unit_price_kzt: number;
  quantity: number;
  subtotal_kzt: number;
  seats?: string[] | null;
};

export type OrderTicket = {
  id: string;
  order_item_id: string;
  ticket_type_name: string;
  attendee_name: string;
  attendee_email: string;
  status: TicketStatus;
  created_at: string;
  seat?: string | null;
};

export type Payment = {
  id: string;
  status: "succeeded" | "failed" | "pending" | string;
  amount_kzt: number;
  processing_fee_kzt: number;
  provider: string;
  is_simulated: boolean;
  failure_reason: string | null;
  created_at: string;
};

export type Refund = {
  id: string;
  order_id: string;
  amount_kzt: number;
  status: string;
  reason: string;
  initiated_by_name: string | null;
  is_simulated: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  event_id: string;
  event_title: string;
  event_start_at: string;
  event_timezone: string;
  user_id: string;
  buyer_name: string;
  buyer_email: string;
  status: OrderStatus;
  subtotal_kzt: number;
  discount_kzt: number;
  promo_code: string | null;
  total_kzt: number;
  expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  items: OrderItem[];
  tickets: OrderTicket[];
  payments: Payment[];
  refund?: Refund | null;
  calendar_links?: { ics?: string; google?: string; outlook?: string; yahoo?: string };
};

export type TicketDetail = {
  id: string;
  order_id: string;
  status: TicketStatus;
  event: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    timezone: string;
    venue_name: string | null;
    venue_address: string | null;
    city: string | null;
  };
  ticket_type_name: string;
  attendee_name: string;
  attendee_email: string;
  seat?: { section: string; row: string; number: string } | null;
  qr_payload: string | null;
  issued_at: string;
};

export type Quote = {
  lines: { ticket_type_id: string; name: string; unit_price_kzt: number; quantity: number; subtotal_kzt: number }[];
  subtotal_kzt: number;
  discount_kzt: number;
  total_kzt: number;
  promo?: { code: string; applied: boolean; message: string; campaign_name?: string | null } | null;
};

export type SeatStatus = "available" | "held" | "sold" | "unavailable";
export type Seat = {
  id: string;
  number: string;
  category: string;
  is_accessible: boolean;
  status: SeatStatus;
  ticket_type_id: string | null;
  price_kzt: number | null;
  label: string;
};
export type SeatMap = {
  event_id: string;
  venue_id: string;
  venue_name: string;
  sections: { name: string; rows: { label: string; seats: Seat[] }[] }[];
  counts: Record<string, number>;
  legend: Record<string, string>;
};

export type Attendee = { name: string; email: string };

/** What the buyer picked: ticket types and quantities, or seats. */
export type Selection = { items: { ticket_type_id: string; quantity: number }[]; seat_ids: string[] };

/** Read the ticket choice passed from the event page (?tickets={"id":2}). */
export function parseSelection(raw?: string, seats?: string): Selection {
  const items: Selection["items"] = [];
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      for (const [id, value] of Object.entries(parsed))
        if (/^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(value) && Number(value) > 0 && Number(value) <= 50)
          items.push({ ticket_type_id: id, quantity: Number(value) });
  } catch {
    /* An unreadable choice counts as empty */
  }
  const seat_ids = (seats ?? "")
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 20);
  return { items, seat_ids };
}

export const ticketCount = (selection: Selection) =>
  selection.seat_ids.length || selection.items.reduce((s, i) => s + i.quantity, 0);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = translatedRecord({
  pending: tk("Awaiting payment"),
  confirmed: tk("Confirmed"),
  cancelled: tk("Cancelled"),
  refunded: tk("Refunded"),
  expired: tk("Expired"),
});

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = translatedRecord({
  valid: tk("Ready for your night"),
  checked_in: tk("Checked in"),
  cancelled: tk("Cancelled"),
  refunded: tk("Refunded"),
});

/** "Upcoming", "past" or "closed" for the My tickets tabs. */
export function orderTab(order: Order, now = Date.now()): "upcoming" | "past" | "closed" {
  if (order.status !== "confirmed" && order.status !== "pending") return "closed";
  return new Date(order.event_start_at).getTime() >= now - 6 * 3_600_000 ? "upcoming" : "past";
}

/** Minutes and seconds left on a checkout hold, or null once it has run out. */
export function holdLeft(expiresAt: string | null, now = Date.now()) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
