import type { NextConfig } from "next";

// Backend calls go through app/api/backend/[...path]/route.ts, which adds the
// signed-in user's token from an httpOnly cookie. BACKEND_API_URL is read there.
const nextConfig: NextConfig = {};

export default nextConfig;
