"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type MouseEvent } from "react";
import { canCheckIn } from "@/lib/demo-data";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { canViewCase } from "@/lib/operations";
import { useSession } from "@/lib/session";
import { useDemo } from "./demo-provider";
import { Brand, Icon, Notice } from "./primitives";

export function SiteHeader() {
  const { t } = useI18n();
  const { user: demoUser, state, update, storageError } = useDemo();
  const { status, user, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const submitting = useRef(false);
  const account = status === "signed-in" ? user : null;
  const accountName = account?.full_name ?? demoUser?.name;
  const unread = state.operations.notifications.filter((item) => item.userId === demoUser?.id && !item.read && (!item.caseId || state.operations.cases.some((supportCase) => supportCase.id === item.caseId && canViewCase(state, demoUser, supportCase)))).length;

  function closeMenu(event: MouseEvent<HTMLElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  async function leaveAccount(event: MouseEvent<HTMLButtonElement>) {
    if (submitting.current) return;
    const menu = event.currentTarget.closest("details");
    submitting.current = true;
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
      menu?.removeAttribute("open");
      router.replace("/");
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : t("Could not sign out. Please try again."));
    } finally {
      submitting.current = false;
      setSigningOut(false);
    }
  }

  return <>
    <header className="site-header"><nav className="site-nav" aria-label={t("Main navigation")}>
      <Brand />
      <div className="nav-links">
        <Link className={pathname.startsWith("/events") ? "active" : ""} href="/events">{t("What's on")}</Link>
        <Link className={pathname.startsWith("/orders") ? "active" : ""} href="/orders">{t("My tickets")}</Link>
        <Link className={pathname.startsWith("/workspace") ? "active" : ""} href="/workspace">{t("For organizers")}<Icon name="external" size={12} /></Link>
        <Link className={pathname.startsWith("/support") ? "active" : ""} href="/support">{t("Support")}{" "}{unread > 0 && <span className="notification-count" aria-label={t("{count} unread notifications", { count: unread })}>{unread}</span>}</Link>
      </div>
      <div className="nav-account">
        <LanguageSwitcher />
        {accountName ? <details className="account-menu">
          <summary aria-label={t("Account menu")}>
            <span className="avatar">{accountName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <span className="account-name">{accountName.split(" ")[0]}</span>
            <Icon name="chevron" size={14} />
          </summary>
          <div className="account-dropdown">
            {account ? <>
              <p>{account.full_name}<small>{t("Account profile.")}</small></p>
              <Link href="/profile" onClick={closeMenu}>{t("Profile")}</Link>
              <Link href="/organizer-profile" onClick={closeMenu}>{t("Organizer profile")}</Link>
              <button type="button" onClick={leaveAccount} disabled={signingOut}>{signingOut ? t("Signing out…") : t("Sign out")}</button>
              {signOutError && <Notice error>{signOutError}</Notice>}
            </> : <Link href="/sign-in" onClick={closeMenu}>{t("Sign in")}</Link>}
            {demoUser ? <>
              <p>{demoUser.name}<small>{t(demoUser.role)} {t("· demo profile")}</small></p>
              <Link href="/profile#demo-profile" onClick={closeMenu}>{t("Your demo profile.")}</Link>
              <Link href="/events?source=demo" onClick={closeMenu}>{t("Demo events")}</Link>
              <Link href="/support" onClick={closeMenu}>{t("Support cases")}{" "}{unread > 0 ? `(${t("{count} unread notifications", { count: unread })})` : ""}</Link>
              {demoUser.role === "platform_admin" && <Link href="/admin" onClick={closeMenu}>{t("Platform administration")}</Link>}
              <Link href="/orders" onClick={closeMenu}>{t("My tickets & orders")}</Link>
              {demoUser.role === "organizer" && <Link href="/organizer" onClick={closeMenu}>{t("Demo organizer workspace")}</Link>}
              {state.events.some((event) => canCheckIn(demoUser, event, state)) && <Link href="/check-in" onClick={closeMenu}>{t("Check-in desk")}</Link>}
              <Link href="/sign-in#demo" onClick={closeMenu}>{t("Switch demo profile")}</Link>
              <button type="button" onClick={(event) => { closeMenu(event); update((value) => ({ ...value, currentUserId: null })); router.push("/"); }}>{t("Leave demo profile")}</button>
            </> : <Link href="/sign-in#demo" onClick={closeMenu}>{t("Open a demo profile")}</Link>}
          </div>
        </details> : <Link className="btn btn-small btn-light" href="/sign-in">{t("Sign in")}<Icon name="arrow" size={15} /></Link>}
      </div>
    </nav></header>
    {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
    {demoUser?.suspended && <div className="storage-warning" role="status">{t("This demo profile is suspended. Booking and organizer access are paused.")}{" "}<Link href="/support/new?category=account">{t("Contact support")}</Link></div>}
    {!state.operations.settings.bookingsEnabled && <div className="storage-warning" role="status">{t("Bookings are temporarily paused.")}{" "}<Link href="/support">{t("Contact support")}</Link> {t("for an existing order.")}</div>}
  </>;
}
