"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiUser } from "@/lib/api";
import { useDemo } from "./demo-provider";
import { Icon, LoadingPage, Notice, PageIntro } from "./primitives";

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

function BackendProfile({ id, created }: { id: string; created: boolean }) {
  const [result, setResult] = useState<
    | { status: "loading" }
    | { status: "loaded"; user: ApiUser }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.users.get(id, { signal: controller.signal }).then(
      (user) => {
        if (!controller.signal.aborted) setResult({ status: "loaded", user });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            status: "error",
            message: error instanceof Error ? error.message : "Could not load this account.",
          });
      },
    );
    return () => controller.abort();
  }, [id, attempt]);

  function reload() {
    setResult({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  return (
    <main className="workspace profile-workspace">
      <PageIntro eyebrow="Account service" title="Account profile." description="View account details from the account service." />
      {created && <Notice>Your account was created. Save this page to view its details again.</Notice>}
      <Notice>Backend sign-in is not available yet. Viewing this profile does not start a signed-in session. Profile editing is not available yet.</Notice>
      {result.status === "loading" ? (
        <LoadingPage />
      ) : result.status === "error" ? (
        <Notice error>{result.message}</Notice>
      ) : (
        <ProfileDetails
          rows={[
            ["Full name", result.user.full_name],
            ["Email address", result.user.email],
            ["Account ID", result.user.id],
            ["Created", new Intl.DateTimeFormat("en-GB", {
              dateStyle: "long",
              timeZone: "Asia/Almaty",
            }).format(new Date(result.user.created_at))],
          ]}
        />
      )}
      <div className="button-row">
        <button className="btn btn-secondary" onClick={reload} disabled={result.status === "loading"}>
          {result.status === "error" ? "Try again" : "Refresh profile"}
        </button>
        <Link className="btn btn-secondary" href="/profile">Find another profile</Link>
        <Link className="btn btn-secondary" href="/events">Browse events <Icon name="arrow" size={16} /></Link>
      </div>
    </main>
  );
}

export function ProfilePage({ id, created }: { id?: string; created: boolean }) {
  const { user, ready } = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  if (id) return <BackendProfile key={id} id={id} created={created} />;
  if (!ready) return <LoadingPage />;

  function findProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("id")).trim();
    if (!value) return setError("Enter the account ID from your registration.");
    router.push(`/profile?id=${encodeURIComponent(value)}`);
  }

  return (
    <main className="workspace profile-workspace">
      <PageIntro eyebrow={user ? "Browser demo" : "Account service"} title={user ? "Your demo profile." : "Find an account profile."} />
      {user && (
        <>
          <Notice>This demo profile is stored in this browser. It is separate from backend accounts.</Notice>
          <ProfileDetails
            rows={[["Name", user.name], ["Email address", user.email], ["Demo role", user.role]]}
          />
        </>
      )}
      <form className="stack-form" onSubmit={findProfile}>
        <label>
          Backend account ID
          <input name="id" required placeholder="Account ID from registration" autoComplete="off" maxLength={36} />
          <span className="field-hint">Use the ID returned when you created an account. Backend sign-in is not available yet.</span>
        </label>
        {error && <Notice error>{error}</Notice>}
        <button className="btn btn-primary">View account profile <Icon name="arrow" size={16} /></button>
      </form>
      <p className="auth-switch">Need an account? <Link href="/register">Create an account</Link></p>
    </main>
  );
}
