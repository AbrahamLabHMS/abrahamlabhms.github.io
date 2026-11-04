import { execFileSync } from "node:child_process";
import path from "node:path";
import { hasBasePath, normalizeBasePath } from "./site-paths.mjs";

const shared = [
  "src/layouts", "src/components/Header.astro", "src/components/Footer.astro",
  "src/data/site.ts", "src/data/types.ts", "src/lib/content.ts", "src/styles", "src/assets",
  "public/assets/images/brands", "public/assets/images/social", "astro.config.mjs",
  "scripts/lib/site-paths.mjs", "scripts/lib/source-modified.mjs"
];

// Include rendered data, templates and assets, not maintenance reports or README edits.
export const pageSourcePaths = {
  "/": [...shared, "src/pages/index.astro", "src/data/publications.ts", "src/data/jonathan.ts",
    "src/data/news.ts", "public/assets/images/campus", "public/assets/images/editorial"],
  "/research/": [...shared, "src/pages/research", "src/data/research.ts", "src/data/publications.ts",
    "public/assets/images/research"],
  "/publications/": [...shared, "src/pages/publications", "src/data/publications.ts", "src/data/jonathan.ts",
    "src/data/publication-figures.json", "src/components/PublicationFigure.astro", "public/assets/images/publications"],
  "/jonathan-abraham/": [...shared, "src/pages/jonathan-abraham", "src/data/jonathan.ts", "public/assets/documents"],
  "/team/": [...shared, "src/pages/team", "src/data/people.ts", "src/components/MembershipDates.astro",
    "src/components/TeamMemberName.astro", "src/lib/team-links.ts"],
  "/news/": [...shared, "src/pages/news", "src/data/news.ts", "public/assets/images/editorial"],
  "/contact/": [...shared, "src/pages/contact", "src/components/MapWidget.astro"]
};

export function readSourceModificationDates(root = process.cwd()) {
  root = path.resolve(root);
  const dates = Object.fromEntries(Object.keys(pageSourcePaths).map((route) => [route, undefined]));
  const git = (...args) => execFileSync("git", ["--no-optional-locks", ...args], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000
  }).trim();
  try {
    // A shallow checkout can falsely attribute every file to its boundary commit.
    if (git("rev-parse", "--show-toplevel") !== root || git("rev-parse", "--is-shallow-repository") !== "false") return dates;
    for (const [route, sources] of Object.entries(pageSourcePaths)) {
      if (git("status", "--porcelain", "--untracked-files=all", "--", ...sources)) continue;
      const date = git("log", "-1", "--format=%cs", "--", ...sources);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates[route] = date;
    }
  } catch {
    // Source archives and uncommitted previews have no trustworthy release date.
    return Object.fromEntries(Object.keys(pageSourcePaths).map((route) => [route, undefined]));
  }
  return dates;
}

let buildDates;
export function pageModifiedAt(pathname, basePath = process.env.SITE_BASE_PATH) {
  const base = normalizeBasePath(basePath);
  if (!hasBasePath(pathname, base)) return undefined;
  const route = `${pathname.slice(base.length).replace(/\/+$/, "")}/`;
  buildDates ??= readSourceModificationDates();
  return buildDates[route];
}
