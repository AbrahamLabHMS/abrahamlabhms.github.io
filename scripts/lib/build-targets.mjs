import path from "node:path";
import { promises as fs } from "node:fs";
import { parse } from "parse5";
import { createStaticSiteTools } from "./static-site-server.mjs";
import { hasBasePath, normalizeBasePath, siteUrl } from "./site-paths.mjs";

export function elements(html) {
  const nodes = [];
  function visit(node) {
    if (node.tagName) nodes.push(node);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(html));
  return nodes;
}

export const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;

// URL tokens may contain commas (notably data URLs); descriptor commas delimit candidates.
export function srcsetUrls(value) {
  const urls = [];
  let rest = value;
  while (rest) {
    rest = rest.replace(/^[\s,]+/, "");
    if (!rest) break;
    const token = /^[^\s]+/.exec(rest)[0];
    urls.push(token.replace(/,+$/, ""));
    rest = rest.slice(token.length);
    if (token.endsWith(",")) continue;
    let depth = 0;
    let index = 0;
    for (; index < rest.length; index += 1) {
      if (rest[index] === "(") depth += 1;
      if (rest[index] === ")") depth -= 1;
      if (rest[index] === "," && depth === 0) break;
    }
    rest = rest.slice(index + 1);
  }
  return urls;
}

export function createBuildTargetValidator({ siteRoot, basePath = "", origin }) {
  siteRoot = path.resolve(siteRoot);
  basePath = normalizeBasePath(basePath);
  origin = new URL(origin).origin;
  const server = createStaticSiteTools({ siteRoot, basePath });
  const documents = new Map();

  function documentUrl(file) {
    const relative = path.relative(siteRoot, file).split(path.sep).join("/");
    return siteUrl(origin, basePath, relative.replace(/(^|\/)index\.html$/, "$1"));
  }

  async function readElements(file) {
    if (!documents.has(file)) documents.set(file, elements(await fs.readFile(file, "utf8")));
    return documents.get(file);
  }

  async function targetFailure(file, raw, { absolute = false, documentBase, notFoundCanonical = false } = {}) {
    let url;
    try {
      url = new URL(raw, documentBase || documentUrl(file));
      if (absolute && (!/^https?:\/\//i.test(raw) || url.origin !== origin || url.search || url.hash || url.username || url.password)) {
        return "must be an absolute same-origin URL without query or fragment";
      }
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) return null;
      if (!hasBasePath(url.pathname, basePath)) return `missing deployment prefix ${basePath}/`;
      const resolved = await server.resolveStaticPath(url.pathname);
      // Astro's 404.html carries a /404/ canonical. It is deliberately not a 200 route.
      const expected404 = notFoundCanonical && path.resolve(file) === path.join(siteRoot, "404.html") &&
        url.pathname === `${basePath}/404/` && resolved?.filePath === path.join(siteRoot, "404.html");
      if (!resolved || (resolved.statusCode !== 200 && !expected404)) return "missing local file";
      if (absolute && path.extname(resolved.filePath) !== ".html") return "must identify an HTML page";
      if (url.hash && path.extname(resolved.filePath) === ".html") {
        // Text fragments are browser directives, not element identifiers.
        const fragment = decodeURIComponent(url.hash.slice(1).split(":~:")[0]);
        if (fragment && fragment !== "top") {
          const nodes = await readElements(resolved.filePath);
          if (!nodes.some((node) => attribute(node, "id") === fragment || (node.tagName === "a" && attribute(node, "name") === fragment))) {
            return `missing fragment #${fragment}`;
          }
        }
      }
      return null;
    } catch (error) {
      return `invalid local URL (${error.message})`;
    }
  }

  async function validateHtml(file, html) {
    const failures = [];
    const nodes = elements(html);
    documents.set(file, nodes);
    const base = nodes.find((node) => node.tagName === "base" && attribute(node, "href") !== undefined);
    let documentBase;
    if (base) {
      try {
        documentBase = new URL(attribute(base, "href"), documentUrl(file)).href;
        const baseUrl = new URL(documentBase);
        if (baseUrl.origin !== origin || !hasBasePath(baseUrl.pathname, basePath)) failures.push("base href leaves the deployment root");
      } catch {
        failures.push("invalid base href");
      }
    }
    const canonicals = nodes.filter((node) => node.tagName === "link" && (attribute(node, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"));
    if (canonicals.length !== 1) failures.push(`expected one canonical URL, found ${canonicals.length}`);
    for (const node of nodes) {
      const canonical = canonicals.includes(node);
      const targets = [];
      for (const name of ["href", "src", "poster"]) {
        const value = attribute(node, name);
        if (value !== undefined) targets.push({ value, kind: name, absolute: canonical });
      }
      for (const name of ["srcset", "imagesrcset"]) {
        const value = attribute(node, name);
        if (value) targets.push(...srcsetUrls(value).map((value) => ({ value, kind: name })));
      }
      if (canonical && attribute(node, "href") === undefined) failures.push("canonical link is missing href");
      for (const target of targets) {
        const problem = await targetFailure(file, target.value, { absolute: target.absolute, documentBase, notFoundCanonical: canonical });
        if (problem) failures.push(`${canonical ? "canonical" : target.kind} ${target.value}: ${problem}`);
      }
    }
    return failures;
  }

  async function validateSitemap(xml, robots) {
    const file = path.join(siteRoot, "index.html");
    const failures = [];
    const locations = elements(xml).filter((node) => node.tagName === "loc")
      .map((node) => node.childNodes.filter((child) => child.nodeName === "#text").map((child) => child.value).join("").trim());
    if (!locations.length) failures.push("sitemap has no locations");
    if (new Set(locations).size !== locations.length) failures.push("sitemap has duplicate locations");
    for (const location of locations) {
      const problem = await targetFailure(file, location, { absolute: true });
      if (problem) failures.push(`sitemap ${location}: ${problem}`);
    }
    const declared = [...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
    const expected = siteUrl(origin, basePath, "/sitemap.xml");
    if (declared.length !== 1 || declared[0] !== expected) failures.push(`robots.txt must declare exactly Sitemap: ${expected}`);
    return failures;
  }

  return { targetFailure, validateHtml, validateSitemap };
}
