import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { normalizeBasePath } from "./lib/site-paths.mjs";
import { attribute, createBuildTargetValidator, elements } from "./lib/build-targets.mjs";
import { siteData } from "../src/data/site.ts";
import { alumniSourceError } from "./lib/alumni-sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const siteRoot = path.join(repoRoot, "_site");
const basePath = normalizeBasePath(process.env.SITE_BASE_PATH);
const targets = createBuildTargetValidator({ siteRoot, basePath, origin: process.env.SITE_URL || "https://abrahamlab.med.harvard.edu" });
const failures = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const requiredPages = [
  "index.html",
  "publications/index.html",
  "jonathan-abraham/index.html",
  "team/index.html",
  "news/index.html",
  "contact/index.html",
  "contact-us/index.html",
  "people/index.html",
  "meet-the-pi/index.html",
  "research/index.html",
  "404.html"
];

for (const relativePath of requiredPages) {
  if (!await exists(path.join(siteRoot, relativePath))) failures.push(`Missing built page: ${relativePath}`);
}

const allFiles = await walk(siteRoot);
const htmlFiles = allFiles.filter((filePath) => filePath.endsWith(".html"));
for (const htmlFile of htmlFiles) {
  const html = await fs.readFile(htmlFile, "utf8");
  const relative = path.relative(siteRoot, htmlFile);

  for (const forbidden of [
    { pattern: /Associate Professor of Microbiology, Harvard Medical School/i, label: "old Jonathan title" },
    { pattern: /\/assets\/images\/people\//i, label: "person image reference" },
    { pattern: /\bNRB\b/, label: "old building name" },
    { pattern: /fonts\.(?:googleapis|gstatic)\.com/i, label: "external Google font request" }
  ]) {
    if (forbidden.pattern.test(html)) failures.push(`${relative} contains ${forbidden.label}.`);
  }

  if (!html.includes('property="og:image:alt"')) failures.push(`${relative} is missing Open Graph image alt text.`);
  if (!html.includes('property="og:image:width" content="1200"')) failures.push(`${relative} is missing the 1200px share-image width.`);
  if (!html.includes('property="og:image:height" content="630"')) failures.push(`${relative} is missing the 630px share-image height.`);

  const nodes = elements(html);
  const meta = (key) => attribute(nodes.find((node) => node.tagName === "meta" &&
    (attribute(node, "property") === key || attribute(node, "name") === key)) || {}, "content");
  const shareImage = meta("og:image");
  if (meta("twitter:image") !== shareImage || meta("og:image:secure_url") !== shareImage) {
    failures.push(`${relative} has inconsistent sharing-image URLs.`);
  }
  if (["index.html", "team/index.html", "contact/index.html"].includes(relative)) {
    const expectedImage = new URL(`${basePath}${siteData.shareImages.campus.image}`, siteData.url).href;
    if (shareImage !== expectedImage) failures.push(`${relative} must use the campus link preview.`);
    if (meta("og:image:alt") !== siteData.shareImages.campus.alt) failures.push(`${relative} has stale sharing-image alt text.`);
  }

  failures.push(...(await targets.validateHtml(htmlFile, html)).map((failure) => `${relative}: ${failure}`));
}

if (allFiles.some((filePath) => filePath.includes(`${path.sep}assets${path.sep}images${path.sep}people${path.sep}`))) {
  failures.push("Built site contains personnel image files.");
}

if (!allFiles.some((filePath) => filePath.endsWith(".woff2"))) {
  failures.push("Built site is missing self-hosted font files.");
}
if (!allFiles.some((filePath) => /newsreader-latin-wght-normal[^/]*\.woff2$/.test(filePath))) {
  failures.push("Built site is missing the self-hosted editorial font.");
}

const sitemap = await fs.readFile(path.join(siteRoot, "sitemap.xml"), "utf8");
const robots = await fs.readFile(path.join(siteRoot, "robots.txt"), "utf8");
failures.push(...await targets.validateSitemap(sitemap, robots));
if (
  sitemap.includes("/people/") ||
  sitemap.includes("/contact-us/") ||
  sitemap.includes("/meet-the-pi/")
) {
  failures.push("Sitemap includes a legacy route.");
}
if (!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap)) {
  failures.push("Sitemap is missing the publication record check date.");
}

const publicationsPage = await fs.readFile(path.join(siteRoot, "publications", "index.html"), "utf8");
for (const marker of ["<h1>Publications</h1>", "Jonathan Abraham on PubMed", "Jump to year", "PDB", "EMDB", "Open access"]) {
  if (!publicationsPage.includes(marker)) failures.push(`Publications page is missing "${marker}".`);
}
for (const marker of ["Publications checked", "Print or save PDF", "window.print()", "publication-status"] ) {
  if (publicationsPage.includes(marker)) failures.push(`Publications page still contains removed control: ${marker}`);
}
if (!sitemap.includes("/research/")) failures.push("Research explainer is missing from the sitemap.");

