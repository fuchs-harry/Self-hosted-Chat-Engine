import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (no node_modules copy).
  output: "standalone",
  // These read font/data files from their own package directory at runtime,
  // so they must not be bundled.
  serverExternalPackages: ["pdfkit", "mammoth", "unpdf"],
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
