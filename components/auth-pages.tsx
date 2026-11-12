"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { initialEvents } from "@/lib/demo-data";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useDemo } from "./demo-provider";
import { Icon, Notice, Poster } from "./primitives";

function safeNextPath(next?: string) {
  if (!next?.startsWith("/") || /^\/(?:\/|%2f|%5c)/i.test(next) || /[\\\u0000-\u0020]/.test(next)) return undefined;
  const origin = "https://biletflow.invalid";
  const url = new URL(next, origin);
  if (url.origin !== origin || /^\/(?:\/|%2f|%5c)/i.test(url.pathname) || /^\/(?:sign-in|register)(?:\/|$)/.test(url.pathname)) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function AuthPage({ register, next, initialRole, created = false }: {
  register: boolean;
  next?: string;
  initialRole?: string;
  created?: boolean;
}) {
  const { t } = useI18n();
  const { state, update } = useDemo();
  const { signIn } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [demoError, setDemoError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const destination = safeNextPath(next);
  const query = new URLSearchParams();
  if (destination) query.set("next", destination);
  if (initialRole === "organizer" || initialRole === "platform_admin") query.set("role", initialRole);
  const suffix = query.size ? `?${query}` : "";

  function enterDemo(id: string) {
    if (submitting.current) return;
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) return setDemoError(t("This demo profile is unavailable."));
    update((value) => ({ ...value, currentUserId: profile.id }));
    router.push(destination ?? (profile.supportOrganizerIds?.length ? "/support" : profile.role === "platform_admin" ? "/admin" : profile.role === "organizer" ? "/organizer" : "/orders"));
  }

  function demoByEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("demo_email")).trim().toLowerCase();
    const profile = state.profiles.find((item) => item.email.toLowerCase() === email);
    if (!profile) return setDemoError(t("No demo profile matches this email. Try a sample profile below."));
    enterDemo(profile.id);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password"));
    const name = String(data.get("name") ?? "").trim();
    if (register && (name.length < 2 || !/^\p{L}+$/u.test(name.replace(/[ '-]/g, ""))))
      return setError(t("Use at least two characters for your name, with letters, spaces, hyphens or apostrophes only."));
    if (register && password !== data.get("confirm-password")) return setError(t("Your passwords do not match."));
    submitting.current = true;
    setBusy(true);
    try {
      if (register) {
        await api.users.register({ full_name: name, email, password });
        form.reset();
        query.set("created", "1");
        router.replace(`/sign-in?${query}`);
      } else {
        await signIn({ email, password });
        form.reset();
        router.replace(destination ?? "/profile");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : register ? t("Could not create your account. Please try again.") : t("Could not sign in. Please try again."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <main className="auth-layout">
    <div className="auth-story">
      <p className="eyebrow">{t("A ticket. A plan. A good night.")}</p>
      <h1>{t("Be there")}<br /><em>{t("for the good part.")}</em></h1>
      <div className="auth-poster">
        <Poster event={initialEvents[0]} />
        <div className="auth-stub"><Icon name="ticket" /><span>{t("YOUR NEXT NIGHT OUT")}<br /><strong>{t("Waiting to happen.")}</strong></span><span className="stub-number">№ 001</span></div>
      </div>
      <p className="auth-caption">{t("Made for the nights worth remembering.")}<br />{t("Almaty & Astana.")}</p>
    </div>
    <div className="auth-form-side"><div className="auth-form-wrap">
      <Link href="/events" className="text-link muted"><Icon name="back" size={15} />{t("Back to what's on")}</Link>
      <p className="eyebrow">{register ? t("Make yourself at home") : t("Good to see you")}</p>
      <h2>{register ? t("Create an account") : t("Sign in")}</h2>
      {!register && created && <Notice>{t("Your account was created. Sign in to continue.")}</Notice>}
      <form onSubmit={submit} className="stack-form" aria-busy={busy}>
        {register && <label>{t("Your name")}<input name="name" autoComplete="name" placeholder={t("First and last name")} required minLength={2} maxLength={100} disabled={busy} /></label>}
        <label>{t("Email address")}<input name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={255} disabled={busy} /></label>
        <label>{t("Password")}<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 8 : undefined} maxLength={128} disabled={busy} aria-describedby={register ? "password-hint" : undefined} />
          {register && <span className="field-hint" id="password-hint">{t("Use 8–128 characters.")}</span>}
        </label>
        {register && <label>{t("Confirm password")}<input name="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} /></label>}
        {error && <Notice error>{error}</Notice>}
        <button className="btn btn-primary btn-full" disabled={busy}>{busy ? register ? t("Creating account…") : t("Signing in…") : register ? t("Create account") : t("Sign in")}<Icon name="arrow" size={17} /></button>
      </form>
      <p className="auth-switch">{register ? t("Already have an account?") : t("New around here?")}{" "}<Link href={`${register ? "/sign-in" : "/register"}${suffix}`}>{register ? t("Sign in") : t("Create an account")}</Link></p>
      {!register && <>
        <div id="demo" className="demo-divider"><span>{t("Browser demo")}</span></div>
        <div className="demo-note"><span className="status-dot" /><span>{t("Demo profiles are stored in this browser and are separate from your account.")}</span></div>
        <form className="stack-form" onSubmit={demoByEmail}>
          <label>{t("Demo profile email")}<input name="demo_email" type="email" autoComplete="off" maxLength={255} required disabled={busy} /></label>
          {demoError && <Notice error>{demoError}</Notice>}
          <button className="btn btn-secondary" disabled={busy}>{t("Open demo profile")}</button>
        </form>
        <div className="demo-role-buttons">
          <button className="btn btn-secondary" onClick={() => enterDemo("dana")} disabled={busy}><Icon name="ticket" size={17} />{t("Try attendee")}</button>
          <button className="btn btn-secondary" onClick={() => enterDemo("arman")} disabled={busy}><Icon name="grid" size={17} />{t("Try organizer")}</button>
          <button className="btn btn-secondary" onClick={() => enterDemo("admin")} disabled={busy}><Icon name="grid" size={17} />{t("Try platform admin")}</button>
          <button className="btn btn-secondary" onClick={() => enterDemo("support")} disabled={busy}><Icon name="mail" size={17} />{t("Try support staff")}</button>
        </div>
      </>}
    </div></div>
  </main>;
}
