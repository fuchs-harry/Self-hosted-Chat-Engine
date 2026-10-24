import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // Shown on the admin overview, so support questions can name the version.
  env: { APP_VERSION: pkg.version },
  // Self-contained server bundle for the Docker image (no node_modules copy).
  output: "standalone",
  // These read font/data files from their own package directory at runtime,
  // so they must not be bundled.
  serverExternalPackages: ["pdfkit", "mammoth", "unpdf"],
  poweredByHeader: false,
  // `next dev` only serves its client runtime to these hosts.
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ORIGINS?.split(",") ?? [])],
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
