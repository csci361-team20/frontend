"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { Icon, Notice, Poster } from "./primitives";
import { initialEvents, type Role } from "@/lib/demo-data";

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
  const [role, setRole] = useState<Role>(
    initialRole === "organizer" ? "organizer" : "attendee",
  );
  const [error, setError] = useState("");
  function destination(userRole: Role) {
    return next?.startsWith("/") &&
      !next.startsWith("//") &&
      !next.startsWith("/sign-in") &&
      !next.startsWith("/register")
      ? next
      : userRole === "organizer"
        ? "/organizer"
        : "/orders";
  }
  function enter(id: string) {
    const profile = state.profiles.find((p) => p.id === id)!;
    update((s) => ({ ...s, currentUserId: id }));
    router.push(destination(profile.role));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const existing = state.profiles.find((p) => p.email === email);
    if (!register) {
      if (!existing)
        return setError(
          "No profile with this email in this browser yet. Create one below, or try a demo profile.",
        );
      return enter(existing.id);
    }
    if (existing)
      return setError(
        "That email already has a demo profile. Sign in instead.",
      );
    const name = String(data.get("name")).trim();
    if (!name) return setError("Tell us your name.");
    const id = crypto.randomUUID();
    update((s) => ({
      ...s,
      profiles: [...s.profiles, { id, name, email, role }],
      currentUserId: id,
    }));
    router.push(destination(role));
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
              Frontend preview. Profiles are saved in this browser; no password
              or payment is required.
            </span>
          </div>
          <form onSubmit={submit} className="stack-form">
            {register && (
              <>
                <fieldset className="role-picker">
                  <legend>I&apos;m here to</legend>
                  <button
                    type="button"
                    className={role === "attendee" ? "selected" : ""}
                    aria-pressed={role === "attendee"}
                    onClick={() => setRole("attendee")}
                  >
                    <Icon name="ticket" />
                    <strong>Find my next event</strong>
                    <small>Attendee</small>
                  </button>
                  <button
                    type="button"
                    className={role === "organizer" ? "selected" : ""}
                    aria-pressed={role === "organizer"}
                    onClick={() => setRole("organizer")}
                  >
                    <Icon name="grid" />
                    <strong>Bring people together</strong>
                    <small>Organizer</small>
                  </button>
                </fieldset>
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="First and last name"
                    required
                    maxLength={80}
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={200}
              />
            </label>
            {error && <Notice error>{error}</Notice>}
            <button className="btn btn-primary btn-full">
              {register ? "Create demo profile" : "Continue to my profile"}
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have a profile?" : "New around here?"}{" "}
            <Link
              href={`${register ? "/sign-in" : "/register"}?${suffix.slice(1)}`}
            >
              {register ? "Sign in" : "Create a profile"}
            </Link>
          </p>
          <div className="demo-divider">
            <span>Or take a look around</span>
          </div>
          <div className="demo-role-buttons">
            <button className="btn btn-secondary" onClick={() => enter("dana")}>
              <Icon name="ticket" size={17} />
              Try attendee
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => enter("arman")}
            >
              <Icon name="grid" size={17} />
              Try organizer
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
