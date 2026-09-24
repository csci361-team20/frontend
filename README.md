# Ticketelo

A Next.js 16 / React 19 ticketing frontend for attendees and organizers. It carries the existing ink, cream, and ember design into the event browser, checkout, orders, and organizer workspace.

## Run

```sh
bun install
bun dev
```

Open [localhost:3000](http://localhost:3000). On the sign-in page, **Try attendee** opens Dana's tickets and **Try organizer** opens Arman's box office. New demo profiles can be created with a name, email, and role. The account menu switches profiles.

## Included

- Event search, city/category/weekend filters, and price/date sorting.
- Event details, ticket quantities, availability, free registration, and demo checkout.
- Upcoming/past/cancelled orders and individual downloadable SVG tickets with real QR-encoded demo references.
- Organizer event drafts, publishing, ticket types, capacity, and a paid demo sales switch.
- Attendee search, cancellation, per-ticket check-in, and sales totals based on demo orders.
- Check-in staff assignment by email. A matching demo profile gets access only to assigned events.
- Responsive layouts, keyboard focus styles, labeled controls, and empty/error states.

## Deliberately deferred

Payment providers, a database, and production authentication are not connected. Sign-in identifies a **local demo profile**, not an authenticated user. No passwords or payment details are requested. No emails are sent. UI role checks are not a security boundary.

Data is stored under `ticketelo-demo-v1` in browser localStorage and persists on reload; different browsers/devices do not share it. If storage is unavailable, a warning explains that changes are temporary. Remove this key through browser developer tools to reset the demo. Concurrent-tab edits use last-write-wins semantics; production inventory must use database transactions.

The sample events are fictional and dated October-November 2026. Past events stop accepting bookings. Demo tickets are explicitly marked as invalid for real admission. The check-in desk accepts searches using the QR's ticket reference; camera scanning is not implemented.

## Structure

- `lib/demo-data.ts`: typed seed data and booking, inventory, ownership, and check-in rules.
- `components/demo-provider.tsx`: shared browser store, hydration, and cross-tab storage updates.
- `components/attendee-pages.tsx`: event discovery, checkout, orders, ticket download.
- `components/organizer-pages.tsx`: editor, box office, sales, guest list, door team.
- `components/auth-pages.tsx`: demo profile registration/sign-in.
- `app/[...route]/page.tsx`: validated Next.js routes and metadata.

The landing page remains server-rendered; its live event list is a small client boundary using the shared store.

## Checks

```sh
bun test tests/demo.test.ts
bunx tsc --noEmit
bun run lint
bun run build
```

Tests cover inventory limits, free/paused sales, idempotent booking, price snapshots, organizer ownership, staff permissions, duplicate check-in, and cancelled tickets.
