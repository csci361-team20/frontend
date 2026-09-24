export type Role = "attendee" | "organizer";
export type Profile = { id: string; name: string; email: string; role: Role };
export type TicketType = {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
};
export type Event = {
  id: string;
  ownerId: string;
  title: string;
  subtitle: string;
  category: string;
  date: string;
  venue: string;
  city: string;
  description: string;
  status: "draft" | "published";
  paidSales: boolean;
  poster: string;
  tickets: TicketType[];
  staff: { id: string; name: string; email: string }[];
};
export type Admission = { id: string; checkedIn: boolean };
export type Order = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  name: string;
  email: string;
  createdAt: string;
  lines: {
    ticketId: string;
    name: string;
    price: number;
    quantity: number;
    admissions: Admission[];
  }[];
  total: number;
  status: "confirmed" | "cancelled";
};
export type DemoState = {
  version: 1;
  profiles: Profile[];
  currentUserId: string | null;
  events: Event[];
  orders: Order[];
};

export const categories = [
  "All events",
  "Concerts",
  "Cinema",
  "Theatre",
  "Festivals",
  "Comedy",
  "Sport",
];
export const money = (value: number) =>
  value === 0 ? "Free" : `₸${value.toLocaleString("en-US")}`;
export const amount = (value: number) => `₸${value.toLocaleString("en-US")}`;
export const dateLabel = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "short",
    ...options,
  }).format(new Date(date));
