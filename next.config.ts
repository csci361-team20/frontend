import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
    return [
      { source: "/api/backend/users", destination: `${backend}/users/` },
      { source: "/api/backend/users/:id", destination: `${backend}/users/:id` },
      { source: "/api/backend/organizers/:id", destination: `${backend}/organizers/:id` },
      { source: "/api/backend/events", destination: `${backend}/events/` },
      { source: "/api/backend/events/:id/ticket-types", destination: `${backend}/events/:id/ticket-types` },
      { source: "/api/backend/events/:id/publish", destination: `${backend}/events/:id/publish` },
      { source: "/api/backend/events/:id/cancel", destination: `${backend}/events/:id/cancel` },
      { source: "/api/backend/events/:id", destination: `${backend}/events/:id` },
      { source: "/api/backend/ticket-types/:id", destination: `${backend}/ticket-types/:id` },
    ];
  },
};

export default nextConfig;
