"use client";

import Link from "next/link";
import { LandingEvents } from "@/components/attendee-pages";
import { Brand, Icon } from "@/components/primitives";
import { useI18n } from "@/lib/i18n";

const categories = ["Cinema", "Concerts", "Theatre", "Festivals", "Comedy", "Sport"];
const categoryColors = ["#7ca8ff", "#ff5da2", "#e9b84e", "#55d6a8", "#ffc24b", "#7be06a"];

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="relative flex flex-1 flex-col overflow-x-clip">
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 80% at 85% 0%, rgba(255,106,61,0.18), transparent 65%)" }} />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-8">
            <p className="font-mono text-xs uppercase tracking-widest text-ember">{t("The next plan starts here.")}</p>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-light leading-tight tracking-tight text-cream sm:text-6xl lg:text-7xl">{t("Find an event worth showing up for.")}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">{t("Discover published events, explore dates and venues, and plan your next outing in Kazakhstan.")}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/events" className="btn btn-primary">{t("Browse events")}<Icon name="arrow" size={18} /></Link>
              <Link href="/workspace" className="btn btn-secondary">{t("Organizer workspace")}</Link>
            </div>
          </div>
          <div className="flex items-center lg:col-span-4">
            <div className="w-full rounded-xl border border-line bg-ink-800 p-7">
              <Icon name="calendar" size={38} />
              <h2 className="mt-6 font-display text-3xl">{t("Explore by category")}</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {categories.map((category, index) => <Link key={category} href={`/events?category=${encodeURIComponent(category)}`} className="flex items-center gap-2 rounded-md border border-line px-3 py-3 text-sm hover:border-ember">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categoryColors[index] }} />{t(category)}
                </Link>)}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="whatson" className="mx-auto w-full max-w-7xl px-5 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-xs uppercase tracking-widest text-ember">BiletFlow</p><h2 className="mt-3 font-display text-4xl">{t("Published events")}</h2><p className="mt-3 text-sm text-muted">{t("Dates, venues and event details from organizers.")}</p></div>
          <Link href="/events" className="text-link">{t("View all events")}<Icon name="arrow" size={16} /></Link>
        </div>
        <LandingEvents />
      </section>
      <section className="border-y border-line bg-ink-800/60">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-2xl"><h2 className="font-display text-4xl">{t("Bring your event to BiletFlow.")}</h2><p className="mt-5 leading-relaxed text-muted">{t("Create an organizer profile, prepare event details and ticket types, preview your page, then publish when ready.")}</p></div>
          <Link href="/workspace" className="btn btn-primary mt-7 lg:mt-0">{t("Open organizer workspace")}<Icon name="arrow" size={16} /></Link>
        </div>
      </section>
      <footer className="mx-auto w-full max-w-7xl px-5 py-12">
        <div className="flex flex-wrap justify-between gap-10">
          <div><Brand /><p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t("Tickets for the nights worth remembering.")}</p></div>
          <div><h2 className="font-mono text-xs uppercase tracking-widest text-muted">{t("Discover")}</h2><div className="mt-4 flex flex-col gap-3 text-sm"><Link href="/events">{t("Browse events")}</Link><Link href="/workspace">{t("Organizer workspace")}</Link><Link href="/events?source=demo">{t("Demo events")}</Link></div></div>
          <div><h2 className="font-mono text-xs uppercase tracking-widest text-muted">{t("Accounts")}</h2><div className="mt-4 flex flex-col gap-3 text-sm"><Link href="/register">{t("Create an account")}</Link><Link href="/profile">{t("Profile")}</Link><Link href="/organizer-profile">{t("Organizer profile")}</Link></div></div>
        </div>
        <p className="mt-10 border-t border-line pt-7 text-xs text-muted">{t("© 2026 BiletFlow. Events in Kazakhstan.")}</p>
      </footer>
    </main>
  );
}
