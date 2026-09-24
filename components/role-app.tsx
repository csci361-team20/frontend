"use client";
import { AuthPage } from "./auth-pages";
import {
  BrowsePage,
  CheckoutPage,
  EventPage,
  OrderPage,
  OrdersPage,
} from "./attendee-pages";
import {
  CheckInPage,
  ManageEventPage,
  NewEventPage,
  OrganizerPage,
} from "./organizer-pages";

export function RoleApp({
  route,
  query,
}: {
  route: string[];
  query: Record<string, string>;
}) {
  if (route[0] === "sign-in" || route[0] === "register")
    return (
      <AuthPage
        key={`${route[0]}-${query.role}`}
        register={route[0] === "register"}
        next={query.next}
        initialRole={query.role}
      />
    );
  if (route[0] === "events")
    return route[1] ? (
      <EventPage key={route[1]} id={route[1]} />
    ) : (
      <BrowsePage
        key={`${query.q}-${query.category}-${query.city}-${query.when}`}
        query={query.q}
        category={query.category}
        city={query.city}
        when={query.when}
      />
    );
  if (route[0] === "checkout")
    return (
      <CheckoutPage
        key={`${route[1]}-${query.tickets}`}
        id={route[1]}
        tickets={query.tickets}
      />
    );
  if (route[0] === "orders")
    return route[1] ? (
      <OrderPage id={route[1]} confirmed={query.confirmed === "1"} />
    ) : (
      <OrdersPage />
    );
  if (route[0] === "check-in") return <CheckInPage />;
  if (route[2] === "new") return <NewEventPage />;
  if (route[2]) return <ManageEventPage key={route[2]} id={route[2]} />;
  return <OrganizerPage view={query.view} />;
}
