"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "./demo-provider";
import { Brand, Icon } from "./primitives";
import { canCheckIn } from "@/lib/demo-data";
import { canViewCase } from "@/lib/operations";

export function SiteHeader() {
  const { user, state, update, storageError } = useDemo();
  const pathname = usePathname();
  const router = useRouter();
  const unread = state.operations.notifications.filter((n) => n.userId === user?.id && !n.read && (!n.caseId || state.operations.cases.some((c) => c.id === n.caseId && canViewCase(state, user, c)))).length;
  return (
    <>
      <header className="site-header">
        <nav className="site-nav" aria-label="Main navigation">
          <Brand />
          <div className="nav-links">
            <Link
              className={pathname.startsWith("/events") ? "active" : ""}
              href="/events"
            >
              What&apos;s on
            </Link>
            <Link
              className={pathname.startsWith("/orders") ? "active" : ""}
              href="/orders"
            >
              My tickets
            </Link>
            <Link
              className={pathname.startsWith(user?.role === "platform_admin" ? "/admin" : "/organizer") ? "active" : ""}
              href={user?.role === "platform_admin" ? "/admin" : "/organizer"}
            >
              {user?.role === "platform_admin" ? "Administration" : "For organizers"} <Icon name="external" size={12} />
            </Link>
            <Link className={pathname.startsWith("/support") ? "active" : ""} href="/support">
              Support {unread > 0 && <span className="notification-count" aria-label={`${unread} unread notifications`}>{unread}</span>}
            </Link>
          </div>
          <div className="nav-account">
            {user ? (
              <details className="account-menu">
                <summary>
                  <span className="avatar">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="account-name">
                    {user.name.split(" ")[0]}
                  </span>
                  <Icon name="chevron" size={14} />
                </summary>
                <div className="account-dropdown">
                  <p>
                    {user.name}
                    <small>{user.role.replaceAll("_", " ")} · demo profile</small>
                  </p>
                  <Link
                    href="/profile"
                    onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                  >
                    Profile
                  </Link>
                  <Link href="/support" onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
                    Support cases {unread > 0 ? `(${unread} unread)` : ""}
                  </Link>
                  {user.role === "platform_admin" && <Link href="/admin" onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
                    Platform administration
                  </Link>}
                  <Link
                    href="/orders"
                    onClick={(e) =>
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    My tickets & orders
                  </Link>
                  {user.role === "organizer" && (
                    <Link
                      href="/organizer"
                      onClick={(e) =>
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      Organizer workspace
                    </Link>
                  )}
                  {state.events.some((e) => canCheckIn(user, e, state)) && (
                    <Link
                      href="/check-in"
                      onClick={(e) =>
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      Check-in desk
                    </Link>
                  )}
                  <Link
                    href="/sign-in"
                    onClick={(e) =>
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    Switch demo profile
                  </Link>
                  <button
                    onClick={(e) => {
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      update((s) => ({ ...s, currentUserId: null }));
                      router.push("/");
                    }}
                  >
                    Leave demo profile
                  </button>
                </div>
              </details>
            ) : (
              <Link className="btn btn-small btn-light" href="/sign-in">
                Sign in / demo <Icon name="arrow" size={15} />
              </Link>
            )}
          </div>
        </nav>
      </header>
      {storageError && (
        <div className="storage-warning" role="alert">
          {storageError}
        </div>
      )}
      {user?.suspended && <div className="storage-warning" role="status">This demo profile is suspended. Booking and organizer access are paused. <Link href="/support/new?category=account">Contact support</Link></div>}
      {!state.operations.settings.bookingsEnabled && <div className="storage-warning" role="status">Bookings are temporarily paused. <Link href="/support">Contact support</Link> for an existing order.</div>}
    </>
  );
}
