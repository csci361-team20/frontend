"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { currentSession, refreshSession, signIn, useSession } from "./session-provider";
import { Icon, LoadingPage, Notice, Poster, type PosterInfo } from "./primitives";
import { api } from "@/lib/api";

import { LanguageSwitch, useT } from "@/components/language";
import { tk, tr } from "@/lib/i18n";
/** Only same-site paths, never back to the sign-in pages. */
export function safeNext(next?: string) {
  return next?.startsWith("/") &&
    !next.startsWith("//") &&
    !/[\\\u0000- ]/.test(next) &&
    !next.startsWith("/sign-in") &&
    !next.startsWith("/register")
    ? next
    : undefined;
}

// A decorative poster beside the sign-in form, not a real listing
const AUTH_POSTER: PosterInfo = {
  id: "auth",
  poster: "concert",
  title: tk("Your next night out"),
  city: tk("Almaty"),
  category: "Concerts",
  date: "2026-12-31T21:00:00+05:00",
  timeZone: "Asia/Almaty",
};

function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <main className="auth-layout">
      <div className="auth-story">
        <p className="eyebrow">{t("A ticket. A plan. A good night.")}</p>
        <h1>{t("Be there")}<br />
          <em>{t("for the good part.")}</em>
        </h1>
        <div className="auth-poster">
          <Poster event={{ ...AUTH_POSTER, title: t(AUTH_POSTER.title), city: t(AUTH_POSTER.city), category: t(AUTH_POSTER.category) }} />
          <div className="auth-stub">
            <Icon name="ticket" />
            <span>{t("YOUR NEXT NIGHT OUT")}<br />
              <strong>{t("Waiting to happen.")}</strong>
            </span>
            <span className="stub-number">№ 001</span>
          </div>
        </div>
        <p className="auth-caption">{t("Made for the nights worth remembering.")}<br />{t("Almaty & Astana.")}</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link href="/events" className="text-link muted">
            <Icon name="back" size={15} />{t("Back to what's on")}</Link>
          {children}
        </div>
      </div>
    </main>
  );
}

const message = (error: unknown, fallback: string) =>
  tr(error instanceof Error && error.message ? error.message : fallback);

