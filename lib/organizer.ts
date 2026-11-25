/** Organizer-side data as the BiletFlow backend returns it. */

import type { ApiEvent, TicketType } from "./events";
import { dateTimeZone, tk, translatedRecord } from "./i18n";

export type StaffRole = "owner" | "manager" | "checkin_staff" | "support_staff";

export type MyEvent = ApiEvent & { my_role: StaffRole };

export const ROLE_LABELS: Record<StaffRole, string> = translatedRecord({
  owner: tk("Owner"),
  manager: tk("Manager"),
  checkin_staff: tk("Check-in staff"),
  support_staff: tk("Support staff"),
});

/** Owners and managers run the event; the others help on the day. */
export const canManageRole = (role?: string | null) => role === "owner" || role === "manager";

export type MyOrganizerProfile = {
  id: string;
  user_id: string;
  display_name: string;
  verification_status: "pending" | "verified" | "rejected" | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  description: string | null;
  verified_at: string | null;
  legal_name: string | null;
  tax_id_masked: string | null;
  verification_submitted_at: string | null;
};

export type PayoutAccount = {
  holder_name: string;
  bank_name: string;
  iban_masked: string;
  is_verified: boolean;
  is_simulated: boolean;
};

export type OverviewRow = {
  event_id: string;
  title: string;
  lifecycle: string;
  start_at: string;
  capacity: number;
  tickets_sold: number;
  percent_sold: number;
  checked_in: number;
  net_revenue_kzt: number;
};

export type TicketTypeStats = TicketType & {
  sold: number;
  reserved: number;
  refunded: number;
  checked_in: number;
};

export type TicketStats = {
  event_id: string;
  capacity: number;
  ticket_types: TicketTypeStats[];
  totals: { quantity: number; available: number; sold: number; reserved: number; refunded: number; checked_in: number };
};

export type SalesSummary = {
  confirmed_orders: number;
  tickets_sold: number;
  gross_sales_kzt: number;
  processing_fees_kzt: number;
  refunds_kzt: number;
  estimated_payout_kzt: number;
  is_simulated: boolean;
};

export type Attendee = {
  ticket_id: string;
  order_id: string;
  attendee_name: string;
  attendee_email: string;
  ticket_type_name: string;
  status: "valid" | "checked_in" | "cancelled" | "refunded";
  issued_at: string;
  checked_in_at: string | null;
  seat: string | null;
};

export type StaffMember = {
  id: string;
  event_id: string;
  user_id: string;
  role: StaffRole;
  full_name: string;
  email: string;
};

export type Activation = {
  status: "pending" | "active" | "suspended";
  fee_kzt: number;
  fee_paid_at: string | null;
  terms_version: string;
  terms_accepted_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  checklist: { item: string; label: string; done: boolean; hint: string | null }[];
  can_activate: boolean;
  is_simulated: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  discount_label: string;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  remaining_redemptions: number | null;
  is_active: boolean;
  ticket_type_ids: string[];
  link_url: string;
  stats: { redemptions: number; tickets_sold: number; gross_revenue_kzt: number; discount_kzt: number; net_revenue_kzt: number };
};

export type Analytics = {
  capacity: { capacity: number; tickets_sold: number; tickets_remaining: number; percent_sold: number };
  revenue: { gross_sales_kzt: number; discounts_kzt: number; refunds_kzt: number; net_revenue_kzt: number };
  attendance: { tickets_sold: number; checked_in: number; absent: number; checked_in_percent: number };
  sales_over_time: { date: string; orders: number; tickets: number; revenue_kzt: number }[];
  by_ticket_type: { ticket_type_id: string; name: string; price_kzt: number; quantity: number; tickets_sold: number; checked_in: number; revenue_kzt: number }[];
  campaigns: { campaign_id: string; name: string; code: string; redemptions: number; tickets_sold: number; net_revenue_kzt: number }[];
  is_simulated: boolean;
};

export type VenueLayout = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  total_seats: number;
  accessible_seats: number;
  categories: Record<string, number>;
};

export type ActivityEntry = {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  description: string;
};

export type CheckInResult = {
  result: "valid" | "already_used" | "cancelled" | "refunded" | "invalid" | "wrong_event" | string;
  admitted: boolean;
  message: string;
  ticket: {
    id: string;
    attendee_name: string;
    ticket_type_name: string;
    status: string;
    checked_in_at: string | null;
    checked_in_by_name: string | null;
    seat: string | null;
  } | null;
};

export type CheckInStats = {
  registered: number;
  checked_in: number;
  remaining: number;
  checked_in_percent: number;
};

export type CheckInRecord = {
  id: string;
  ticket_id: string;
  attendee_name: string;
  action: "check_in" | "undo" | string;
  method: string;
  performed_by_name: string | null;
  reason: string | null;
  created_at: string;
};

/** Local date and time inputs (Kazakhstan, UTC+5) ↔ ISO instants. */
export function toLocalInputs(iso: string | null | undefined, timeZone = "Asia/Almaty") {
  if (!iso) return { date: "", time: "" };
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: dateTimeZone(date, timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** "2026-12-01" + "19:30" in Kazakhstan time → ISO with the +05:00 offset. */
export const fromLocalInputs = (date: string, time: string) =>
  date && time ? `${date}T${time}:00+05:00` : null;
