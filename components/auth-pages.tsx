"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { Icon, Notice, Poster } from "./primitives";
import { initialEvents, type Role } from "@/lib/demo-data";
import { api } from "@/lib/api";

export function AuthPage({
  register,
  next,
  initialRole,
}: {
  register: boolean;
  next?: string;
  initialRole?: string;
}) {
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
          "No demo profile with this email exists in this browser. Try a sample profile below. Backend accounts cannot sign in yet.",
        );
      return enter(existing.id);
    }
    const name = String(data.get("name")).trim();
    if (name.length < 2 || !/^\p{L}+$/u.test(name.replace(/[ '-]/g, "")))
      return setError(
        "Use at least two characters for your name, with letters, spaces, hyphens or apostrophes only.",
      );
    const password = String(data.get("password"));
    if (password !== data.get("confirm-password"))
      return setError("Your passwords do not match.");
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
          : "Could not create your account. Please try again.",
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
        <p className="eyebrow">A ticket. A plan. A good night.</p>
        <h1>
          Be there
          <br />
          <em>for the good part.</em>
        </h1>
        <div className="auth-poster">
          <Poster event={initialEvents[0]} />
          <div className="auth-stub">
            <Icon name="ticket" />
            <span>
              YOUR NEXT NIGHT OUT
              <br />
              <strong>Waiting to happen.</strong>
            </span>
            <span className="stub-number">№ 001</span>
          </div>
        </div>
        <p className="auth-caption">
          Made for the nights worth remembering.
          <br />
          Almaty & Astana.
        </p>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link href="/events" className="text-link muted">
            <Icon name="back" size={15} />
            Back to what&apos;s on
          </Link>
          <p className="eyebrow">
            {register ? "Make yourself at home" : "Good to see you"}
          </p>
          <h2>{register ? "Start your next chapter." : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "A place for your tickets. Or a stage for your ideas."
              : "Your tickets, your plans, all right here."}
          </p>
          <div className="demo-note">
            <span className="status-dot" />
            <span>
              {register
                ? "Create an account with the account service. Sign-in will be available when backend authentication is ready."
                : "Backend sign-in is not available yet. Demo profiles let you explore tickets and organizer tools in this browser. They do not sign you into a backend account."}
            </span>
          </div>
          <form onSubmit={submit} className="stack-form" aria-busy={busy}>
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="First and last name"
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={busy}
                />
              </label>
            )}
            <label>
              {register ? "Email address" : "Demo profile email"}
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
                  Password
                  <input
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
                    Use 8–128 characters.
                  </span>
                </label>
                <label>
                  Confirm password
                  <input
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
                ? "Creating account…"
                : register
                  ? "Create account"
                  : "Open demo profile"}
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Want to explore the demo?" : "New around here?"}{" "}
            <Link
              href={`${register ? "/sign-in" : "/register"}?${suffix.slice(1)}`}
            >
              {register ? "Open a demo profile" : "Create an account"}
            </Link>
          </p>
          {!register && (
            <>
              <div className="demo-divider">
                <span>Or take a look around</span>
              </div>
              <div className="demo-role-buttons">
                <button className="btn btn-secondary" onClick={() => enter("dana")}>
                  <Icon name="ticket" size={17} />
                  Try attendee
                </button>
                <button className="btn btn-secondary" onClick={() => enter("arman")}>
                  <Icon name="grid" size={17} />
                  Try organizer
                </button>
                <button className="btn btn-secondary" onClick={() => enter("admin")}>
                  <Icon name="grid" size={17} />
                  Try platform admin
                </button>
                <button className="btn btn-secondary" onClick={() => enter("support")}>
                  <Icon name="mail" size={17} />
                  Try support staff
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
