import type { NextConfig } from "next";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectRoot, "..", "..");

const rootEnvPath = path.join(repoRoot, ".env.local");
if (fs.existsSync(rootEnvPath)) {
  const envContents = fs.readFileSync(rootEnvPath, "utf8");
  envContents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key) return;
    const value = valueParts.join("=");
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
