"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { refreshSession, signOut, useSession } from "./session-provider";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";

import { LanguageSwitch, useT } from "@/components/language";
import { formatDate, tr } from "@/lib/i18n";
const failure = (error: unknown, fallback: string) =>
  tr(error instanceof Error && error.message ? error.message : fallback);

function ProfileDetails({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="profile-details">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfilePage() {
  const t = useT();
  const { user, organizer, ready, isAdmin } = useSession();
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "details" | "verify" | "password" | "everywhere">("");

  if (!ready) return <LoadingPage />;
  if (!user)
    return (
      <div className="workspace">
        <EmptyState
          title={t("Your account lives here.")}
          description={t("Sign in to see and change your details, language and password.")}
          href="/sign-in?next=/profile"
          label={t("Sign in")}
        />
      </div>
    );

  async function run(kind: typeof busy, action: () => Promise<string | void>) {
    setNotice("");
    setError("");
    setBusy(kind);
    try {
      const text = await action();
      if (text) setNotice(text);
    } catch (error) {
      setError(failure(error, t("That did not work. Please try again.")));
    } finally {
      setBusy("");
    }
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run("details", async () => {
      await api.users.updateMe({
        full_name: String(data.get("full_name")).trim(),
      });
      await refreshSession();
      return t("Your details were saved.");
    });
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("new_password"));
    if (next !== data.get("confirm_password")) return setError(t("Your new passwords do not match."));
    void run("password", async () => {
      await api.auth.changePassword(String(data.get("current_password")), next);
      form.reset();
      return t("Your password was changed. Other devices have been signed out.");
    });
  }

  return (
    <main className="workspace profile-workspace">
      <PageIntro eyebrow={t("Your account")} title={t("Account profile.")} description={t("Your details, language and sign-in settings.")} />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {!user.is_email_verified && (
        <Notice>{t("Please confirm your email address. Paid tickets and organizer tools need a confirmed email.")}{" "}
          <button
            className="text-link"
            disabled={busy === "verify"}
            onClick={() =>
              run("verify", async () => {
                const result = await api.auth.requestVerification();
                return result?.detail ?? t("A new confirmation link is on its way.");
              })
            }
          >
            {busy === "verify" ? t("Sending…") : t("Send the link again")}
          </button>
        </Notice>
      )}
      <ProfileDetails
        rows={[
          [t("Email address"), <>{user.email} {user.is_email_verified ? <small>{t("· confirmed")}</small> : <small>{t("· not confirmed")}</small>}</>],
          [t("Account type"), isAdmin ? t("Platform administrator") : organizer ? t("Organizer · {display_name}", { display_name: organizer.display_name }) : t("Attendee")],
          [t("Member since"), formatDate(t.lang, new Date(user.created_at), { dateStyle: "long", timeZone: "Asia/Almaty" })],
        ]}
      />

      <form className="stack-form" onSubmit={saveDetails} aria-busy={busy === "details"}>
        <h2>{t("Details")}</h2>
        <label>{t("Full name")}<input name="full_name" defaultValue={user.full_name} required minLength={2} maxLength={100} autoComplete="name" disabled={busy === "details"} />
        </label>
        <div className="field-group">
          <span>{t("Language")}</span>
          <LanguageSwitch />
          <span className="field-hint">{t("Used on the site, in the app, emails and notifications. It changes straight away.")}</span>
        </div>
        <button className="btn btn-primary" disabled={busy === "details"}>
          {busy === "details" ? t("Saving…") : t("Save details")}
        </button>
      </form>

      <form className="stack-form" onSubmit={changePassword} aria-busy={busy === "password"}>
        <h2>{t("Password")}</h2>
        <label>{t("Current password")}<input name="current_password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy === "password"} />
        </label>
        <label>{t("New password")}<input name="new_password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy === "password"} />
        </label>
        <label>{t("Confirm new password")}<input name="confirm_password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy === "password"} />
        </label>
        <button className="btn btn-primary" disabled={busy === "password"}>
          {busy === "password" ? t("Changing…") : t("Change password")}
        </button>
      </form>

      <div className="button-row">
        {!organizer && !isAdmin && (
          <Link className="btn btn-secondary" href="/organizer">{t("Become an organizer")}{" "}<Icon name="arrow" size={16} /></Link>
        )}
        <button
          className="btn btn-secondary"
          disabled={busy === "everywhere"}
          onClick={() =>
            run("everywhere", async () => {
              await api.auth.signOutEverywhere();
              await signOut();
              router.push("/sign-in");
            })
          }
        >{t("Sign out on all devices")}</button>
      </div>
    </main>
  );
}
