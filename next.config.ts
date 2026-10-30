import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nearly every IntroMesh screen is per-user, so we use the classic dynamic
  // rendering model instead of Cache Components.
  cacheComponents: false,
  // PGlite (embedded Postgres for local dev) ships WASM; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
