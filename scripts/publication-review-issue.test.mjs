import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import yaml from "js-yaml";
import { planReviewIssue, reviewFingerprint, reviewMarker, syncReviewIssue } from "./lib/publication-review-issue.mjs";

const clean = { status: "complete", generatedAt: "2026-09-07T12:00:00.000Z", localRecordCount: 20,
  candidates: [], publishedPreprints: [], versionUpdates: [], localIssues: [], remoteMetadataIssues: [], sourceErrors: [] };
const findings = { ...clean, remoteMetadataIssues: ["Author order discrepancy for DOI 10.1000/example"] };
const runUrl = "https://github.com/example/lab/actions/runs/42";
function savedIssue(report = findings, extra = {}) {
  return { number: 7, state: "open", user: { login: "github-actions[bot]" },
    body: planReviewIssue(report, [], runUrl).payload.body, ...extra };
}

test("no findings creates no issue", () => {
  assert.equal(planReviewIssue(clean, []).action, "none");
});

test("first actionable report creates one bounded human-review issue", () => {
  const result = planReviewIssue(findings, [], runUrl);
  assert.equal(result.action, "create");
  assert.ok(result.payload.body.includes(reviewMarker));
  assert.match(result.payload.body, /Human approval is required/);
  assert.match(result.payload.body, /No data, summaries, or public review dates are changed/);
  assert.match(result.payload.body, /Workflow report and artifacts/);
});

test("timestamps, rolling windows and finding order do not trigger repeat writes", () => {
  const report = { ...findings, localIssues: ["B", "A"] };
  const changedTime = { ...report, generatedAt: "2026-09-14T12:00:00Z", queryWindow: { from: "new", to: "new" }, localIssues: ["A", "B"] };
  assert.equal(reviewFingerprint(report), reviewFingerprint(changedTime));
  assert.equal(planReviewIssue(changedTime, [savedIssue(report)]).action, "none");
});

test("candidate author order remains meaningful to the issue fingerprint", () => {
  const report = { ...clean, candidates: [{ doi: "10.1000/example", crossref: { authors: ["Example A", "Example B"] } }] };
  const changedOrder = { ...report, candidates: [{ doi: "10.1000/example", crossref: { authors: ["Example B", "Example A"] } }] };
  assert.notEqual(reviewFingerprint(report), reviewFingerprint(changedOrder));
});

test("changed findings update the same issue and preserve human notes and title", () => {
  const issue = savedIssue();
  issue.body += "\nReviewed with the maintainer. Keep this note.";
  const result = planReviewIssue({ ...findings, localIssues: ["New difference"] }, [issue]);
  assert.equal(result.action, "update");
  assert.equal(result.number, 7);
  assert.match(result.payload.body, /Keep this note/);
  assert.equal(result.payload.title, undefined);
});

test("a closed unchanged issue stays closed; new findings reopen the same issue", () => {
  const issue = savedIssue(findings, { state: "closed" });
  assert.equal(planReviewIssue(findings, [issue]).action, "none");
  const changed = planReviewIssue({ ...findings, localIssues: ["New difference"] }, [issue]);
  assert.equal(changed.action, "update");
  assert.equal(changed.number, 7);
  assert.equal(changed.payload.state, "open");
});

test("a clean report never closes an issue or claims human approval", () => {
  const result = planReviewIssue(clean, [savedIssue()]);
  assert.equal(result.action, "update");
  assert.equal(result.payload.state, undefined);
  assert.match(result.payload.body, /No publication changes require review/);
  assert.match(result.payload.body, /A maintainer must verify/);
});

test("duplicates and edited managed boundaries stop writes", () => {
  const issue = savedIssue();
  assert.throws(() => planReviewIssue(findings, [issue, { ...issue, number: 8 }]), /Multiple/);
  const changed = { ...findings, localIssues: ["New"] };
  assert.throws(() => planReviewIssue(changed, [{ ...issue, body: issue.body.replace("<!-- publication-check:end -->", "") }]), /boundaries/);
});

