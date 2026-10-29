"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, isUserId, type ApiOrganizerProfile, type ApiUser } from "@/lib/api";
import { useDemo } from "./demo-provider";
import { Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import "./backend-profile.css";
import { useI18n, localeCodes } from "@/lib/i18n";

type ProfileResult<T> =
  | { status: "loading" }
  | { status: "loaded"; profile: T }
  | { status: "error"; message: string };

function useBackendProfile<T>(
  id: string,
  load: (id: string, options: { signal?: AbortSignal }) => Promise<T>,
) {
  const [result, setResult] = useState<ProfileResult<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(id, { signal: controller.signal }).then(
      (profile) => {
        if (!controller.signal.aborted) setResult({ status: "loaded", profile });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            status: "error",
            message: error instanceof Error ? error.message : "Could not load this profile.",
          });
      },
    );
    return () => controller.abort();
  }, [id, attempt, load]);

  function reload() {
    setResult({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  return { result, reload };
}

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

function BackendAccessNotice() {
  const { t } = useI18n();
  return (
    <Notice>
      {t("Integration preview: backend sign-in is not available yet. Account and organizer IDs identify records; they do not verify identity or create a signed-in session.")}</Notice>
  );
}

function ProfileLookup({ organizer = false }: { organizer?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");
  function findProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const id = String(new FormData(event.currentTarget).get("id")).trim();
    if (!isUserId(id))
      return setError(organizer ? t("Enter a valid organizer profile ID.") : t("Enter a valid account ID."));
    router.push(`${organizer ? "/organizer-profile" : "/profile"}?id=${encodeURIComponent(id)}`);
  }

  return (
    <form className="stack-form" onSubmit={findProfile}>
      <label>
        {organizer ? t("Organizer profile ID") : t("Backend account ID")}
        <input name="id" required autoComplete="off" maxLength={36}
          placeholder={organizer ? t("Profile ID returned when it was created") : t("Account ID from registration")} />
        <span className="field-hint">
          {organizer
            ? t("Use the organizer profile ID, which is different from the account ID.")
            : t("Use the ID returned when you created an account.")}
        </span>
      </label>
      {error && <Notice error>{error}</Notice>}
      <button className="btn btn-primary" type="submit">
        {organizer ? t("View organizer profile") : t("View account profile")}
        <Icon name="arrow" size={16} />
      </button>
    </form>
  );
}

function AccountRecord({ initialUser, onRefresh }: { initialUser: ApiUser; onRefresh: () => void }) {
  const { t, locale } = useI18n();
  const [user, setUser] = useState(initialUser);
  const [fullName, setFullName] = useState(initialUser.full_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    setMessage("");
    const name = fullName.trim();
    if (name.length < 2 || name.length > 100 || !/^\p{L}+$/u.test(name.replace(/[ '-]/g, "")))
      return setError(t("Use 2 to 100 characters with letters, spaces, hyphens or apostrophes only."));
    submitting.current = true;
    setBusy(true);
    try {
      const updated = await api.users.update(user.id, { full_name: name });
      setUser(updated);
      setFullName(updated.full_name);
      setMessage(t("The account name was saved."));
    } catch (error) {
      setError(error instanceof Error ? error.message : t("Could not save this account name."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <ProfileDetails rows={[
        [t("Full name"), user.full_name],
        [t("Email address"), user.email],
        [t("Account ID"), user.id],
        [t("Created"), new Intl.DateTimeFormat(localeCodes[locale], locale === "kk"
          ? { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Etc/GMT-5" }
          : { dateStyle: "long", timeZone: "Etc/GMT-5" }).format(new Date(user.created_at))],
      ]} />
      <section className="backend-profile-section" aria-labelledby="account-name-heading">
        <h2 id="account-name-heading">{t("Account name")}</h2>
        <form className="stack-form" onSubmit={save} aria-busy={busy}>
          <label>
            {t("Full name")}<input name="full_name" value={fullName} onChange={(event) => setFullName(event.target.value)}
              required minLength={2} maxLength={100} autoComplete="name" disabled={busy} />
            <span className="field-hint">{t("Email and password changes are not available yet.")}</span>
          </label>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? t("Saving name…") : t("Save name")}
          </button>
        </form>
      </section>
      <section className="backend-profile-section" aria-labelledby="account-organizer-heading">
        <h2 id="account-organizer-heading">{t("Organizer profile")}</h2>
        <p>{t("Set up an organizer display name, or open an existing profile using its organizer profile ID.")}</p>
        <Link className="text-link" href={`/organizer-profile?user=${encodeURIComponent(user.id)}`}>
          {t("Find or create an organizer profile")}{" "}<Icon name="arrow" size={16} />
        </Link>
      </section>
      <div className="button-row">
        <button className="btn btn-secondary" type="button" onClick={onRefresh} disabled={busy}>{t("Refresh profile")}</button>
        <Link className="btn btn-secondary" href="/profile">{t("Find another profile")}</Link>
        <Link className="btn btn-secondary" href="/events">{t("Browse events")}{" "}<Icon name="arrow" size={16} /></Link>
      </div>
    </>
  );
}

function BackendProfile({ id, created }: { id: string; created: boolean }) {
  const { t } = useI18n();
  const { result, reload } = useBackendProfile(id, api.users.get);
  return (
    <main className="workspace profile-workspace">
      <PageIntro eyebrow={t("Account service")} title={t("Account profile.")} description={t("View account details and update the account name.")} />
      {created && <Notice>{t("Your account was created. Save this page to view its details again.")}</Notice>}
      <BackendAccessNotice />
      {result.status === "loaded" ? (
        <AccountRecord initialUser={result.profile} onRefresh={reload} />
      ) : (
        <>
          {result.status === "loading" ? <LoadingPage /> : <Notice error>{result.message}</Notice>}
          <div className="button-row">
            <button className="btn btn-secondary" type="button" onClick={reload} disabled={result.status === "loading"}>
              {result.status === "error" ? t("Try again") : t("Loading profile…")}
            </button>
            <Link className="btn btn-secondary" href="/profile">{t("Find another profile")}</Link>
          </div>
        </>
      )}
    </main>
  );
}

function OrganizerRecord({ initialProfile, onRefresh }: {
  initialProfile: ApiOrganizerProfile;
  onRefresh?: () => void;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile.display_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    setMessage("");
    const name = displayName.trim();
    if (name.length < 2 || name.length > 255)
      return setError(t("Use between 2 and 255 characters for the organizer display name."));
    submitting.current = true;
    setBusy(true);
    try {
      const updated = await api.organizers.update(profile.id, { display_name: name });
      setProfile(updated);
      setDisplayName(updated.display_name);
      setMessage(t("The organizer display name was saved."));
    } catch (error) {
      setError(error instanceof Error ? error.message : t("Could not save this organizer profile."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const verification = {
    pending: "Pending review", verified: "Verified", rejected: "Rejected",
  }[profile.verification_status];

  return (
    <>
      <ProfileDetails rows={[
        [t("Display name"), profile.display_name],
        [t("Organizer profile ID"), profile.id],
        [t("Account ID"), <Link key="account" className="text-link" href={`/profile?id=${encodeURIComponent(profile.user_id)}`}>{profile.user_id}</Link>],
        [t("Verification"), t(verification)],
      ]} />
      <section className="backend-profile-section" aria-labelledby="organizer-name-heading">
        <h2 id="organizer-name-heading">{t("Organizer display name")}</h2>
        <form className="stack-form" onSubmit={save} aria-busy={busy}>
          <label>
            {t("Display name")}<input name="display_name" value={displayName} onChange={(event) => setDisplayName(event.target.value)}
              required minLength={2} maxLength={255} autoComplete="organization" disabled={busy} />
            <span className="field-hint">{t("Verification status is read-only and managed by the platform.")}</span>
          </label>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? t("Saving profile…") : t("Save organizer name")}
          </button>
        </form>
      </section>
      <div className="button-row">
        <Link className="btn btn-primary" href={`/workspace?organizer=${encodeURIComponent(profile.id)}`}>
          {t("Open event workspace")}{" "}<Icon name="arrow" size={16} />
        </Link>
        <Link className="btn btn-secondary" href={`/organizer-profile?id=${encodeURIComponent(profile.id)}`}>{t("Saved profile link")}</Link>
        {onRefresh && <button className="btn btn-secondary" type="button" onClick={onRefresh} disabled={busy}>{t("Refresh profile")}</button>}
        <Link className="btn btn-secondary" href="/organizer-profile">{t("Find another profile")}</Link>
      </div>
    </>
  );
}

function BackendOrganizerProfile({ id }: { id: string }) {
  const { t } = useI18n();
  const { result, reload } = useBackendProfile(id, api.organizers.get);
  if (result.status === "loaded") return <OrganizerRecord initialProfile={result.profile} onRefresh={reload} />;
  return (
    <>
      {result.status === "loading" ? <LoadingPage /> : <Notice error>{result.message}</Notice>}
      <div className="button-row">
        <button className="btn btn-secondary" type="button" onClick={reload} disabled={result.status === "loading"}>
          {result.status === "error" ? t("Try again") : t("Loading profile…")}
        </button>
        <Link className="btn btn-secondary" href="/organizer-profile">{t("Find another profile")}</Link>
      </div>
    </>
  );
}

function CreateOrganizerProfile({ userId }: { userId?: string }) {
  const { t } = useI18n();
  const [accountId, setAccountId] = useState(userId ?? "");
  const [displayName, setDisplayName] = useState("");
  const [created, setCreated] = useState<ApiOrganizerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const id = accountId.trim();
    const name = displayName.trim();
    if (!isUserId(id)) return setError(t("Enter a valid backend account ID."));
    if (name.length < 2 || name.length > 255)
      return setError(t("Use between 2 and 255 characters for the organizer display name."));
    submitting.current = true;
    setBusy(true);
    try {
      setCreated(await api.organizers.create(id, { display_name: name }));
    } catch (error) {
      setError(error instanceof Error ? error.message : t("Could not create this organizer profile."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (created)
    return (
      <section className="backend-profile-section" aria-labelledby="organizer-created-heading">
        <h2 id="organizer-created-heading">{t("Organizer profile created")}</h2>
        <Notice>{t("Save the profile link below. You will need its organizer profile ID to open it again.")}</Notice>
        <OrganizerRecord key={created.id} initialProfile={created} />
      </section>
    );

  return (
    <section className="backend-profile-section" aria-labelledby="create-organizer-heading">
      <h2 id="create-organizer-heading">{t("Create an organizer profile")}</h2>
      <p>
        {t("Use a registered backend account. Each account can have one organizer profile. If one already exists, open it using its organizer profile ID above; lookup by account ID is not available.")}</p>
      <form className="stack-form" onSubmit={create} aria-busy={busy}>
        <label>
          {t("Backend account ID")}<input name="user_id" value={accountId} onChange={(event) => setAccountId(event.target.value)}
            required maxLength={36} autoComplete="off" placeholder={t("Account ID from registration")} disabled={busy} />
        </label>
        <label>
          {t("Organizer display name")}<input name="display_name" value={displayName} onChange={(event) => setDisplayName(event.target.value)}
            required minLength={2} maxLength={255} autoComplete="organization" disabled={busy} />
        </label>
        {error && <Notice error>{error}</Notice>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t("Creating profile…") : t("Create organizer profile")}
          <Icon name="arrow" size={16} />
        </button>
      </form>
      <p className="auth-switch">{t("Need an account?")}{" "}<Link href="/register">{t("Create an account")}</Link></p>
    </section>
  );
}

export function OrganizerProfilePage({ id, userId }: { id?: string; userId?: string }) {
  const { t } = useI18n();
  return (
    <main className="workspace profile-workspace">
      <PageIntro eyebrow={t("Organizer service")} title={t("Organizer profile.")} description={t("Find or create an organizer profile, then open its event workspace.")} />
      <BackendAccessNotice />
      {id ? (
        <BackendOrganizerProfile key={id} id={id} />
      ) : (
        <>
          <section className="backend-profile-section" aria-labelledby="find-organizer-heading">
            <h2 id="find-organizer-heading">{t("Find an organizer profile")}</h2>
            <ProfileLookup organizer />
          </section>
          <CreateOrganizerProfile key={userId ?? "new"} userId={userId} />
        </>
      )}
    </main>
  );
}

export function ProfilePage({ id, created }: { id?: string; created: boolean }) {
  const { t } = useI18n();
  const { user, ready } = useDemo();
  if (id) return <BackendProfile key={id} id={id} created={created} />;
  if (!ready) return <LoadingPage />;

  return (
    <main className="workspace profile-workspace">
      <PageIntro eyebrow={user ? t("Browser demo") : t("Account service")} title={user ? t("Your demo profile.") : t("Find an account profile.")} />
      {user && (
        <>
          <Notice>{t("This demo profile is stored in this browser. It is separate from backend accounts.")}</Notice>
          <ProfileDetails rows={[[t("Name"), user.name], [t("Email address"), user.email], [t("Demo role"), t(user.role)]]} />
        </>
      )}
      <section className="backend-profile-section" aria-labelledby="find-account-heading">
        <h2 id="find-account-heading">{t("Find a backend account")}</h2>
        <BackendAccessNotice />
        <ProfileLookup />
      </section>
      <p className="auth-switch">{t("Need an account?")}{" "}<Link href="/register">{t("Create an account")}</Link></p>
      <Link className="text-link" href="/organizer-profile">{t("Find or create an organizer profile")}{" "}<Icon name="arrow" size={16} /></Link>
    </main>
  );
}
