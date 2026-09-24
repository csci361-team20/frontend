"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "./demo-provider";
import { Brand, Icon } from "./primitives";
import { canCheckIn } from "@/lib/demo-data";

export function SiteHeader() {
  const { user, state, update, storageError } = useDemo();
  const pathname = usePathname();
  const router = useRouter();
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
              className={pathname.startsWith("/organizer") ? "active" : ""}
              href="/organizer"
            >
              For organizers <Icon name="external" size={12} />
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
                    <small>{user.role} · demo profile</small>
                  </p>
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
                  {state.events.some((e) => canCheckIn(user, e)) && (
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
                    Sign out
                  </button>
                </div>
              </details>
            ) : (
              <Link className="btn btn-small btn-light" href="/sign-in">
                Sign in <Icon name="arrow" size={15} />
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
    </>
  );
}
