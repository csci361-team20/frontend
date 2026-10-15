import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
    return [
      // FastAPI requires a trailing slash on its collection route. Rewrite it
      // explicitly so its redirect never sends the browser across origins.
      { source: "/api/backend/users", destination: `${backend}/users/` },
      { source: "/api/backend/users/:id", destination: `${backend}/users/:id` },
    ];
  },
};

export default nextConfig;
