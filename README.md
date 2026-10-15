# Ticketelo

A Next.js 16 / React 19 ticketing frontend for attendees and organizers. It carries the existing ink, cream, and ember design into the event browser, checkout, orders, and organizer workspace.

## Run

```sh
bun install
cp .env.example .env.local
bun dev
```

Open [localhost:3000](http://localhost:3000). Start the existing backend separately and set `BACKEND_API_URL` in `.env.local` to its API root (default `http://127.0.0.1:8000/api/v1`). On PowerShell, use `Copy-Item .env.example .env.local`. Restart the frontend after changing this setting; hosted builds need it set before `bun run build`.

## Backend integration

All browser requests to the backend use `lib/api.ts`. Next.js rewrites forward same-origin `/api/backend` requests to `BACKEND_API_URL`, so backend CORS changes are not needed. The collection rewrite preserves FastAPI's trailing slash without redirecting the browser to the backend origin.

| Feature | Backend contract | Frontend behavior |
| --- | --- | --- |
| Registration | `POST /api/v1/users/` with `{ full_name, email, password }` | Validates name/password confirmation, submits JSON, then opens the returned account's profile. |
| Profile | `GET /api/v1/users/{id}` | `/profile?id=<uuid>` loads the profile, with loading, retry, and error states. Reloading the page fetches it again. |
| Sign-in / JWT | Not implemented by the current backend | Sign-in explicitly offers browser demo profiles only. No login, token, or current-user endpoints are assumed or called. |
| Profile editing | Backend PATCH handler is an empty stub | Profiles are read-only. No PATCH request is sent. |
| Events, orders, check-in, organizer roles | No backend routes yet | Existing browser demo store remains the fallback. |

The user response is `{ id, full_name, email, created_at }`. Backend validation and duplicate-email errors appear in the registration form; network failures do not create a demo account. Passwords are sent only in the registration request and are never written to browser storage. Account creation and profile lookup **do not authenticate a user** or select a demo profile. Save the profile URL or use its account ID on `/profile` to view it later.

On the sign-in page, **Try attendee** opens Dana's demo tickets and **Try organizer** opens Arman's demo box office. Existing demo profiles can still be selected by email. These profiles are separate from backend accounts; creating a backend account does not enable demo sign-in with that email. The account menu links to the demo profile and lets you leave or switch it. Events, bookings, and organizer changes remain explicitly marked as demonstrations.

## Included

- Event search, city/category/weekend filters, and price/date sorting.
- Event details, ticket quantities, availability, free registration, and demo checkout.
- Upcoming/past/cancelled orders and individual downloadable SVG tickets with real QR-encoded demo references.
- Organizer event drafts, publishing, ticket types, capacity, and a paid demo sales switch.
- Attendee search, cancellation, per-ticket check-in, and sales totals based on demo orders.
- Check-in staff assignment by email. A matching demo profile gets access only to assigned events.
- Responsive layouts, keyboard focus styles, labeled controls, and empty/error states.

## Deliberately deferred

Payment providers and backend authentication are not connected. Registration and profile reads use the backend database. Demo sign-in identifies a **local demo profile**, not an authenticated user. No payment details are requested. No emails are sent. UI role checks are not a security boundary.

Demo data is stored under `ticketelo-demo-v1` in browser localStorage and persists on reload; different browsers/devices do not share it. If storage is unavailable, a warning explains that changes are temporary. Remove this key through browser developer tools to reset the demo. Concurrent-tab edits use last-write-wins semantics; production inventory must use database transactions.

The sample events are fictional and dated October-November 2026. Past events stop accepting bookings. Demo tickets are explicitly marked as invalid for real admission. The check-in desk accepts searches using the QR's ticket reference; camera scanning is not implemented.

## Structure

- `lib/demo-data.ts`: typed seed data and booking, inventory, ownership, and check-in rules.
- `components/demo-provider.tsx`: shared browser store, hydration, and cross-tab storage updates.
- `components/attendee-pages.tsx`: event discovery, checkout, orders, ticket download.
- `components/organizer-pages.tsx`: editor, box office, sales, guest list, door team.
- `lib/api.ts`: typed backend client, error handling, cancellation, and timeouts.
- `components/auth-pages.tsx`: backend registration and explicit demo sign-in fallback.
- `components/profile-page.tsx`: backend profile reads and separate demo profile view.
- `app/[...route]/page.tsx`: validated Next.js routes and metadata.

The landing page remains server-rendered; its live event list is a small client boundary using the shared store.

## Checks

```sh
bun test tests
bunx tsc --noEmit
bun run lint
bun run build
```

Tests cover API contracts, duplicate/validation errors, malformed responses, unavailable services, timeouts/cancellation, and the existing inventory, booking, ownership, staff, and check-in rules. API tests use mocked responses; a running backend is not required.
