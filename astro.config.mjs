import { defineConfig } from "astro/config";
import { normalizeBasePath } from "./scripts/lib/site-paths.mjs";

const site = process.env.SITE_URL || "https://abrahamlab.med.harvard.edu";
const base = normalizeBasePath(process.env.SITE_BASE_PATH) || undefined;

export default defineConfig({
  site,
  base,
  output: "static",
  outDir: "./_site",
  trailingSlash: "always",
  build: {
    format: "directory"
  },
  server: {
    host: "127.0.0.1"
  }
});
