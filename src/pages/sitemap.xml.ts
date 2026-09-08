import type { APIRoute } from "astro";
import { siteData } from "../data/site";
import { siteUrl } from "../../scripts/lib/site-paths.mjs";

const origin = process.env.SITE_URL || siteData.url;
const pages: Array<{ path: string; lastmod?: string }> = [
  { path: "/", lastmod: siteData.publicationRecord.checkedAt },
  { path: "/publications/", lastmod: siteData.publicationRecord.checkedAt },
  { path: "/jonathan-abraham/" },
  { path: "/team/" },
  { path: "/news/" },
  { path: "/contact/" }
];

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