export function AuthPage({
  register,
  next,
  initialRole,
}: {
  register: boolean;
  next?: string;
  initialRole?: string;
}) {
  const t = useT();
  const { user, ready } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const role = initialRole === "organizer" ? "organizer" : initialRole === "platform_admin" ? "platform_admin" : "attendee";

  function goOn(created: boolean) {
    const target = safeNext(next);
    if (target) return router.push(target);
    if (created) return router.push(role === "organizer" ? "/organizer" : "/events");
    const session = currentSession();
    if (session.status === "signed-in" && session.user.is_platform_admin) return router.push("/admin");
    if (session.status === "signed-in" && session.organizer) return router.push("/organizer");
    router.push("/orders");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password"));
    if (register) {
      const name = String(data.get("name")).trim();
      if (name.length < 2 || !/^\p{L}+$/u.test(name.replace(/[ '-]/g, "")))
        return setError(
          t("Use at least two characters for your name, with letters, spaces, hyphens or apostrophes only."),
        );
      if (password !== data.get("confirm-password"))
        return setError(t("Your passwords do not match."));
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (register)
        await api.users.register({
          full_name: String(data.get("name")).trim(),
          email,
          password,
          preferred_language: t.lang,
        });
      await signIn(email, password);
      form.reset();
      goOn(register);
    } catch (error) {
      setError(message(error, register ? t("Could not create your account. Please try again.") : t("Could not sign you in. Please try again.")));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const suffix = `${next ? `&next=${encodeURIComponent(next)}` : ""}&role=${role}`;
  if (!ready) return <LoadingPage />;
  return (
    <AuthLayout>
      <p className="eyebrow">{register ? t("Make yourself at home") : t("Good to see you")}</p>
      <h2>{register ? t("Start your next chapter.") : t("Welcome back.")}</h2>
      <p className="muted">
        {register
          ? t("A place for your tickets. Or a stage for your ideas.")
          : t("Your tickets, your plans, all right here.")}
      </p>
      {user && (
        <Notice>{t("You are signed in as")}{" "}{user.full_name}.{" "}
          <Link href={safeNext(next) ?? "/orders"}>{t("Continue")}</Link>
        </Notice>
      )}
      <form onSubmit={submit} className="stack-form" aria-busy={busy}>
        {register && (
          <label>{t("Your name")}<input name="name" autoComplete="name" placeholder={t("First and last name")} required minLength={2} maxLength={100} disabled={busy} />
          </label>
        )}
        <label>{t("Email address")}<input name="email" type="email" autoComplete="email" placeholder={t("you@example.com")} required maxLength={255} disabled={busy} />
        </label>
        <label>{t("Password")}<input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 8 : 1}
            maxLength={128}
            disabled={busy}
            aria-describedby={register ? "password-hint" : undefined}
          />
          {register && (
            <span className="field-hint" id="password-hint">{t("Use 8–128 characters.")}</span>
          )}
        </label>
        {register && (
          <label>{t("Confirm password")}<input name="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} />
          </label>
        )}
        {register && (
          <div className="field-group">
            <span>{t("Language")}</span>
            <LanguageSwitch />
            <span className="field-hint">{t("Used on the site, in the app, emails and notifications.")}</span>
          </div>
        )}
        {!register && (
          <Link className="text-link muted" href="/forgot-password">{t("Forgot your password?")}</Link>
        )}
        {error && <Notice error>{error}</Notice>}
        <button className="btn btn-primary btn-full" disabled={busy}>
          {busy ? (register ? t("Creating account…") : t("Signing in…")) : register ? t("Create account") : t("Sign in")}
          <Icon name="arrow" size={17} />
        </button>
      </form>
      {register && (
        <p className="field-hint">{t("We will email you a link to confirm your address. You can book free events right away.")}</p>
      )}
      <p className="auth-switch">
        {register ? t("Already have an account?") : t("New around here?")}{" "}
        <Link href={`${register ? "/sign-in" : "/register"}?${suffix.slice(1)}`}>
          {register ? t("Sign in") : t("Create an account")}
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const t = useT();
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const email = String(new FormData(event.currentTarget).get("email")).trim().toLowerCase();
      const result = await api.auth.requestPasswordReset(email);
      setSent(result?.detail ?? t("If an account exists for this email, a reset link is on its way."));
    } catch (error) {
      setError(message(error, t("Could not send the reset link. Please try again.")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <p className="eyebrow">{t("Locked out?")}</p>
      <h2>{t("Reset your password.")}</h2>
      <p className="muted">{t("Enter your email and we will send you a link to choose a new password.")}</p>
      {sent ? (
        <Notice>{sent}</Notice>
      ) : (
        <form onSubmit={submit} className="stack-form" aria-busy={busy}>
          <label>{t("Email address")}<input name="email" type="email" autoComplete="email" required maxLength={255} disabled={busy} />
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy ? t("Sending…") : t("Send reset link")} <Icon name="arrow" size={17} />
          </button>
        </form>
      )}
      <p className="auth-switch">{t("Remembered it?")}{" "}<Link href="/sign-in">{t("Sign in")}</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordPage({ token }: { token?: string }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirm-password")) return setError(t("Your passwords do not match."));
    setBusy(true);
    try {
      await api.auth.confirmPasswordReset(token ?? "", password);
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 2500);
    } catch (error) {
      setError(message(error, t("Could not reset your password. Please try again.")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <p className="eyebrow">{t("Almost there")}</p>
      <h2>{t("Choose a new password.")}</h2>
      {!token ? (
        <Notice error>{t("This link is missing its code. Open the link from the email again, or")}{" "}
          <Link href="/forgot-password">{t("ask for a new one")}</Link>.
        </Notice>
      ) : done ? (
        <Notice>{t("Your password was changed. Taking you to sign in…")}</Notice>
      ) : (
        <form onSubmit={submit} className="stack-form" aria-busy={busy}>
          <label>{t("New password")}<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} />
            <span className="field-hint">{t("Use 8–128 characters. You will be signed out on other devices.")}</span>
          </label>
          <label>{t("Confirm new password")}<input name="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} />
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy ? t("Saving…") : t("Save new password")} <Icon name="arrow" size={17} />
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

export function VerifyEmailPage({ token }: { token?: string }) {
  const t = useT();
  const { user } = useSession();
  const [state, setState] = useState<{ status: "working" | "done" | "error"; text?: string }>(
    token ? { status: "working" } : { status: "error", text: t("This link is missing its code.") },
  );
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api.auth.confirmVerification(token).then(
      () => {
        setState({ status: "done" });
        void refreshSession();
      },
      (error: unknown) => setState({ status: "error", text: message(error, tr("This link could not be used.")) }),
    );
  }, [token]);
  return (
    <AuthLayout>
      <p className="eyebrow">{t("Email address")}</p>
      <h2>{state.status === "done" ? t("You are confirmed.") : t("Confirming your email.")}</h2>
      {state.status === "working" && <Notice>{t("Checking your link…")}</Notice>}
      {state.status === "done" && (
        <>
          <Notice>{t("Thank you. Your email address is confirmed.")}</Notice>
          <Link className="btn btn-primary btn-full" href={user ? "/events" : "/sign-in"}>
            {user ? t("Find an event") : t("Sign in")} <Icon name="arrow" size={17} />
          </Link>
        </>
      )}
      {state.status === "error" && (
        <>
          <Notice error>{state.text}</Notice>
          <p className="muted">{t("Links work once and expire.")}{" "}{user ? t("Send a new one from your ") : t("Sign in, then send a new one from your ")}
            <Link href="/profile">{t("profile")}</Link>.
          </p>
        </>
      )}
    </AuthLayout>
  );
}
