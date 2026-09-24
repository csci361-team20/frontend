import Link from "next/link";
import type { ReactNode } from "react";
import { dateLabel, type Event } from "@/lib/demo-data";

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    back: <path d="M20 12H5m6-6-6 6 6 6" />,
    ticket: (
      <>
        <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
        <path d="M15 5v2m0 3v2m0 3v4" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M4 11h16" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 4v2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.ticket}
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Ticketelo home">
      <span className="brand-mark">
        <Icon name="ticket" />
      </span>
      ticket<span>elo</span>
      <span className="brand-period">.</span>
    </Link>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="intro-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  icon = "ticket",
  title,
  description,
  href,
  label,
}: {
  icon?: string;
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && (
        <Link className="btn btn-primary" href={href}>
          {label}
          <Icon name="arrow" size={16} />
        </Link>
      )}
    </div>
  );
}
export function Poster({
  event,
  compact = false,
}: {
  event: Event;
  compact?: boolean;
}) {
  const words: Record<string, ReactNode> = {
    concert: (
      <>
        STEPPE
        <br />
        <i>SOUND</i>
      </>
    ),
    cine: (
      <>
        THE LONG
        <br />
        <i>AFTERNOON</i>
      </>
    ),
    theatre: (
      <>
        ABAI
        <br />
        <i>in three acts</i>
      </>
    ),
    fest: (
      <>
        DESHT
        <br />
        <i>electronic</i>
      </>
    ),
    comedy: (
      <>
        THE
        <br />
        <i>LATE LIST</i>
      </>
    ),
    sport: (
      <>
        TIGERS
        <br />
        <i>× FALCONS</i>
      </>
    ),
  };
  return (
    <div
      className={`event-poster poster-${event.poster} ${compact ? "poster-compact" : ""}`}
      aria-hidden="true"
    >
      <div className="poster-top">
        <span>TICKET ELO / LIVE CULTURE</span>
        <span>{dateLabel(event.date)}</span>
      </div>
      <div className="poster-art">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="poster-title">
        {event.id === event.poster ? words[event.poster] : event.title}
      </div>
      <div className="poster-bottom">
        <span>{event.city.toUpperCase()}</span>
        <span>
          {event.category.toUpperCase()} — {new Date(event.date).getFullYear()}
        </span>
      </div>
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function LoadingPage() {
  return (
    <div className="workspace loading-page" aria-busy="true">
      <span className="eyebrow">Just a moment</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
export function Gate({ organizer = false }: { organizer?: boolean }) {
  return (
    <div className="workspace">
      <EmptyState
        icon={organizer ? "grid" : "ticket"}
        title={
          organizer
            ? "Your box office starts here."
            : "Keep your nights in one place."
        }
        description={
          organizer
            ? "Sign in with an organizer profile to create events and manage your guest list."
            : "Sign in to see your orders, book an event, and download your tickets."
        }
        href={organizer ? "/sign-in?role=organizer" : "/sign-in"}
        label="Sign in"
      />
    </div>
  );
}
