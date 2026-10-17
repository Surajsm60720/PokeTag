import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@poketag/save-format"],
  serverExternalPackages: ["minio"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
