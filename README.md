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

All browser requests to the backend use `lib/api.ts`. They go to the same-origin route handler `app/api/backend/[...path]/route.ts`, which forwards them to `BACKEND_API_URL`, so backend CORS changes are not needed. FastAPI's trailing-slash redirects are followed on the server, so the browser never leaves this origin.

**Sign-in.** `POST /api/auth/login` sends the email and password to the backend's `/auth/login` and stores the access and refresh tokens in httpOnly cookies; page scripts never see them. The proxy adds `Authorization: Bearer …` to every backend call, renews an expired access token once with the refresh token, and clears the cookies when both have expired. `POST /api/auth/logout` signs out of this browser; *Sign out on all devices* on the profile page calls the backend's `/auth/logout`.

`components/session-provider.tsx` holds the signed-in account (`/users/me`), the organizer profile (`/organizers/me`, if any) and the events the person works on (`/events/mine`).

| Page | Backend |
| --- | --- |
| `/register` | `POST /users/` then signs in; the backend emails a confirmation link |
| `/sign-in` | `/api/auth/login` (cookie session) |
| `/verify-email?token=` | `POST /auth/verify-email/confirm` |
| `/forgot-password` | `POST /auth/password-reset/request` |
| `/reset-password?token=` | `POST /auth/password-reset/confirm` |
| `/profile` | `GET/PATCH /users/me`, `POST /auth/verify-email/request`, `POST /auth/change-password`, `POST /auth/logout` |
| `/`, `/events`, `/events/{id}` | `GET /events/` (filters, sort), `/events/{id}`, ticket types, seat map, calendar links, `POST /events/{id}/reports` |
| `/checkout/{id}` | `POST /events/{id}/quote`, `POST /events/{id}/orders` (10-minute hold), `POST /orders/{id}/pay` (simulated) |
| `/orders`, `/orders/{id}` | `/orders/mine`, `/orders/{id}`, cancel, ticket and order PDFs |
| `/organizer`, `/organizer/events/{id}` | `/organizers/me`, `/events/mine`, events, ticket types, seating, images, activation, campaigns, attendees, orders, refunds, analytics, staff, activity |
| `/check-in` | `/events/{id}/check-in/scan`, manual check-in, undo, stats, history |
| `/support`, `/support/{id}` | `/support/cases` (open, reply, assign, status, escalate) |
| `/notifications` | `/notifications`, unread count, mark read |
| `/admin` | `/admin/*` (search, users, organizers, events, money monitors, reports, activations, settings, audit, CSV exports), `PATCH /organizers/{id}/verification` |

The email links point at `FRONTEND_URL` in the backend settings (default `http://localhost:3000`).

Every page reads and writes the backend; nothing is stored in the browser except the session cookies. Payments, the activation fee and payouts are simulated by the backend: no card details are asked for and no money moves.

Run the unit tests with `npx tsx --test tests/*.test.ts` (or `bun test`).

## Roles

- **Attendees** browse, register for free events, buy tickets (simulated payment), download PDFs, ask the event team for help and report events.
- **Organizers** create and edit events, ticket types or assigned seating, open paid sales (identity, payout account, fee, terms), run promo campaigns, see sales and attendees, refund orders (owner only), add a team and read the event's history.
- **Managers** do the same as the owner except cancel the event and refund. **Check-in staff** only use the check-in desk. **Support staff** answer attendee cases for their events.
- **Platform admins** use `/admin` and answer organizer and escalated support cases.

Access is enforced by the backend; the frontend only hides what a role cannot use.

## Check-in desk

Scan with a USB/Bluetooth scanner (it types the code), paste a code, or use the camera where the browser supports `BarcodeDetector`. Results are colour-coded (valid, already used, cancelled, refunded, invalid, wrong event). Guests can also be found by name, email, seat or ticket reference and checked in from the list. A check-in can be undone with a reason; counts refresh every 15 seconds.

## Support and notifications

Attendee cases go to the event's owner, managers and support staff, who can pass them to the platform team. Organizer cases go straight to the platform team. Threads poll for replies every 20 seconds and every reply also arrives by email. The header bell shows unread notifications (checked once a minute); notifications use the account's language.

## Languages

The whole site (the attendee pages, the organizer workspace, the check-in desk and the admin pages) is in Kazakh, Russian and English, as the SRS asks. The ҚАЗ / РУС / ENG switch in the header changes it straight away; it is kept in the `biletflow-lang` cookie, so the server renders pages in it, and for a signed-in account it is also saved as the profile language, which emails, notifications and the mobile app use. Without a choice the browser's language decides.

Text is written in English inside `t("…")` (`components/language.tsx` for client components, `lib/i18n-server.ts` for server ones). The Russian and Kazakh versions are in `locales/ru.json` and `locales/kk.json`, keyed by the English text; `{name}` marks a value filled in at runtime, and counted text uses `t.plural(n, "{n} ticket", "{n} tickets")` with the Russian forms one|few|many. `tests/i18n.test.ts` fails when a text has no translation or a translation drops a placeholder. Kazakh dates are put together in `lib/i18n.ts`, because many browsers lack Kazakh month names.

## Structure

- `lib/api.ts`: typed backend client, error handling, cancellation and timeouts.
- `lib/events.ts`, `lib/orders.ts`, `lib/organizer.ts`, `lib/support.ts`, `lib/admin.ts`: backend types and small helpers.
- `components/session-provider.tsx`: the signed-in account, organizer profile and staff events.
- `components/event-pages.tsx`, `components/attendee-pages.tsx`: discovery, event page, checkout, orders and tickets.
- `components/organizer-pages.tsx`, `organizer-tabs.tsx`, `organizer-profile.tsx`: the organizer workspace.
- `components/checkin-page.tsx`: the check-in desk.
- `components/support-pages.tsx`, `components/notifications.tsx`: support cases and notifications.
- `components/admin-pages.tsx`: platform administration.
- `app/api/backend/[...path]/route.ts`, `app/api/auth/*`: the same-origin proxy and cookie session.
- `app/[...route]/page.tsx`: validated routes and page titles.

## Checks

```sh
bun test tests
bunx tsc --noEmit
bun run lint
bun run build
```

Tests cover the API client contracts, error handling, order and checkout helpers, CSV escaping, date inputs, role checks and safe notification links. They use mocked responses; a running backend is not required.
