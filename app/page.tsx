import type { CSSProperties } from "react";
import Link from "next/link";
import { LandingEvents } from "@/components/attendee-pages";

/* ================================================================== *
   ticketelo — landing page
   A "cinematic dusk" ticketing storefront for Almaty & Astana.
 * ================================================================== */

/* -- category palette (kept in JS so gradients & dots can be dynamic) -- */
const HUE: Record<string, string> = {
  cine: "#7ca8ff",
  concert: "#ff5da2",
  theatre: "#e9b84e",
  fest: "#55d6a8",
  comedy: "#ffc24b",
  sport: "#7be06a",
};

/* ------------------------------ icons ------------------------------ */
type IconProps = { className?: string };

const TicketMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M13 6.5v11"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeDasharray="1.6 2.2"
      strokeLinecap="round"
    />
  </svg>
);

const Search = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="m20 20-3.4-3.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const Pin = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const Calendar = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <rect
      x="4"
      y="5.5"
      width="16"
      height="15"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M4 10h16M8.5 3.5v4M15.5 3.5v4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const Arrow = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M5 12h13m-5.5-6L19 12l-6.5 6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Star = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8L12 3.5Z" />
  </svg>
);

const Phone = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <rect
      x="6"
      y="2.5"
      width="12"
      height="19"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10.5 5h3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/* --------------------------- shared data --------------------------- */
const CATEGORIES = [
  { key: "cine", label: "Cinema", note: "48 films showing" },
  { key: "concert", label: "Concerts", note: "32 live shows" },
  { key: "theatre", label: "Theatre", note: "18 productions" },
  { key: "fest", label: "Festivals", note: "6 this season" },
  { key: "comedy", label: "Comedy", note: "12 nights" },
  { key: "sport", label: "Sport", note: "9 fixtures" },
];

/* ----------------------- small presentational ---------------------- */
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ember text-ink">
        <TicketMark className="h-5 w-5" />
      </span>
      <span className="text-[1.35rem] font-semibold tracking-tight">
        ticket<span className="text-ember">elo</span>
      </span>
    </span>
  );
}

function CatDot({ hue }: { hue: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: hue }}
    />
  );
}

/* the poster area at the top of each event card — layered gradients
   built from the category hue, plus a big watermark of the category word */
function poster(hue: string): CSSProperties {
  return {
    backgroundColor: "#0d0a12",
    backgroundImage: `radial-gradient(120% 130% at 15% 0%, ${hue}44, transparent 55%), radial-gradient(90% 120% at 95% 110%, ${hue}22, transparent 60%), linear-gradient(160deg, ${hue}1f, #0c0910 72%)`,
  };
}

/* deterministic QR-ish grid for the phone mock (looks scanned, not clip-art) */
function fakeQR(size = 21) {
  const cells: boolean[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // finder squares in three corners
      const inFinder = (br: number, bc: number) => {
        const dr = r - br;
        const dc = c - bc;
        if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return null;
        const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        return edge || core;
      };
      const f =
        inFinder(0, 0) ?? inFinder(0, size - 7) ?? inFinder(size - 7, 0);
      if (f !== null) {
        cells.push(f);
        continue;
      }
      cells.push((r * 31 + c * 17 + r * c * 3) % 5 < 2);
    }
  }
  return cells;
}

