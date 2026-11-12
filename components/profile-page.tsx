"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, type ApiOrganizerProfile, type ApiUser } from "@/lib/api";
import { localeCodes, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useDemo } from "./demo-provider";
import { Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import "./backend-profile.css";

function ProfileDetails({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="profile-details">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function NameEditor({ initialName, organizer = false, create = false, save }: {
  initialName: string;
  organizer?: boolean;
  create?: boolean;
  save: (name: string) => Promise<string>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const label = organizer ? t("Organizer display name") : t("Full name");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    setMessage("");
    const value = name.trim();
    if (organizer ? value.length < 2 || value.length > 255 : value.length < 2 || value.length > 100 || !/^\p{L}+$/u.test(value.replace(/[ '-]/g, "")))
      return setError(organizer ? t("Use between 2 and 255 characters for the organizer display name.") : t("Use 2 to 100 characters with letters, spaces, hyphens or apostrophes only."));
    submitting.current = true;
    setBusy(true);
    try {
      setName(await save(value));
      setMessage(organizer ? t("The organizer display name was saved.") : t("The account name was saved."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : create ? t("Could not create this organizer profile.") : organizer ? t("Could not save this organizer profile.") : t("Could not save this account name."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className="backend-profile-section">
    <h2>{create ? t("Create an organizer profile") : label}</h2>
    <form className="stack-form" onSubmit={submit} aria-busy={busy}>
      <label>{label}<input name={organizer ? "display_name" : "full_name"} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={organizer ? 255 : 100} autoComplete={organizer ? "organization" : "name"} disabled={busy} /></label>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? create ? t("Creating profile…") : t("Saving profile…") : create ? t("Create organizer profile") : organizer ? t("Save organizer name") : t("Save name")}</button>
    </form>
  </section>;
}

function SessionRequired({ next }: { next: string }) {
  const { t } = useI18n();
  const { status, error, refresh } = useSession();
  if (status === "loading") return <LoadingPage />;
  if (status === "error") return <>
    <Notice error>{error}</Notice>
    <button className="btn btn-secondary" onClick={refresh}>{t("Try again")}</button>
  </>;
  return <div className="button-row"><Link className="btn btn-primary" href={`/sign-in?next=${encodeURIComponent(next)}`}>{t("Sign in")}</Link><Link className="btn btn-secondary" href="/register">{t("Create an account")}</Link></div>;
}

function AccountRecord({ user }: { user: ApiUser }) {
  const { t, locale } = useI18n();
  const { updateUser } = useSession();
  return <>
    <ProfileDetails rows={[
      [t("Full name"), user.full_name],
      [t("Email address"), user.email],
      [t("Account ID"), user.id],
      [t("Created"), new Intl.DateTimeFormat(localeCodes[locale], locale === "kk"
        ? { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Etc/GMT-5" }
        : { dateStyle: "long", timeZone: "Etc/GMT-5" }).format(new Date(user.created_at))],
    ]} />
    <NameEditor initialName={user.full_name} save={async (name) => {
      const updated = await api.users.update(user.id, { full_name: name });
      updateUser(updated);
      return updated.full_name;
    }} />
    <Link className="text-link" href="/organizer-profile">{t("Organizer profile")}<Icon name="arrow" size={16} /></Link>
  </>;
}

type OrganizerResult = { status: "loading" | "missing" } | { status: "loaded"; profile: ApiOrganizerProfile } | { status: "error"; message: string };

function OwnOrganizerProfile() {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [created, setCreated] = useState(false);
  const [result, setResult] = useState<OrganizerResult>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    void api.organizers.me({ signal: controller.signal }).then((profile) => {
      if (!controller.signal.aborted) setResult({ status: "loaded", profile });
    }, (cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 404) setResult({ status: "missing" });
      else setResult({ status: "error", message: cause instanceof Error ? cause.message : "Could not load this organizer profile." });
    });
    return () => controller.abort();
  }, [attempt]);
  if (result.status === "loading") return <LoadingPage />;
  if (result.status === "error") return <>
    <Notice error>{result.message === "Could not load this organizer profile." ? t(result.message) : result.message}</Notice>
    <button className="btn btn-secondary" onClick={() => { setResult({ status: "loading" }); setAttempt((value) => value + 1); }}>{t("Try again")}</button>
  </>;
  if (result.status !== "loaded") return <NameEditor key="new" initialName="" organizer create save={async (name) => {
    const profile = await api.organizers.create({ display_name: name });
    setResult({ status: "loaded", profile });
    setCreated(true);
    return profile.display_name;
  }} />;
  const profile = result.profile;
  const verification = { pending: "Pending review", verified: "Verified", rejected: "Rejected" }[profile.verification_status];
  return <>
    {created && <Notice>{t("Organizer profile created")}</Notice>}
    <ProfileDetails rows={[[t("Display name"), profile.display_name], [t("Organizer profile ID"), profile.id], [t("Verification"), t(verification)]]} />
    <NameEditor key={profile.id} initialName={profile.display_name} organizer save={async (name) => {
      const updated = await api.organizers.update({ display_name: name });
      setResult({ status: "loaded", profile: updated });
      return updated.display_name;
    }} />
    <Link className="btn btn-primary" href={`/workspace?organizer=${encodeURIComponent(profile.id)}`}>{t("Open event workspace")}<Icon name="arrow" size={16} /></Link>
  </>;
}

export function OrganizerProfilePage() {
  const { t } = useI18n();
  const { status, user } = useSession();
  return <main className="workspace profile-workspace">
    <PageIntro eyebrow={t("Organizer service")} title={t("Organizer profile.")} />
    {status === "signed-in" && user ? <OwnOrganizerProfile key={user.id} /> : <SessionRequired next="/organizer-profile" />}
  </main>;
}

export function ProfilePage() {
  const { t } = useI18n();
  const { status, user } = useSession();
  const { user: demoUser } = useDemo();
  return <main className="workspace profile-workspace">
    <PageIntro eyebrow={t("Account service")} title={t("Account profile.")} />
    {status === "signed-in" && user ? <AccountRecord key={user.id} user={user} /> : <SessionRequired next="/profile" />}
    {demoUser && <section id="demo-profile" className="backend-profile-section">
      <h2>{t("Your demo profile.")}</h2>
      <Notice>{t("This demo profile is stored in this browser. It is separate from backend accounts.")}</Notice>
      <ProfileDetails rows={[[t("Name"), demoUser.name], [t("Email address"), demoUser.email], [t("Demo role"), t(demoUser.role)]]} />
    </section>}
  </main>;
}
