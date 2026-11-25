import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleApp } from "@/components/role-app";
import { BACKEND_URL } from "@/lib/server/backend";
import { tk } from "@/lib/i18n";
import { serverT } from "@/lib/i18n-server";

const titles: Record<string, string> = {
  events: tk("What’s on"),
  "sign-in": tk("Welcome back"),
  register: tk("Create an account"),
  "forgot-password": tk("Reset your password"),
  "reset-password": tk("Choose a new password"),
  "verify-email": tk("Confirm your email"),
  profile: tk("Account profile"),
  orders: tk("Your tickets"),
  checkout: tk("Your booking"),
  organizer: tk("Your box office"),
  "check-in": tk("Check-in desk"),
  admin: tk("Platform administration"),
  support: tk("Support cases"),
  notifications: tk("Notifications"),
};
/** The event's title for the browser tab and link previews (public events only). */
async function publicEvent(id: string): Promise<{ title: string; subtitle: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const response = await fetch(`${BACKEND_URL}/events/${id}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ route: string[] }>;
}): Promise<Metadata> {
  const { route } = await params;
  if (route[0] === "events" && route.length === 2) {
    const event = await publicEvent(route[1]);
    if (event)
      return {
        title: `${event.title} — BiletFlow`,
        description: event.subtitle ?? undefined,
      };
  }
  const t = await serverT();
  return { title: `${t(titles[route[0]] ?? tk("Not found"))} — BiletFlow` };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ route: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { route } = await params;
  const valid =
    /^(events(?:\/[^/]+)?|orders(?:\/[^/]+)?|checkout\/[^/]+|sign-in|register|forgot-password|reset-password|verify-email|profile|admin|support(?:\/[^/]+)?|organizer(?:\/events\/[^/]+)?|check-in|notifications)$/.test(
      route.join("/"),
    );
  if (!valid) notFound();
  const search = await searchParams;
  const query = Object.fromEntries(
    Object.entries(search).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : (value ?? ""),
    ]),
  );
  return <RoleApp route={route} query={query} />;
}
