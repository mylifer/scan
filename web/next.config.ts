import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/scan",
  trailingSlash: true,
  images: { unoptimized: true },
  // web/ dışındaki ortak saf TS dosyaları (../src) derlenebilsin diye kök depo dizini.
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