test("a pull request or human-authored marker is not the checker-owned issue", () => {
  assert.equal(planReviewIssue(findings, [savedIssue(findings, { pull_request: {} })]).action, "create");
  assert.equal(planReviewIssue(findings, [savedIssue(findings, { user: { login: "maintainer" } })]).action, "create");
});

test("partial checks retain failure evidence without discarding actionable findings", () => {
  const partial = { ...findings, status: "incomplete", sourceErrors: ["Crossref unavailable"] };
  const result = planReviewIssue(partial, []);
  assert.match(result.payload.body, /INCOMPLETE/);
  assert.match(result.payload.body, /Author order discrepancy/);
  assert.match(result.payload.body, /Crossref unavailable/);
  const error1 = { ...clean, sourceErrors: ["Failed https://api.example.test/search?from=2026-09-07"] };
  const error2 = { ...clean, sourceErrors: ["Failed https://api.example.test/search?from=2026-09-14"] };
  assert.equal(reviewFingerprint(error1), reviewFingerprint(error2));
});

test("oversize issue content fails without losing the standalone report", () => {
  assert.throws(() => planReviewIssue({ ...findings, localIssues: ["x".repeat(61000)] }, []), /standalone report artifact/);
});

test("API inventory is paginated across closed issues and unchanged findings make no writes", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method });
    return Response.json(new URL(url).searchParams.get("page") === "1"
      ? Array.from({ length: 100 }, (_, i) => ({ number: i + 100, body: "Not managed", user: { login: "person" } }))
      : [savedIssue(findings, { state: "closed" })]);
  };
  assert.equal((await syncReviewIssue({ report: findings, repository: "example/lab", token: "fixture", fetchImpl })).action, "none");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.method === "GET" && new URL(call.url).searchParams.get("state") === "all"));
});

test("API create and update never post comments or publication data", async () => {
  for (const initial of [[], [savedIssue()]]) {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") return Response.json(initial);
      return Response.json({ number: 7, ...JSON.parse(options.body) });
    };
    const report = { ...findings, localIssues: ["New"] };
    const result = await syncReviewIssue({ report, repository: "example/lab", token: "fixture", fetchImpl });
    assert.equal(result.number, 7);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.method, initial.length ? "PATCH" : "POST");
    assert.equal(calls[1].url, `https://api.github.com/repos/example/lab/issues${initial.length ? "/7" : ""}`);
  }
});

test("inventory errors make no writes and uncertain writes are never retried", async () => {
  const calls = [];
  await assert.rejects(syncReviewIssue({ report: findings, repository: "example/lab", token: "fixture", fetchImpl: async (_url, options) => {
    calls.push(options.method);
    return new Response("Not authorized", { status: 403 });
  } }), /403/);
  assert.deepEqual(calls, ["GET"]);
  calls.length = 0;
  await assert.rejects(syncReviewIssue({ report: findings, repository: "example/lab", token: "fixture", fetchImpl: async (_url, options) => {
    calls.push(options.method);
    if (options.method === "GET") return Response.json([]);
    throw new Error("Uncertain transport result");
  } }), /Uncertain/);
  assert.deepEqual(calls, ["GET", "POST"]);
});

test("weekly workflow gates issue writes to tested default-branch reports and keeps artifacts", async () => {
  const workflow = yaml.load(await fs.readFile(new URL("../.github/workflows/publication-check.yml", import.meta.url), "utf8"));
  assert.equal(workflow.on.schedule[0].cron, "17 14 * * 1");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.equal(workflow.jobs.check.permissions.contents, "read");
  assert.equal(workflow.jobs.check.permissions.issues, "write");
  const source = workflow.jobs.check.steps.find((step) => step.id === "publications");
  assert.match(source.if, /steps.checker-tests.outcome == 'success'/);
  const queue = workflow.jobs.check.steps.find((step) => step.name === "Maintain one human-review issue");
  assert.match(queue.if, /github.event.repository.default_branch/);
  assert.match(queue.if, /hashFiles\('output\/publication-check\/report.json'\)/);
  assert.match(queue.if, /!cancelled\(\)/);
  assert.equal(workflow.jobs.check.steps.find((step) => step.name === "Upload publication report").if, "always()");
});
