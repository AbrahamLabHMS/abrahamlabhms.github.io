import type { APIRoute } from "astro";
import { siteData } from "../data/site";
import { siteUrl } from "../../scripts/lib/site-paths.mjs";
import { pageModifiedAt, pageSourcePaths } from "../../scripts/lib/source-modified.mjs";

const origin = process.env.SITE_URL || siteData.url;
const pages = Object.keys(pageSourcePaths).map((path) => ({ path, lastmod: pageModifiedAt(path, "") }));

const toAbsolute = (path: string) =>
  siteUrl(origin, process.env.SITE_BASE_PATH, path);

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${toAbsolute(page.path)}</loc>${page.lastmod ? `
    <lastmod>${page.lastmod}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