export const timeLabel = (date: string) =>
  dateLabel(date, {
    day: undefined,
    month: undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export const demoProfiles: Profile[] = [
  {
    id: "dana",
    name: "Dana Karimova",
    email: "dana@example.com",
    role: "attendee",
  },
  {
    id: "arman",
    name: "Arman Sadykov",
    email: "arman@example.com",
    role: "organizer",
  },
];

const descriptions: Record<string, string> = {
  concert:
    "One stage. A full band. A room singing back. Aigerim brings the autumn tour home with a two-hour set of new songs, old favourites, and the sounds of the steppe. Come early, find your people, and stay for the encore.",
  cine: "A late-night screening for people who still believe a film belongs on a big screen. Join us for a special 70mm presentation, followed by a conversation over coffee in the foyer. Original audio with English subtitles.",
  theatre:
    "A new staging of a familiar voice. Three acts trace the life, poetry, and restless curiosity of Abai, performed by the resident ensemble. In Kazakh, with Russian surtitles. Running time: 2 hours, including an interval.",
  fest: "An open-air gathering above the city. Electronic artists, independent food stalls, and a dance floor with a mountain view. Your pass includes both days. Bring a warm layer for the journey home.",
  comedy:
    "A small room, a good microphone, and absolutely no two-drink minimum. An evening with local headliners followed by an open mic. Performances in Russian and Kazakh. Recommended for ages 18 and over.",
  sport:
    "The series comes down to this. Join the home crowd for game five as the Tigers take on the Falcons. Gates open one hour before tip-off. Family seating is available in the upper stands.",
};
const rawEvents = [
  [
    "concert",
    "Aigerim & the Steppe Sound",
    "The autumn tour comes home.",
    "Concerts",
    "2026-10-24T21:00:00+05:00",
    "Almaty Arena",
    "Almaty",
    "9500",
    "180",
  ],
  [
    "cine",
    "The Long Afternoon",
    "70mm. One night only.",
    "Cinema",
    "2026-10-23T22:15:00+05:00",
    "Kinopark 6 Esentai",
    "Almaty",
    "4000",
    "60",
  ],
  [
    "theatre",
    "Abai, in Three Acts",
    "A familiar voice. A new stage.",
    "Theatre",
    "2026-10-26T18:00:00+05:00",
    "Auezov Theatre",
    "Almaty",
    "6000",
    "120",
  ],
  [
    "fest",
    "Desht Electronic",
    "Two days. Twenty artists. Open sky.",
    "Festivals",
    "2026-11-01T16:00:00+05:00",
    "Köktöbe Grounds",
    "Almaty",
    "16000",
    "400",
  ],
  [
    "comedy",
    "The Late List",
    "Good company. Questionable jokes.",
    "Comedy",
    "2026-10-23T20:30:00+05:00",
    "Chevron Club",
    "Almaty",
    "0",
    "80",
  ],
  [
    "sport",
    "Tigers vs. Falcons",
    "Game five. Everything to play for.",
    "Sport",
    "2026-10-29T19:00:00+05:00",
    "Saryarqa Arena",
    "Astana",
    "4500",
    "250",
  ],
];
export const initialEvents: Event[] = rawEvents.map(
  ([id, title, subtitle, category, date, venue, city, price, capacity]) => ({
    id,
    ownerId: "arman",
    title,
    subtitle,
    category,
    date,
    venue,
    city,
    description: descriptions[id],
    status: "published",
    paidSales: true,
    poster: id,
    tickets: [
      {
        id: `${id}-general`,
        name: id === "comedy" ? "Free admission" : "General admission",
        description:
          id === "fest"
            ? "Both days. All stages."
            : "A place in the room. All the atmosphere.",
        price: Number(price),
        capacity: Number(capacity),
      },
      ...(id === "concert"
        ? [
            {
              id: "concert-balcony",
              name: "Balcony",
              description: "Reserved upper-level seating. A little more room.",
              price: 14500,
              capacity: 60,
            },
          ]
        : []),
    ],
    staff:
      id === "concert"
        ? [
            {
              id: "staff-dana",
              name: "Dana Karimova",
              email: "dana@example.com",
            },
          ]
        : [],
  }),
);
export const initialState: DemoState = {
  version: 1,
  profiles: demoProfiles,
  currentUserId: null,
  events: initialEvents,
  orders: [
    {
      id: "TE-2026-1042",
      userId: "dana",
      eventId: "concert",
      eventTitle: "Aigerim & the Steppe Sound",
      eventDate: initialEvents[0].date,
      venue: "Almaty Arena",
      city: "Almaty",
      name: "Dana Karimova",
      email: "dana@example.com",
      createdAt: "2026-09-20T10:30:00+05:00",
      total: 19000,
      status: "confirmed",
      lines: [
        {
          ticketId: "concert-general",
          name: "General admission",
          price: 9500,
          quantity: 2,
          admissions: [
            { id: "TE-1042-A", checkedIn: false },
            { id: "TE-1042-B", checkedIn: false },
          ],
        },
      ],
    },
  ],
};

export function soldCount(orders: Order[], eventId: string, ticketId?: string) {
  return orders
    .filter((o) => o.eventId === eventId && o.status === "confirmed")
    .reduce(
      (sum, o) =>
        sum +
        o.lines
          .filter((l) => !ticketId || l.ticketId === ticketId)
          .reduce((s, l) => s + l.quantity, 0),
      0,
    );
}
export function available(state: DemoState, event: Event, type: TicketType) {
  return Math.max(
    0,
    type.capacity - soldCount(state.orders, event.id, type.id),
  );
}
export function canManage(user: Profile | undefined, event: Event) {
  return user?.role === "organizer" && event.ownerId === user.id;
}
export function canCheckIn(user: Profile | undefined, event: Event) {
  return (
    !!user &&
    (canManage(user, event) ||
      event.staff.some(
        (s) => s.email.toLowerCase() === user.email.toLowerCase(),
      ))
  );
}

// Client-side demo rules only. The future backend must enforce these independently.
export function placeOrder(
  state: DemoState,
  eventId: string,
  quantities: Record<string, number>,
  contact: { name: string; email: string },
  id: string,
): DemoState {
  const user = state.profiles.find((p) => p.id === state.currentUserId);
  if (!user) throw new Error("Sign in to save your tickets.");
  const event = state.events.find(
    (e) => e.id === eventId && e.status === "published",
  );
  if (!event || new Date(event.date).getTime() <= Date.now())
    throw new Error("This event is no longer accepting bookings.");
  if (state.orders.some((o) => o.id === id)) return state;
  if (!contact.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
    throw new Error("Add your name and a valid email address.");
  if (
    Object.keys(quantities).some(
      (id) => !event.tickets.some((t) => t.id === id),
    )
  )
    throw new Error("This ticket type is no longer available.");
  const lines = event.tickets.flatMap((t) => {
    const quantity = quantities[t.id] ?? 0;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 8)
      throw new Error("Choose between 0 and 8 tickets per type.");
    if (!quantity) return [];
    if (t.price > 0 && !event.paidSales)
      throw new Error("Paid ticket sales are currently paused.");
    if (quantity > available(state, event, t))
      throw new Error(
        `Only ${available(state, event, t)} ${t.name.toLowerCase()} tickets remain.`,
      );
    return [
      {
        ticketId: t.id,
        name: t.name,
        price: t.price,
        quantity,
        admissions: Array.from({ length: quantity }, (_, i) => ({
          id: `${id}-${t.id}-${i + 1}`,
          checkedIn: false,
        })),
      },
    ];
  });
  if (!lines.length) throw new Error("Choose at least one ticket.");
  const order: Order = {
    id,
    userId: user.id,
    eventId,
    eventTitle: event.title,
    eventDate: event.date,
    venue: event.venue,
    city: event.city,
    name: contact.name.trim(),
    email: contact.email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    lines,
    total: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    status: "confirmed",
  };
  return { ...state, orders: [order, ...state.orders] };
}

export function checkIn(
  state: DemoState,
  eventId: string,
  admissionId: string,
): DemoState {
  const event = state.events.find((e) => e.id === eventId);
  if (
    !event ||
    !canCheckIn(
      state.profiles.find((p) => p.id === state.currentUserId),
      event,
    )
  )
    throw new Error("You do not have check-in access to this event.");
  const order = state.orders.find(
    (o) =>
      o.eventId === eventId &&
      o.status === "confirmed" &&
      o.lines.some((l) => l.admissions.some((a) => a.id === admissionId)),
  );
  if (!order)
    throw new Error("Ticket not found. Check the reference and event.");
  if (
    order.lines.some((l) =>
      l.admissions.some((a) => a.id === admissionId && a.checkedIn),
    )
  )
    throw new Error("This ticket has already been checked in.");
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.id !== order.id
        ? o
        : {
            ...o,
            lines: o.lines.map((l) => ({
              ...l,
              admissions: l.admissions.map((a) =>
                a.id === admissionId ? { ...a, checkedIn: true } : a,
              ),
            })),
          },
    ),
  };
}

