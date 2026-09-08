import type { APIRoute } from "astro";
import { siteData } from "../data/site";
import { siteUrl } from "../../scripts/lib/site-paths.mjs";

const origin = process.env.SITE_URL || siteData.url;
const sitemapUrl = siteUrl(origin, process.env.SITE_BASE_PATH, "/sitemap.xml");

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
