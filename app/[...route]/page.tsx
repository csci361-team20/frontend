import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleApp } from "@/components/role-app";

const titles: Record<string, string> = {
  events: "What’s on",
  "sign-in": "Welcome back",
  register: "Create a profile",
  orders: "Your tickets",
  checkout: "Your booking",
  organizer: "Your box office",
  "check-in": "Check-in desk",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ route: string[] }>;
}): Promise<Metadata> {
  const { route } = await params;
  return { title: `${titles[route[0]] ?? "Not found"} — ticketelo` };
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
    /^(events(?:\/[^/]+)?|orders(?:\/[^/]+)?|checkout\/[^/]+|sign-in|register|organizer(?:\/events\/[^/]+)?|check-in)$/.test(
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
