/** Support cases and notifications as the BiletFlow backend returns them. */

import { tk, translatedOptions, translatedRecord } from "./i18n";

export type CaseAudience = "attendee" | "organizer";
export type CaseStatus = "open" | "in_progress" | "waiting_for_customer" | "resolved";
export type CaseCategory =
  | "ticket_delivery"
  | "payment"
  | "refund"
  | "seating"
  | "event_information"
  | "check_in"
  | "account"
  | "activation"
  | "technical";

export const CATEGORY_LABELS: Record<CaseCategory, string> = translatedRecord({
  ticket_delivery: tk("Ticket delivery"),
  payment: tk("Payment"),
  refund: tk("Refund"),
  seating: tk("Seating"),
  event_information: tk("Event information"),
  check_in: tk("Check-in"),
  account: tk("Account"),
  activation: tk("Paid sales activation"),
  technical: tk("Technical problem"),
});

/** Same lists as the backend (SRS 4.13). */
export const CATEGORIES_BY_AUDIENCE: Record<CaseAudience, CaseCategory[]> = {
  attendee: ["ticket_delivery", "payment", "refund", "seating", "event_information", "check_in", "account", "technical"],
  organizer: ["account", "activation", "payment", "technical"],
};

export const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = translatedOptions([
  { value: "open", label: tk("Open") },
  { value: "in_progress", label: tk("In Progress") },
  { value: "waiting_for_customer", label: tk("Waiting for Customer") },
  { value: "resolved", label: tk("Resolved") },
]);

export type CaseSummary = {
  id: string;
  audience: CaseAudience;
  category: CaseCategory;
  subject: string;
  status: CaseStatus;
  status_label: string;
  requester_user_id: string;
  requester_name: string;
  event_id: string | null;
  event_title: string | null;
  order_id: string | null;
  ticket_id: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  is_escalated: boolean;
  can_manage: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at: string | null;
};

export type CaseMessage = {
  id: string;
  sender_user_id: string | null;
  sender_name: string;
  from_staff: boolean;
  body: string;
  created_at: string;
};

export type CaseDetail = CaseSummary & {
  messages: CaseMessage[];
  history: { id: string; actor_name: string | null; action: string; created_at: string }[];
};

export type Assignee = { user_id: string; full_name: string; role: string };

export type AppNotification = {
  id: string;
  kind: string;
  message: string;
  link: string | null;
  event_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

/** Notification links are site paths; anything else is not followed. */
export const safeLink = (link: string | null | undefined) =>
  link && link.startsWith("/") && !link.startsWith("//") ? link : null;

/** Short case reference shown to people, e.g. "SC-1A2B3C4D". */
export const caseRef = (id: string) => `SC-${id.slice(0, 8).toUpperCase()}`;
