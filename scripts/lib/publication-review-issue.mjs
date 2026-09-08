import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown } from "../check-publication-updates.mjs";

export const reviewMarker = "<!-- abraham-publication-review:v1 -->";
const begin = "<!-- publication-check:begin -->";
const end = "<!-- publication-check:end -->";
const title = "Publication updates: human review required";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function reviewFingerprint(report) {
  const keys = ["candidates", "publishedPreprints", "versionUpdates", "localIssues", "remoteMetadataIssues", "sourceErrors"];
  const snapshot = Object.fromEntries(keys.map((key) => [key, report[key]]));
  // Rolling query dates and run timestamps are not new findings.
  snapshot.sourceErrors = report.sourceErrors.map((error) => error.replace(/https?:\/\/\S+/g, (url) => {
    try { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; } catch { return url; }
  }));
  for (const key of keys) snapshot[key] = snapshot[key].map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex");
}

export function planReviewIssue(report, issues, runUrl = "") {
  const matching = issues.filter((issue) => !issue.pull_request && issue.user?.login === "github-actions[bot]" && issue.body?.includes(reviewMarker));
  if (matching.length > 1) throw new Error("Multiple publication review issues exist; reconcile manually. No issue was changed.");
  const issue = matching[0];
  const actionable = ["candidates", "publishedPreprints", "versionUpdates", "localIssues", "remoteMetadataIssues", "sourceErrors"]
    .some((key) => report[key].length);
  const fingerprint = reviewFingerprint(report);
  const digest = `<!-- publication-check:sha256:${fingerprint} -->`;
  if (!issue && !actionable) return { action: "none" };
  // Closing unchanged findings is a human decision; do not reopen or notify again.
  if (issue?.body.includes(digest)) return { action: "none", number: issue.number };
  const sourceLink = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(runUrl) ? `\n[Workflow report and artifacts](${runUrl})\n` : "";
  const region = `${begin}\n${digest}\n${renderMarkdown(report)}${sourceLink}\nNo data, summaries, or public review dates are changed by this issue. A maintainer must verify primary bibliographic sources and approve an ordinary code change. Keep one public entry per verified work; preserve preprint provenance where useful. Do not infer eligibility from authorship alone.\n${end}`;
  let body;
  if (issue) {
    const start = issue.body.indexOf(begin);
    const stop = issue.body.indexOf(end);
    if (start < 0 || stop < start || issue.body.indexOf(begin, start + begin.length) >= 0 || issue.body.indexOf(end, stop + end.length) >= 0) {
      throw new Error("Publication review issue has ambiguous managed boundaries; no change made.");
    }
    body = issue.body.slice(0, start) + region + issue.body.slice(stop + end.length);
  } else {
    body = `${reviewMarker}\n\n${region}\n\n## Maintainer notes\n\nKeep review decisions here or in comments; the checker preserves text outside its managed section.\n`;
  }
  if (body.length > 60000) throw new Error("Review issue exceeds the bounded body size; use the standalone report artifact. No issue was changed.");
  return { action: issue ? "update" : "create", number: issue?.number,
    payload: { ...(issue ? {} : { title }), body, ...(issue?.state === "closed" && actionable ? { state: "open" } : {}) } };
}

export async function syncReviewIssue({ report, repository, token, runUrl, fetchImpl = globalThis.fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || "") || !token) throw new Error("Repository and GitHub token are required.");
  const base = `https://api.github.com/repos/${repository}/issues`;
  const request = async (url, method = "GET", payload) => {
    const response = await fetchImpl(url, { method, signal: AbortSignal.timeout(20000),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2026-03-10",
        "Content-Type": "application/json" }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    if (!response.ok) throw new Error(`GitHub issue ${method} failed (${response.status}); inspect the artifact. No retrying writes.`);
    return response.json();
  };
  const issues = [];
  for (let page = 1; ; page++) {
    if (page > 100) throw new Error("Issue inventory exceeded 100 pages; no issue write attempted.");
    const batch = await request(`${base}?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("GitHub returned an invalid issue inventory.");
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  const plan = planReviewIssue(report, issues, runUrl);
  if (plan.action === "none") return plan;
  const saved = await request(plan.action === "create" ? base : `${base}/${plan.number}`, plan.action === "create" ? "POST" : "PATCH", plan.payload);
  if (!Number.isInteger(saved.number) || saved.body !== plan.payload.body || plan.number && saved.number !== plan.number ||
    plan.payload.state && saved.state !== plan.payload.state) throw new Error("Issue write was not confirmed. Inspect GitHub before retrying.");
  return { action: plan.action, number: saved.number };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = JSON.parse(await fs.readFile(process.argv[2] || "output/publication-check/report.json", "utf8"));
    console.log(await syncReviewIssue({ report, repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN,
      runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