export function saveEvent(state: DemoState, event: Event): DemoState {
  const user = state.profiles.find((p) => p.id === state.currentUserId);
  const previous = state.events.find((e) => e.id === event.id);
  if (!canManage(user, previous ?? event) || event.ownerId !== user?.id)
    throw new Error("Only the event organizer can make this change.");
  if (!event.title.trim() || !event.venue.trim() || !event.description.trim())
    throw new Error("Add an event name, venue, and description.");
  if (
    !Number.isFinite(new Date(event.date).getTime()) ||
    ((!previous || previous.date !== event.date) &&
      new Date(event.date).getTime() <= Date.now())
  )
    throw new Error("Choose a future event date.");
  if (!event.tickets.length) throw new Error("Add at least one ticket type.");
  if (new Set(event.tickets.map((t) => t.id)).size !== event.tickets.length)
    throw new Error("Ticket types must be unique.");
  for (const t of event.tickets) {
    if (
      !t.name.trim() ||
      !Number.isInteger(t.price) ||
      t.price < 0 ||
      t.price > 10000000 ||
      !Number.isInteger(t.capacity) ||
      t.capacity < 1 ||
      t.capacity > 100000
    )
      throw new Error(
        "Each ticket needs a name, a whole-number price, and a capacity of 1–100,000.",
      );
    if (t.capacity < soldCount(state.orders, event.id, t.id))
      throw new Error(
        `Capacity for ${t.name} cannot be lower than tickets already sold.`,
      );
  }
  if (
    previous?.tickets.some(
      (t) =>
        soldCount(state.orders, event.id, t.id) > 0 &&
        !event.tickets.some((n) => n.id === t.id),
    )
  )
    throw new Error("A ticket type with bookings cannot be removed.");
  return {
    ...state,
    events: previous
      ? state.events.map((e) => (e.id === event.id ? event : e))
      : [event, ...state.events],
  };
}
