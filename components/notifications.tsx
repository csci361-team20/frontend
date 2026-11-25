"use client";

/** In-app notifications: a bell with the unread count, and the full list page. */

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { api } from "@/lib/api";
import { safeLink, type AppNotification } from "@/lib/support";
import { useSession } from "./session-provider";
import { useLoad } from "./use-load";
import { EmptyState, Icon, LoadingPage, Notice, PageIntro } from "./primitives";
import { useT } from "@/components/language";
import { formatDate, getLang } from "@/lib/i18n";

const stamp = (value: string) =>
  formatDate(getLang(), new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" });

// Pages that mark notifications read tell the bell to look again
const CHANGED = "biletflow:notifications";
const announce = () => window.dispatchEvent(new Event(CHANGED));

/** Header bell. Polls the cheap unread-count endpoint once a minute. */
export function NotificationBell() {
  const t = useT();
  const { user } = useSession();
  const [unread, setUnread] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const check = () =>
      api
        .request<{ unread: number }>("/notifications/unread-count")
        .then((r) => alive && setUnread(r.unread))
        .catch(() => undefined);
    void check();
    const timer = setInterval(check, 60000);
    const again = () => setTick((t) => t + 1);
    window.addEventListener(CHANGED, again);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(CHANGED, again);
    };
  }, [user, tick]);
  if (!user) return null;
  return (
    <Link className="notification-bell" href="/notifications" aria-label={unread ? t("Notifications, {unread} unread", { unread: unread }) : t("Notifications")}>
      <Icon name="bell" size={18} />
      {unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}

export function NotificationsPage() {
  const t = useT();
  const { user, ready } = useSession();
  const [version, setVersion] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState("");
  const list = useLoad(`notifications:${user?.id ?? ""}:${onlyUnread}:${version}`, (signal) =>
    user
      ? api.request<AppNotification[]>("/notifications", { signal, query: { unread_only: onlyUnread || undefined, limit: 100 } })
      : Promise.resolve([] as AppNotification[]),
  );

  async function act(path: string) {
    setError("");
    try {
      await api.request(path, { method: "POST" });
      setVersion((v) => v + 1);
      announce();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not update notifications."));
    }
  }

  if (!ready) return <LoadingPage />;
  if (!user)
    return (
      <main className="workspace narrow-workspace">
        <EmptyState icon="bell" title={t("Nothing to miss here.")} description={t("Sign in to see updates about your tickets, events and support cases.")} href="/sign-in?next=/notifications" label={t("Sign in")} />
      </main>
    );
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.is_read).length;
  return (
    <main className="workspace narrow-workspace">
      <PageIntro
        eyebrow={t("Keeping you posted")}
        title={t("Notifications.")}
        description={t("Order, event and support updates, in the language set on your profile. Most of them also come by email.")}
        action={
          unread > 0 && (
            <button className="btn btn-secondary" onClick={() => act("/notifications/read-all")}>
              <Icon name="check" size={15} />{" "}{t("Mark all read")}</button>
          )
        }
      />
      <label className="checkbox-label">
        <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />{" "}{t("Only unread")}</label>
      {(error || list.status === "error") && <Notice error>{error || (list.status === "error" ? list.error.message : "")}</Notice>}
      {!list.data ? (
        <LoadingPage />
      ) : items.length ? (
        <ol className="notification-list">
          {items.map((n) => {
            const href = safeLink(n.link);
            const open = (e: MouseEvent) => {
              if (!n.is_read) void act(`/notifications/${n.id}/read`);
              if (!href) e.preventDefault();
            };
            return (
              <li key={n.id} className={n.is_read ? "" : "notification-unread"}>
                <div>
                  {href ? (
                    <Link href={href} onClick={open}>{n.message}</Link>
                  ) : (
                    <p>{n.message}</p>
                  )}
                  <time dateTime={n.created_at}>{stamp(n.created_at)}</time>
                </div>
                {!n.is_read && (
                  <button className="text-link" onClick={() => act(`/notifications/${n.id}/read`)} aria-label={t("Mark read: {message}", { message: n.message })}>{t("Mark read")}</button>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState icon="bell" title={onlyUnread ? t("All caught up.") : t("No notifications yet.")} description={t("Updates about your orders, events and support cases appear here.")} />
      )}
    </main>
  );
}
