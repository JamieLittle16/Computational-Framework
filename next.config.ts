import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Computational-Framework",
  assetPrefix: "/Computational-Framework/",
  images: { unoptimized: true },
};

export default nextConfig;