const teamPage = await fs.readFile(path.join(siteRoot, "team", "index.html"), "utf8");
for (const link of elements(teamPage).filter((node) => node.tagName === "a")) {
  let ancestor = link.parentNode;
  while (ancestor && attribute(ancestor, "id") !== "alumni") ancestor = ancestor.parentNode;
  if (!ancestor) continue;
  const error = alumniSourceError({ destination: "Alumni destination", destinationSource: attribute(link, "href") });
  if (error) failures.push(`Team alumni link ${attribute(link, "href")} ${error}.`);
}
for (const programUrl of [
  "https://virologyphd.hms.harvard.edu/",
  "https://bbsphd.hms.harvard.edu/"
]) {
  if (!teamPage.includes(programUrl)) failures.push(`Team page is missing program link: ${programUrl}`);
}

const contactPage = await fs.readFile(path.join(siteRoot, "contact", "index.html"), "utf8");
if (contactPage.includes("MD-PhD /")) failures.push("Contact uses individual training tags as general program labels.");
if (/<iframe\b/.test(contactPage)) failures.push("Contact map must not load a third-party frame before interaction.");
if (!contactPage.includes("data-map-src=") || !contactPage.includes("Show map")) {
  failures.push("Contact map is missing its on-demand control.");
}
if (!contactPage.includes("Open in Google Maps")) failures.push("Contact needs directions even when the map cannot load.");
if (/map-widget__(?:grid|pin|fallback)/.test(contactPage)) failures.push("Contact still contains the decorative map fallback.");
if (!contactPage.includes("z=14")) failures.push("Contact map must use the campus-scale zoom level.");
if (contactPage.includes("Postdoctoral work")) failures.push("Contact page still contains the duplicate postdoctoral inquiry block.");
const contactNodes = elements(contactPage);
const textContent = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(textContent).join("");
if (!contactNodes.some((node) => node.tagName === "h2" && textContent(node).trim() === "Harvard programs")) {
  failures.push('Contact page is missing the "Harvard programs" heading.');
}
const programLinks = new Set(contactNodes
  .filter((node) => node.tagName === "a" && node.parentNode?.tagName === "li" &&
    node.parentNode.parentNode?.tagName === "ul" && textContent(node).trim())
  .map((node) => attribute(node, "href")));
for (const programUrl of [
  "https://virologyphd.hms.harvard.edu/",
  "https://bbsphd.hms.harvard.edu/",
  "https://biophysics.fas.harvard.edu/"
]) {
  if (!programLinks.has(programUrl)) failures.push(`Contact page is missing a labelled program list link: ${programUrl}`);
}

for (const [legacyPath, targetPath] of [
  ["people/index.html", "/team/"],
  ["contact-us/index.html", "/contact/"],
  ["meet-the-pi/index.html", "/jonathan-abraham/"]
]) {
  const legacyPage = await fs.readFile(path.join(siteRoot, legacyPath), "utf8");
  const targetWithBase = `${basePath}${targetPath}`;
  if (!legacyPage.includes('name="robots" content="noindex,follow"')) {
    failures.push(`${legacyPath} must be marked noindex.`);
  }
  if (!legacyPage.includes('http-equiv="refresh"') || !legacyPage.includes(`url=${targetWithBase}`)) {
    failures.push(`${legacyPath} must refresh to ${targetWithBase}.`);
  }
  if (!legacyPage.includes(`href="${targetWithBase}"`)) {
    failures.push(`${legacyPath} is missing a visible link to ${targetWithBase}.`);
  }
}

const homePage = await fs.readFile(path.join(siteRoot, "index.html"), "utf8");
if (homePage.includes("Complete publication record")) failures.push("Homepage overstates the selected publication list as complete.");
if (!homePage.includes("https://accessibility.huit.harvard.edu/digital-accessibility-policy")) {
  failures.push("Footer is missing Harvard's digital accessibility link.");
}
for (const dimensionMarker of ['width="405" height="53"', 'width="1918" height="445"']) {
  if (!homePage.includes(dimensionMarker)) failures.push(`Homepage affiliation logo is missing fixed dimensions: ${dimensionMarker}`);
}
for (const image of siteData.heroFigures[0].imageVariants || []) {
  const marker = `${basePath}${image.path} ${image.width}w`;
  if (!homePage.includes(marker)) failures.push(`Homepage is missing "${marker}".`);
}

if (failures.length) {
  console.error("Built-site validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Built-site validation passed: ${htmlFiles.length} HTML pages and ${allFiles.length} files checked.`);
}
