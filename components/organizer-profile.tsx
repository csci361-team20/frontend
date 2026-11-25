"use client";

/** Organizer profile: public details, identity verification and payout account. */

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MyOrganizerProfile, PayoutAccount } from "@/lib/organizer";
import { failure } from "./organizer-pages";
import { refreshSession } from "./session-provider";
import { useLoad } from "./use-load";
import { LoadingPage, Notice, PageIntro } from "./primitives";
import { useT } from "@/components/language";

import { tk } from "@/lib/i18n";
const VERIFICATION: Record<string, string> = {
  pending: tk("Submitted — the BiletFlow team is checking it"),
  verified: tk("Verified"),
  rejected: tk("Rejected — check the details and submit again"),
};

export function OrganizerProfileView() {
  const t = useT();
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const data = useLoad(`organizer-profile:${version}`, async (signal) => {
    const [profile, payout] = await Promise.all([
      api.request<MyOrganizerProfile>("/organizers/me", { signal }),
      api.request<PayoutAccount>("/organizers/me/payout-account", { signal }).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),
    ]);
    return { profile, payout };
  });

  async function run(kind: string, action: () => Promise<unknown>, done: string, form?: HTMLFormElement) {
    setBusy(kind);
    setNotice(null);
    try {
      await action();
      form?.reset();
      setVersion((v) => v + 1);
      setNotice({ text: done, error: false });
      if (kind === "details") await refreshSession();
    } catch (e) {
      setNotice({ text: failure(e), error: true });
    } finally {
      setBusy("");
    }
  }

  if (data.status === "error" && !data.data) return <Notice error>{data.error.message}</Notice>;
  if (!data.data) return <LoadingPage />;
  const { profile, payout } = data.data;
  const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim() || null;

  return (
    <>
      <PageIntro eyebrow={t("How guests see you")} title={t("Organizer profile.")} description={t("Your public details, identity check and payout account. The last two are needed before paid tickets can go on sale.")} />
      {notice && <Notice error={notice.error}>{notice.text}</Notice>}
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void run(
            "details",
            () =>
              api.request("/organizers/me", {
                method: "PATCH",
                body: {
                  display_name: text(d, "display_name"),
                  contact_email: text(d, "contact_email"),
                  contact_phone: text(d, "contact_phone"),
                  website_url: text(d, "website_url"),
                  description: text(d, "description"),
                },
              }),
            t("Profile saved."),
          );
        }}
      >
        <h2>{t("Public details")}</h2>
        <label>{t("Organizer name")}<input name="display_name" defaultValue={profile.display_name} required minLength={2} maxLength={255} />
        </label>
        <div className="form-two">
          <label>{t("Contact email")}{" "}<span className="optional">{t("Optional")}</span>
            <input name="contact_email" type="email" defaultValue={profile.contact_email ?? ""} maxLength={255} />
          </label>
          <label>{t("Contact phone")}{" "}<span className="optional">{t("Optional")}</span>
            <input name="contact_phone" type="tel" defaultValue={profile.contact_phone ?? ""} maxLength={30} placeholder="+7 700 000 0000" />
          </label>
        </div>
        <label>{t("Website")}{" "}<span className="optional">{t("Optional")}</span>
          <input name="website_url" type="url" defaultValue={profile.website_url ?? ""} maxLength={500} placeholder="https://" />
        </label>
        <label>{t("About you")}{" "}<span className="optional">{t("Optional")}</span>
          <textarea name="description" rows={3} defaultValue={profile.description ?? ""} maxLength={2000} />
        </label>
        <button className="btn btn-primary" disabled={busy === "details"}>{busy === "details" ? t("Saving…") : t("Save details")}</button>
      </form>

      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const d = new FormData(form);
          void run(
            "identity",
            () => api.request("/organizers/me/verification", { body: { legal_name: text(d, "legal_name"), tax_id: text(d, "tax_id") } }),
            t("Submitted. The BiletFlow team will confirm your identity."),
            form,
          );
        }}
      >
        <h2>{t("Identity check")}</h2>
        <p className="muted">{t("Status:")}{" "}
          <strong>
            {/* Every profile starts as "pending"; it only means something once details are sent */}
            {profile.verification_status && (profile.verification_submitted_at || profile.verification_status !== "pending")
              ? t(VERIFICATION[profile.verification_status] ?? profile.verification_status)
              : t("Not submitted")}
          </strong>
          {profile.legal_name && ` · ${profile.legal_name}`}
          {profile.tax_id_masked && t(" · IIN/BIN {tax_id_masked}", { tax_id_masked: profile.tax_id_masked })}
        </p>
        {profile.verification_status !== "verified" && (
          <>
            <div className="form-two">
              <label>{t("Legal name (person or company)")}<input name="legal_name" required minLength={2} maxLength={255} defaultValue={profile.legal_name ?? ""} />
              </label>
              <label>{t("IIN or BIN")}<input name="tax_id" required inputMode="numeric" pattern="\d{12}" maxLength={12} placeholder={t("12 digits")} />
              </label>
            </div>
            <button className="btn btn-secondary" disabled={busy === "identity"}>{busy === "identity" ? t("Sending…") : t("Submit for verification")}</button>
          </>
        )}
      </form>

      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const d = new FormData(form);
          void run(
            "payout",
            () =>
              api.request("/organizers/me/payout-account", {
                method: "PUT",
                body: { holder_name: text(d, "holder_name"), bank_name: text(d, "bank_name"), iban: text(d, "iban") },
              }),
            t("Payout account saved."),
            form,
          );
        }}
      >
        <h2>{t("Payout account")}</h2>
        {payout ? (
          <p className="muted">
            {payout.holder_name} · {payout.bank_name} · {payout.iban_masked} {payout.is_verified ? t("· verified") : ""}
            {payout.is_simulated && t(" · payouts are simulated")}
          </p>
        ) : (
          <p className="muted">{t("No account yet. Ticket revenue would be paid here.")}</p>
        )}
        <div className="form-two">
          <label>{t("Account holder")}<input name="holder_name" required minLength={2} maxLength={255} defaultValue={payout?.holder_name ?? profile.legal_name ?? ""} />
          </label>
          <label>{t("Bank")}<input name="bank_name" required minLength={2} maxLength={255} defaultValue={payout?.bank_name ?? ""} placeholder={t("Halyk Bank")} />
          </label>
        </div>
        <label>{t("IBAN")}<input name="iban" required maxLength={34} placeholder="KZ…" autoComplete="off" />
          <span className="field-hint">{t("Kazakhstan IBAN, 20 characters starting with KZ")}</span>
        </label>
        <button className="btn btn-secondary" disabled={busy === "payout"}>{busy === "payout" ? t("Saving…") : payout ? t("Replace account") : t("Save account")}</button>
      </form>
    </>
  );
}
