import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  turbopack: {
    resolveAlias: {
      canvas: { browser: "./empty-module.js" },
    },
  },
};

export default nextConfig;
