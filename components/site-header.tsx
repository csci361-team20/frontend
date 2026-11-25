"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type MouseEvent } from "react";
import { signOut, useSession } from "./session-provider";
import { NotificationBell } from "./notifications";
import { Brand, Icon } from "./primitives";

import { LanguageSwitch, useT } from "@/components/language";
const close = (event: MouseEvent<HTMLElement>) =>
  event.currentTarget.closest("details")?.removeAttribute("open");

export function SiteHeader() {
  const t = useT();
  const { user, organizer, staffEvents, isAdmin } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  // Earlier builds kept sample data in the browser; it is no longer read
  useEffect(() => {
    try {
      localStorage.removeItem("biletflow-demo-v1");
      localStorage.removeItem("ticketelo-demo-v1");
    } catch {
      // Storage blocked: nothing to clean up
    }
  }, []);
  const workspace = isAdmin ? "/admin" : "/organizer";
  const checkIn = staffEvents.length > 0;
  return (
    <>
      <header className="site-header">
        <nav className="site-nav" aria-label={t("Main navigation")}>
          <Brand />
          <div className="nav-links">
            <Link className={pathname.startsWith("/events") ? "active" : ""} href="/events">{t("What's on")}</Link>
            <Link className={pathname.startsWith("/orders") ? "active" : ""} href="/orders">{t("My tickets")}</Link>
            <Link className={pathname.startsWith(workspace) ? "active" : ""} href={workspace}>
              {isAdmin ? t("Administration") : t("For organizers")} <Icon name="external" size={12} />
            </Link>
            <Link className={pathname.startsWith("/support") ? "active" : ""} href="/support">{t("Support")}</Link>
          </div>
          <div className="nav-account">
            <LanguageSwitch />
            <NotificationBell />
            {user ? (
              <details className="account-menu">
                <summary>
                  <span className="avatar">
                    {user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="account-name">{user.full_name.split(" ")[0]}</span>
                  <Icon name="chevron" size={14} />
                </summary>
                <div className="account-dropdown">
                  <p>
                    {user.full_name}
                    <small>
                      {isAdmin ? t("platform admin") : organizer ? t("organizer") : t("attendee")} · {user.email}
                    </small>
                  </p>
                  <Link href="/profile" onClick={close}>{t("Profile")}</Link>
                  <Link href="/orders" onClick={close}>{t("My tickets & orders")}</Link>
                  <Link href="/support" onClick={close}>{t("Support cases")}</Link>
                  <Link href="/notifications" onClick={close}>{t("Notifications")}</Link>
                  {isAdmin && <Link href="/admin" onClick={close}>{t("Platform administration")}</Link>}
                  {(organizer || staffEvents.some((e) => e.my_role === "owner" || e.my_role === "manager")) && (
                    <Link href="/organizer" onClick={close}>{t("Organizer workspace")}</Link>
                  )}
                  {checkIn && <Link href="/check-in" onClick={close}>{t("Check-in desk")}</Link>}
                  <button
                    onClick={async (event) => {
                      close(event);
                      await signOut();
                      router.push("/");
                    }}
                  >{t("Sign out")}</button>
                </div>
              </details>
            ) : (
              <Link className="btn btn-small btn-light" href="/sign-in">{t("Sign in")}{" "}<Icon name="arrow" size={15} />
              </Link>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