/* ============================== page ============================== */
export default function Home() {
  const qr = fakeQR(21);

  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip">
      {/* announcement */}
      <div className="border-b border-line bg-ink-800/60">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-5 py-2 text-center text-[0.8rem] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ember" />
          <span>
            Autumn season is live —{" "}
            <span className="text-cream">300+ nights out</span> across Almaty
            &amp; Astana
          </span>
          <Link
            href="#whatson"
            className="hidden items-center gap-1 font-medium text-ember hover:underline sm:inline-flex"
          >
            See what&apos;s on <Arrow className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ------------------------------ hero ------------------------------ */}
      <section className="relative overflow-hidden">
        {/* ember spotlight from the top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 55% at 72% -5%, rgba(255,106,61,0.20), transparent 60%), radial-gradient(60% 50% at 0% 20%, rgba(124,168,255,0.10), transparent 55%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-12 lg:pb-28 lg:pt-24">
          {/* left */}
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-800/60 px-3 py-1.5 font-mono text-[0.72rem] uppercase tracking-widest text-cream/70">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ember" />
              Now on sale
            </span>

            <h1 className="mt-6 font-display text-5xl font-light leading-[0.98] tracking-tight text-cream sm:text-6xl lg:text-7xl">
              Lights down.
              <br />
              <span className="italic text-ember">Goosebumps up.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              ticketelo is where Almaty and Astana find what&apos;s on tonight —
              cinema, concerts, theatre and everything worth leaving the house
              for. Real seats, on your phone, in under a minute.
            </p>

            {/* search */}
            <form
              action="/events"
              className="mt-8 max-w-2xl rounded-2xl border border-line bg-ink-800/80 p-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur sm:flex sm:items-stretch"
            >
              <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3 focus-within:bg-ink-700/60">
                <Search className="h-5 w-5 shrink-0 text-cream/40" />
                <span className="sr-only">Event, artist or film</span>
                <input
                  type="text"
                  name="q"
                  placeholder="Event, artist or film"
                  className="w-full bg-transparent text-[0.95rem] text-cream placeholder:text-muted focus:outline-none"
                />
              </label>
              <div className="mx-1 hidden w-px self-stretch bg-line sm:block" />
              <label className="flex items-center gap-3 rounded-xl px-4 py-3 focus-within:bg-ink-700/60">
                <Pin className="h-5 w-5 shrink-0 text-cream/40" />
                <span className="sr-only">City</span>
                <select
                  name="city"
                  className="cursor-pointer appearance-none bg-transparent text-[0.95rem] text-cream focus:outline-none"
                  defaultValue="Almaty"
                >
                  <option className="bg-ink-800">Almaty</option>
                  <option className="bg-ink-800">Astana</option>
                  <option className="bg-ink-800">Shymkent</option>
                </select>
              </label>
              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-ember px-6 py-3 text-[0.95rem] font-semibold text-ink transition-colors hover:bg-ember-600 sm:mt-0 sm:w-auto"
              >
                Search
                <Arrow className="h-4 w-4" />
              </button>
            </form>

            {/* trust line */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex text-gold">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5" />
                  ))}
                </span>
                <span className="text-cream">4.9</span> from 12,000+ nights out
              </span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span>No booking fee under ₸500</span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span>Instant mobile tickets</span>
            </div>
          </div>

          {/* right — the featured ticket */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-sm">
              {/* ghost ticket behind, for depth */}
              <div className="absolute inset-0 translate-x-4 translate-y-3 rotate-[5deg] rounded-[14px] border border-line bg-ink-800" />

              <div className="ticket animate-floaty shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)]">
                {/* main body */}
                <div className="flex flex-1 flex-col">
                  <div
                    className="relative aspect-[4/3] overflow-hidden rounded-tl-[14px]"
                    style={poster(HUE.concert)}
                  >
                    <span
                      className="pointer-events-none absolute -bottom-6 -left-2 font-display text-[5rem] font-light leading-none opacity-10"
                      style={{ color: HUE.concert }}
                    >
                      Live
                    </span>
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-wider text-cream backdrop-blur">
                      <CatDot hue={HUE.concert} />
                      Featured tonight
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="font-mono text-[0.68rem] uppercase tracking-widest text-clay/50">
                      Concert · piano &amp; light
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-medium leading-tight tracking-tight text-clay">
                      Nocturne
                    </h3>
                    <div className="mt-4 space-y-1 text-sm text-clay/70">
                      <p className="flex items-center gap-2">
                        <Pin className="h-4 w-4" /> Rixos Hall, Astana
                      </p>
                      <p className="flex items-center gap-2 font-mono text-[0.78rem]">
                        <Calendar className="h-4 w-4" /> SAT 8 NOV · 20:00
                      </p>
                    </div>
                  </div>
                </div>

                {/* perforation */}
                <div className="perf" />

                {/* tear-off stub */}
                <div className="flex w-[122px] shrink-0 flex-col justify-between p-4 text-clay">
                  <div>
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-clay/50">
                      Admit one
                    </p>
                    <p className="mt-2 font-mono text-sm font-semibold">
                      ROW C
                    </p>
                    <p className="font-mono text-sm font-semibold">SEAT 14</p>
                  </div>
                  <div className="barcode my-3 rounded-sm" />
                  <div>
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-clay/50">
                      Price
                    </p>
                    <p className="text-lg font-semibold">₸12,000</p>
                  </div>
                </div>
              </div>

              {/* little caption, hand-placed */}
              <p className="mt-6 -rotate-1 text-center font-display text-sm italic text-muted">
                “sold out in 40 minutes last spring.”
              </p>
            </div>
          </div>
        </div>

        {/* category rail */}
        <div className="relative border-y border-line bg-ink-800/40">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-3 overflow-x-auto px-5 py-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.key}
                href={`/events?category=${encodeURIComponent(c.label)}`}
                className="group flex shrink-0 items-center gap-3 rounded-full border border-line bg-ink px-4 py-2.5 transition-colors hover:border-cream/25"
              >
                <CatDot hue={HUE[c.key]} />
                <span className="text-sm font-medium text-cream">
                  {c.label}
                </span>
                <span className="font-mono text-[0.72rem] text-muted">
                  {c.note}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- what's on ---------------------------- */}
      <section
        id="whatson"
        className="mx-auto w-full max-w-7xl px-5 py-20 lg:py-28"
      >
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[0.72rem] uppercase tracking-widest text-ember">
              This week
            </p>
            <h2 className="mt-3 font-display text-4xl font-light tracking-tight text-cream sm:text-5xl">
              What&apos;s on
            </h2>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {[
              "All",
              "Cinema",
              "Concerts",
              "Theatre",
              "Sport",
              "This weekend",
            ].map((f, i) => (
              <Link
                href={
                  f === "All"
                    ? "/events"
                    : f === "This weekend"
                      ? "/events?when=weekend"
                      : `/events?category=${encodeURIComponent(f)}`
                }
                key={f}
                className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
                  i === 0
                    ? "bg-cream font-semibold text-ink"
                    : "border border-line text-cream/70 hover:border-cream/25 hover:text-cream"
                }`}
              >
                {f}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <LandingEvents />
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-medium text-cream transition-colors hover:border-cream/30 hover:bg-ink-800"
          >
            Explore all events
            <Arrow className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ------------------------------ why ------------------------------ */}
      <section id="how" className="border-y border-line bg-ink-800/40">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <p className="font-mono text-[0.72rem] uppercase tracking-widest text-ember">
                Why ticketelo
              </p>
              <h2 className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-cream sm:text-5xl">
                Less faff.
                <br />
                More show.
              </h2>
              <p className="mt-5 max-w-sm text-muted">
                We built the boring parts so the only decision left is where to
                sit.
              </p>
            </div>
          </div>

          <div className="lg:col-span-8">
            <ol className="divide-y divide-line">
              {[
                {
                  n: "01",
                  t: "On your phone, at the door",
                  d: "Your ticket is a QR code the moment you pay. Drop it into Apple Wallet, or send it to a friend in a single tap. Nothing to print, nothing to leave on the kitchen table.",
                },
                {
                  n: "02",
                  t: "Pick the exact seat",
                  d: "Real venue maps, not a lottery. See the stage from row H before you commit, and know precisely what you're paying for — down to the seat.",
                },
                {
                  n: "03",
                  t: "Resale that isn't a rip-off",
                  d: "Can't make it? Re-list at face value in seconds. Sold out? Buy verified seats from someone who couldn't go — never a tenge above the printed price.",
                },
              ].map((row) => (
                <li key={row.n} className="flex gap-6 py-8 first:pt-0">
                  <span className="font-mono text-sm text-ember">{row.n}</span>
                  <div>
                    <h3 className="font-display text-2xl font-medium tracking-tight text-cream">
                      {row.t}
                    </h3>
                    <p className="mt-2 max-w-xl leading-relaxed text-muted">
                      {row.d}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------- phone showcase ------------------------- */}
      <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-widest text-ember">
            On the night
          </p>
          <h2 className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-cream sm:text-5xl">
            From your couch to
            <br />
            the coat check.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Open ticketelo, tap the show, flash the code. We wake the QR up near
            doors — so no screenshot, no scalper, and no “sorry, this one&apos;s
            already been scanned.”
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "Live QR that changes at the door",
              "Add to Apple Wallet & Google Wallet",
              "Transfer to a friend, even mid-show",
              "Offline-ready — works when the signal doesn't",
            ].map((li) => (
              <li key={li} className="flex items-center gap-3 text-cream/90">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ember/15 text-ember">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path
                      d="m5 12.5 4 4 10-10"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {li}
              </li>
            ))}
          </ul>
        </div>

        {/* phone */}
        <div className="flex justify-center">
          <div className="relative w-[280px] rounded-[2.6rem] border-[6px] border-ink-700 bg-ink-800 p-3 shadow-[0_50px_110px_-40px_rgba(0,0,0,0.95)]">
            <div className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-ink-700" />
            <div className="overflow-hidden rounded-[2.1rem] bg-ink">
              {/* mini poster */}
              <div className="relative h-28" style={poster(HUE.concert)}>
                <span className="absolute bottom-3 left-4 font-display text-lg font-medium text-cream">
                  Nocturne
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-fest/20 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-fest">
                  Valid
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex justify-between font-mono text-[0.65rem] uppercase tracking-widest text-muted">
                  <span>Sat 8 Nov · 20:00</span>
                  <span>Doors 19:15</span>
                </div>
                {/* QR */}
                <div className="mx-auto w-fit rounded-xl bg-paper p-3">
                  <div
                    className="grid gap-[2px]"
                    style={{
                      gridTemplateColumns: "repeat(21, 6px)",
                    }}
                    aria-label="Ticket QR code"
                  >
                    {qr.map((on, i) => (
                      <span
                        key={i}
                        className="h-[6px] w-[6px] rounded-[1px]"
                        style={{
                          backgroundColor: on ? "#1a130d" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[0.7rem] text-cream/80">
                  <span>ROW C · SEAT 14</span>
                  <span className="text-fest">● live</span>
                </div>
                <div className="rounded-xl bg-ember py-2.5 text-center text-sm font-semibold text-ink">
                  Tap to scan at door
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- testimony ---------------------------- */}
      <section className="border-y border-line bg-ink-800/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-8">
            <span className="font-display text-6xl leading-none text-ember">
              “
            </span>
            <blockquote className="-mt-6 font-display text-3xl font-light leading-snug tracking-tight text-cream sm:text-4xl">
              I found last-minute seats to a sold-out gig while standing on the
              metro platform. Paid, and the QR was on my phone before my train
              pulled in. That&apos;s the whole magic — it just gets out of the
              way.
            </blockquote>
            <div className="mt-8 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-concert/20 font-display text-lg text-concert">
                D
              </span>
              <div className="text-sm">
                <p className="font-medium text-cream">Dana K.</p>
                <p className="text-muted">concert-goer · Almaty</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 lg:col-span-4 lg:grid-cols-1 lg:gap-8">
            {[
              { n: "2.1M", l: "tickets scanned" },
              { n: "4.9★", l: "average rating" },
              { n: "0", l: "printed at home" },
            ].map((s) => (
              <div key={s.l} className="lg:border-l lg:border-line lg:pl-6">
                <p className="font-display text-4xl font-light text-cream lg:text-5xl">
                  {s.n}
                </p>
                <p className="mt-1 text-sm text-muted">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ CTA ------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 120% at 50% 120%, rgba(255,106,61,0.28), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center lg:py-32">
          <Phone className="mx-auto h-8 w-8 text-ember" />
          <h2 className="mt-6 font-display text-5xl font-light leading-tight tracking-tight text-cream sm:text-6xl">
            The lights are about
            <br />
            to <span className="italic text-ember">go down.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-muted">
            Find what&apos;s on tonight in Almaty and Astana — and be the one
            who already has the tickets.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#whatson"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-7 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-ember-600"
            >
              Browse what&apos;s on
              <Arrow className="h-4 w-4" />
            </Link>
            <Link
              href="/organizer/events/new"
              className="inline-flex items-center justify-center rounded-full border border-line px-7 py-3.5 text-base font-medium text-cream transition-colors hover:border-cream/30 hover:bg-ink-800"
            >
              List your event
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------- footer ---------------------------- */}
      <footer className="border-t border-line bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Wordmark />
              <p className="mt-4 max-w-xs font-display text-lg italic text-muted">
                Tickets for the nights worth remembering.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
              {[
                {
                  h: "Discover",
                  links: [
                    ["Cinema", "/events?category=Cinema"],
                    ["Concerts", "/events?category=Concerts"],
                    ["Theatre", "/events?category=Theatre"],
                    ["Sport", "/events?category=Sport"],
                    ["Weekends", "/events?when=weekend"],
                  ],
                },
                {
                  h: "Organisers",
                  links: [
                    ["Create an event", "/organizer/events/new"],
                    ["Your box office", "/organizer"],
                    ["Check-in desk", "/check-in"],
                  ],
                },
                {
                  h: "Your tickets",
                  links: [
                    ["My orders", "/orders"],
                    ["Browse events", "/events"],
                  ],
                },
                {
                  h: "Join in",
                  links: [
                    ["Sign in", "/sign-in"],
                    ["Attendee profile", "/register"],
                    ["Organizer profile", "/register?role=organizer"],
                  ],
                },
              ].map((col) => (
                <div key={col.h}>
                  <h4 className="font-mono text-[0.72rem] uppercase tracking-widest text-cream/50">
                    {col.h}
                  </h4>
                  <ul className="mt-4 space-y-2.5 text-sm text-muted">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href}
                          className="transition-colors hover:text-cream"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 text-sm text-muted sm:flex-row sm:items-center">
            <p>© 2026 ticketelo. Made for nights out in Kazakhstan.</p>
            <div className="flex items-center gap-5">
              <span className="font-mono text-[0.75rem]">₸ KZT</span>
              <span className="h-4 w-px bg-line" />
              <span>Frontend demo</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
