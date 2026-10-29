"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { Icon, Notice, Poster } from "./primitives";
import { initialEvents, type Role } from "@/lib/demo-data";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function AuthPage({
  register,
  next,
  initialRole,
}: {
  register: boolean;
  next?: string;
  initialRole?: string;
}) {
  const { t } = useI18n();
  const { state, update } = useDemo();
  const router = useRouter();
  const role: Role = initialRole === "platform_admin" ? "platform_admin" : initialRole === "organizer" ? "organizer" : "attendee";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  function destination(userRole: Role) {
    return next?.startsWith("/") &&
      !next.startsWith("//") &&
      !/[\\\u0000-\u0020]/.test(next) &&
      !next.startsWith("/sign-in") &&
      !next.startsWith("/register")
      ? next
      : userRole === "platform_admin"
        ? "/admin"
        : userRole === "organizer"
        ? "/organizer"
        : "/orders";
  }
  function enter(id: string) {
    const profile = state.profiles.find((p) => p.id === id)!;
    update((s) => ({ ...s, currentUserId: id }));
    router.push(profile.supportOrganizerIds?.length && !next ? "/support" : destination(profile.role));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email")).trim().toLowerCase();
    const existing = state.profiles.find((p) => p.email === email);
    if (!register) {
      if (!existing)
        return setError(
          t("No demo profile with this email exists in this browser. Try a sample profile below. Backend accounts cannot sign in yet."),
        );
      return enter(existing.id);
    }
    const name = String(data.get("name")).trim();
    if (name.length < 2 || !/^\p{L}+$/u.test(name.replace(/[ '-]/g, "")))
      return setError(
        t("Use at least two characters for your name, with letters, spaces, hyphens or apostrophes only."),
      );
    const password = String(data.get("password"));
    if (password !== data.get("confirm-password"))
      return setError(t("Your passwords do not match."));
    submitting.current = true;
    setBusy(true);
    try {
      const account = await api.users.register({
        full_name: name,
        email,
        password,
      });
      form.reset();
      router.push(`/profile?id=${encodeURIComponent(account.id)}&created=1`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("Could not create your account. Please try again."),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const suffix = `${next ? `&next=${encodeURIComponent(next)}` : ""}&role=${role}`;
  return (
    <main className="auth-layout">
      <div className="auth-story">
        <p className="eyebrow">{t("A ticket. A plan. A good night.")}</p>
        <h1>
          {t("Be there")}<br />
          <em>{t("for the good part.")}</em>
        </h1>
        <div className="auth-poster">
          <Poster event={initialEvents[0]} />
          <div className="auth-stub">
            <Icon name="ticket" />
            <span>
              {t("YOUR NEXT NIGHT OUT")}<br />
              <strong>{t("Waiting to happen.")}</strong>
            </span>
            <span className="stub-number">№ 001</span>
          </div>
        </div>
        <p className="auth-caption">
          {t("Made for the nights worth remembering.")}<br />
          {t("Almaty & Astana.")}</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link href="/events" className="text-link muted">
            <Icon name="back" size={15} />
            {t("Back to what's on")}</Link>
          <p className="eyebrow">
            {register ? t("Make yourself at home") : t("Good to see you")}
          </p>
          <h2>{register ? t("Start your next chapter.") : t("Welcome back.")}</h2>
          <p className="muted">
            {register
              ? t("A place for your tickets. Or a stage for your ideas.")
              : t("Your tickets, your plans, all right here.")}
          </p>
          <div className="demo-note">
            <span className="status-dot" />
            <span>
              {register
                ? t("Create an account with the account service. Sign-in will be available when backend authentication is ready.")
                : t("Backend sign-in is not available yet. Demo profiles let you explore tickets and organizer tools in this browser. They do not sign you into a backend account.")}
            </span>
          </div>
          <form onSubmit={submit} className="stack-form" aria-busy={busy}>
            {register && (
              <label>
                {t("Your name")}<input
                  name="name"
                  autoComplete="name"
                  placeholder={t("First and last name")}
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={busy}
                />
              </label>
            )}
            <label>
              {register ? t("Email address") : t("Demo profile email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={255}
                disabled={busy}
              />
            </label>
            {register && (
              <>
                <label>
                  {t("Password")}<input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={busy}
                    aria-describedby="password-hint"
                  />
                  <span className="field-hint" id="password-hint">
                    {t("Use 8–128 characters.")}</span>
                </label>
                <label>
                  {t("Confirm password")}<input
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            {error && <Notice error>{error}</Notice>}
            <button className="btn btn-primary btn-full" disabled={busy}>
              {busy
                ? t("Creating account…")
                : register
                  ? t("Create account")
                  : t("Open demo profile")}
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? t("Want to explore the demo?") : t("New around here?")}{" "}
            <Link
              href={`${register ? "/sign-in" : "/register"}?${suffix.slice(1)}`}
            >
              {register ? t("Open a demo profile") : t("Create an account")}
            </Link>
          </p>
          {!register && (
            <>
              <div className="demo-divider">
                <span>{t("Or take a look around")}</span>
              </div>
              <div className="demo-role-buttons">
                <button className="btn btn-secondary" onClick={() => enter("dana")}>
                  <Icon name="ticket" size={17} />
                  {t("Try attendee")}</button>
                <button className="btn btn-secondary" onClick={() => enter("arman")}>
                  <Icon name="grid" size={17} />
                  {t("Try organizer")}</button>
                <button className="btn btn-secondary" onClick={() => enter("admin")}>
                  <Icon name="grid" size={17} />
                  {t("Try platform admin")}</button>
                <button className="btn btn-secondary" onClick={() => enter("support")}>
                  <Icon name="mail" size={17} />
                  {t("Try support staff")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
