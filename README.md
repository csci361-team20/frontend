# BiletFlow

A Next.js 16 / React 19 ticketing frontend for attendees, organizers, support staff, and platform administrators. The ink, cream, and ember design extends across ticketing, administration, and asynchronous support cases.

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
| Profile editing | Backend now exposes user updates | The existing frontend profile view remains read-only. |
| Events and ticket types | Backend routes were added in October | The existing demo workflow is retained; connecting these routes is separate integration work. |
| Orders, check-in, administration, support, payments | Complete contracts for these frontend workflows are not available | Browser demo workflows remain available. No unsupported endpoints are assumed. |

The user response is `{ id, full_name, email, created_at }`. Backend validation and duplicate-email errors appear in the registration form; network failures do not create a demo account. Passwords are sent only in the registration request and are never written to browser storage. Account creation and profile lookup **do not authenticate a user** or select a demo profile. Save the profile URL or use its account ID on `/profile` to view it later.

On the sign-in page, **Try attendee** opens Dana's demo tickets, **Try organizer** opens Arman's box office, **Try platform admin** opens Aida's administration console, and **Try support staff** opens Mira's assigned support inbox. Existing demo profiles can also be selected by email. These profiles are separate from backend accounts; creating a backend account does not enable demo sign-in with that email. The account menu links to profiles, support, and the appropriate workspace.

## Administration (4.12)

`/admin` is available to the platform administrator demo profile. It includes cross-record and per-section search for users, events, orders, and payments; user/event suspension and restoration; event-report review; activation-fee snapshots; payment failures, refund and dispute monitors; escalated/organizer support queues; promotional-code activity; settings; and an append-only administration activity history. Operational CSV exports cover users, events, orders, payments, support, activations, refunds, disputes, and promotions, with spreadsheet-formula escaping.

Suspended events and events from suspended organizers leave public discovery and cannot accept bookings. Suspended profiles cannot book, manage events, or check in tickets. Existing orders and support histories remain available. The platform booking switch blocks new bookings; activation-fee changes apply to future activation records and preserve existing fee snapshots. Financial records are fictional and no real charge or refund occurs.

## Support cases (4.13)

`/support` lists only cases accessible to the selected demo profile. Event, order, and individual ticket pages link to a contextual request form; organizers can also open platform requests from their workspace. The form carries the requester and available event/order/ticket references, with domain checks against foreign or mismatched context. Categories cover delivery, payment, refunds, seating, event information, check-in, account, activation, and technical issues.

Threads persist messages and status/assignment history across navigation and reloads. Event organizers and staff explicitly assigned to their support team handle attendee cases; platform administrators handle organizer requests and escalations. Authorized staff can assign cases and set Open, In Progress, Waiting for Customer, or Resolved. A reply reopens a resolved case without deleting its history. Replies, assignments, and status changes create in-app notifications for authorized participants; inboxes support unread notification handling. Email, WebSockets, presence, typing indicators, voice, and chatbots are not part of this demo.

These policies are frontend demonstration rules. Server authentication, authorization, and cross-device case storage are required before using them for real customer data. The UI identifies the browser demo explicitly.

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

Demo data is stored under `biletflow-demo-v1` in browser localStorage and persists on reload; different browsers/devices do not share it. Existing `ticketelo-demo-v1` data migrates on the first load, preserving profiles, events, orders, and the active profile while adding operations data and the new demo profiles. If storage is unavailable, changes remain temporary. To reset the demo, remove both keys so legacy data is not imported again. Concurrent-tab edits use last-write-wins semantics; production inventory and case writes need server-side concurrency control.

The sample events are fictional and dated October-November 2026. Past events stop accepting bookings. Demo tickets are explicitly marked as invalid for real admission. The check-in desk accepts searches using the QR's ticket reference; camera scanning is not implemented.

## Structure

- `lib/demo-data.ts`: typed seed data and booking, inventory, ownership, and check-in rules.
- `components/demo-provider.tsx`: shared browser store, hydration, and cross-tab storage updates.
- `components/attendee-pages.tsx`: event discovery, checkout, orders, ticket download.
- `components/organizer-pages.tsx`: editor, box office, sales, guest list, door team.
- `lib/operations.ts`: typed administration/support records, scoped access policies, mutations, notifications, and CSV export.
- `components/admin-pages.tsx`: administration console and operational reporting.
- `components/support-pages.tsx`: scoped support inbox, contextual requests, conversation threads, and staff controls.
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

Tests cover API contracts, error handling, booking/inventory rules, support access and context isolation, case history/notifications, administration controls, safe exports, activation snapshots, and legacy demo migration. API tests use mocked responses; a running backend is not required.
