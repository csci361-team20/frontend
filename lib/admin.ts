/** Platform administration data as the BiletFlow backend returns it. */

import { tk } from "./i18n";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  is_platform_admin: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  is_email_verified: boolean;
  created_at: string;
};

export type AdminOrganizer = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  verification_status: "pending" | "verified" | "rejected";
  legal_name: string | null;
  tax_id_masked: string | null;
  verification_submitted_at: string | null;
  verified_at: string | null;
  is_suspended: boolean;
};

export type AdminEvent = {
  id: string;
  title: string;
  organizer_name: string;
  status: string;
  lifecycle: string;
  visibility: string;
  start_at: string;
  city: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  paid_sales_open: boolean;
  created_at: string;
};

export type AdminOrder = {
  id: string;
  event_id: string;
  event_title: string;
  buyer_email: string;
  status: string;
  total_kzt: number;
  discount_kzt: number;
  promo_code: string | null;
  created_at: string;
};

export type AdminPayment = {
  id: string;
  order_id: string;
  event_title: string;
  buyer_email: string;
  status: string;
  amount_kzt: number;
  processing_fee_kzt: number;
  failure_reason: string | null;
  is_simulated: boolean;
  created_at: string;
};

export type AdminRefund = {
  id: string;
  order_id: string;
  event_title: string;
  buyer_email: string;
  amount_kzt: number;
  reason: string;
  initiated_by_name: string | null;
  created_at: string;
};

export type AdminSearch = { users: AdminUser[]; events: AdminEvent[]; orders: AdminOrder[]; payments: AdminPayment[] };

export type EventReport = {
  id: string;
  event_id: string;
  event_title: string;
  reporter_user_id: string;
  reason: string;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Dispute = {
  id: string;
  payment_id: string;
  order_id: string;
  amount_kzt: number;
  reason: string;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ActivationRecord = {
  id: string;
  event_id: string;
  event_title: string;
  organizer_profile_id: string;
  organizer_name: string;
  status: "pending" | "active" | "suspended";
  fee_kzt: number;
  fee_paid_at: string | null;
  fee_payment_reference: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
};

export type PromoActivity = {
  redemption_id: string;
  code: string;
  campaign_name: string;
  event_id: string;
  event_title: string;
  order_id: string;
  order_status: string;
  buyer_email: string;
  discount_kzt: number;
  created_at: string;
};

export type AuditRow = {
  id: string;
  created_at: string;
  actor_name: string | null;
  event_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
};

export type PlatformSettings = {
  activation_fee_kzt: number;
  support_email: string;
  bookings_enabled: boolean;
  updated_at: string | null;
};

/** The CSV reports the backend can build. */
export const EXPORTS: [string, string][] = [
  ["users", tk("Users")],
  ["events", tk("Events")],
  ["orders", tk("Orders")],
  ["payments", tk("Payments")],
  ["refunds", tk("Refunds")],
  ["activations", tk("Paid-sales activations")],
  ["disputes", tk("Disputes")],
  ["promotions", tk("Promo-code activity")],
  ["support", tk("Support cases")],
];
