import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { attribute, elements } from "./lib/build-targets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const siteRoot = path.join(repoRoot, "_site");
const outputRoot = path.join(repoRoot, "output", "link-check");
const userAgent = "AbrahamLabWebsite/1.0 (mailto:james_spencer@hms.harvard.edu)";

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

export function collectExternalLinks(html) {
  return elements(html).filter((node) => node.tagName === "a")
    .map((node) => attribute(node, "href"))
    .filter((url) => /^https?:\/\//i.test(url || ""));
}

export function classifyStatus(status) {
  if (status >= 200 && status < 400) return "ok";
  if ([401, 403, 405].includes(status)) return "restricted";
  if (status === 429) return "rate-limited";
  if ([404, 410].includes(status)) return "broken";
  if (status >= 500 || [408, 425].includes(status)) return "transient";
  return "warning";
}

async function probeUrl(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5", "User-Agent": userAgent },
      signal: AbortSignal.timeout(20000)
    });
    const status = response.status;
    await response.body?.cancel().catch(() => {});
    return { url, finalUrl: response.url || url, status, state: classifyStatus(status) };
  } catch (error) {
    return { url, status: null, state: "transient", detail: error.message };
  }
}

export async function checkUrl(url, fetchImpl = fetch) {
  const first = await probeUrl(url, fetchImpl);
  if (first.state !== "broken") return first;
  const confirmation = await probeUrl(url, fetchImpl);
  return { ...confirmation, attempts: [first, confirmation], confirmed: confirmation.state === "broken" };
}

export function linkCheckExitCode(results) {
  return results.some((item) => item.state === "broken" && item.confirmed) ? 1 : 0;
}

async function checkInBatches(urls, concurrency = 6) {
  const results = new Array(urls.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const index = cursor++;
      results[index] = await checkUrl(urls[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function renderMarkdown(report) {
  const lines = [
    "# Abraham Lab external link check",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Links checked: ${report.total}`,
    `Reachable: ${report.counts.ok}`,
    `Restricted by source: ${report.counts.restricted}`,
    `Rate-limited: ${report.counts["rate-limited"]}`,
    `Transient/network errors: ${report.counts.transient}`,
    `Confirmed broken: ${report.counts.broken}`,
    `Other warnings: ${report.counts.warning}`,
    "",
    "Repeated 404/410 responses fail this check. Restricted, rate-limited, transient, and other warnings remain separate and do not prove a broken link."
  ];

  for (const state of ["broken", "transient", "rate-limited", "restricted", "warning"]) {
    const items = report.results.filter((item) => item.state === state);
    if (!items.length) continue;
    lines.push("", `## ${state[0].toUpperCase()}${state.slice(1)}`);
    for (const item of items) {
      const detail = item.status ?? item.detail ?? "No response";
      lines.push(`- ${detail}: ${item.url}`);
      if (item.pages?.length) lines.push(`  Found in: ${item.pages.join(", ")}`);
      if (item.finalUrl && item.finalUrl !== item.url) lines.push(`  Final destination: ${item.finalUrl}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const htmlFiles = (await walk(siteRoot)).filter((filePath) => filePath.endsWith(".html"));
  const links = new Map();
  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(htmlFile, "utf8");
    for (const url of collectExternalLinks(html)) {
      if (!links.has(url)) links.set(url, new Set());
      links.get(url).add(path.relative(siteRoot, htmlFile));
    }
  }

  const results = await checkInBatches([...links.keys()].sort());
  for (const result of results) result.pages = [...links.get(result.url)].sort();
  const counts = { ok: 0, restricted: 0, "rate-limited": 0, transient: 0, broken: 0, warning: 0 };
  for (const result of results) counts[result.state] += 1;
  const report = { generatedAt: new Date().toISOString(), total: results.length, counts, results };

  await fs.mkdir(outputRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
    fs.writeFile(path.join(outputRoot, "report.md"), renderMarkdown(report))
  ]);

  console.log(`External links checked: ${counts.ok} reachable, ${counts.broken} confirmed broken, ${results.length - counts.ok - counts.broken} need review.`);
  for (const item of results.filter((item) => item.state === "broken")) {
    const message = `Confirmed HTTP ${item.status}: ${item.url}; found in ${item.pages.join(", ")}`;
    const escaped = message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
    console.error(process.env.GITHUB_ACTIONS === "true" ? `::error title=Broken external link::${escaped}` : message);
  }
  process.exitCode = linkCheckExitCode(results);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`External-link checker failed before completion: ${error.message}`);
    process.exitCode = 2;
  });
}
