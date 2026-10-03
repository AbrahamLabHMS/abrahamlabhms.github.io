import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import { evaluateAudit, exception } from "./audit-dependencies.mjs";

function fixture() {
  const fixAvailable = { name: "astro", version: "2.10.9", isSemVerMajor: true };
  return {
    report: {
      auditReportVersion: 2,
      vulnerabilities: {
        astro: { name: "astro", severity: "high", isDirect: true, via: ["http-cache-semantics"], effects: [], nodes: ["node_modules/astro"], fixAvailable },
        "http-cache-semantics": {
          name: "http-cache-semantics", severity: "high", isDirect: false, effects: ["astro"],
          nodes: ["node_modules/http-cache-semantics"], fixAvailable,
          via: [{ source: 1240991, name: "http-cache-semantics", dependency: "http-cache-semantics", severity: "high", range: "<=4.2.0", url: "https://github.com/advisories/GHSA-ch52-4w7c-c8xp" }],
        },
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 } },
    },
    context: {
      exitCode: 1, now: new Date("2026-10-02T22:00:00Z"),
      configSha256: exception.configSha256,
      installed: { ...exception.versions },
      lock: { packages: Object.fromEntries(Object.entries(exception.versions).map(([name, version]) => [`node_modules/${name}`, { version }])) },
    },
  };
}

test("only the reviewed advisory chain receives the temporary exception", () => {
  const { report, context } = fixture();
  const result = evaluateAudit(report, context);
  assert.equal(result.passed, true);
  assert.equal(result.exceptionUsed, true);
  assert.equal(result.expiresAt, "2026-10-17T04:00:00Z");
});

for (const [name, mutate] of Object.entries({
  "a new high advisory": ({ report }) => { report.vulnerabilities.other = { name: "other", severity: "high", via: [], nodes: ["node_modules/other"] }; report.metadata.vulnerabilities.high++; report.metadata.vulnerabilities.total++; },
  "an additional cache advisory": ({ report }) => report.vulnerabilities["http-cache-semantics"].via.push({ source: 999, severity: "high" }),
  "a different source identifier": ({ report }) => { report.vulnerabilities["http-cache-semantics"].via[0].source++; },
  "a different advisory URL": ({ report }) => { report.vulnerabilities["http-cache-semantics"].via[0].url += "-other"; },
  "a different dependency": ({ report }) => { report.vulnerabilities["http-cache-semantics"].via[0].dependency = "other"; },
  "an additional Astro cause": ({ report }) => report.vulnerabilities.astro.via.push("other"),
  "critical severity": ({ report }) => { report.vulnerabilities.astro.severity = "critical"; report.metadata.vulnerabilities.high--; report.metadata.vulnerabilities.critical++; },
  "critical advisory under high aggregate": ({ report }) => { report.vulnerabilities["http-cache-semantics"].via[0].severity = "critical"; },
  "a nested install": ({ report }) => report.vulnerabilities["http-cache-semantics"].nodes.push("node_modules/other/node_modules/http-cache-semantics"),
  "lockfile version drift": ({ context }) => { context.lock.packages["node_modules/astro"].version = "7.3.3"; },
  "installed version drift": ({ context }) => { context.installed["http-cache-semantics"] = "4.2.1"; },
  "config drift": ({ context }) => { context.configSha256 = "different"; },
  "a newly suggested fix": ({ report }) => { report.vulnerabilities["http-cache-semantics"].fixAvailable = true; },
  "exact expiry": ({ context }) => { context.now = new Date("2026-10-17T04:00:00Z"); },
  "after expiry": ({ context }) => { context.now = new Date("2026-10-18T00:00:00Z"); },
  "before approval": ({ context }) => { context.now = new Date("2026-10-01T00:00:00Z"); },
  "invalid clock": ({ context }) => { context.now = new Date(NaN); },
  "an npm error": ({ report }) => { report.error = { code: "EAUDITNOLOCK" }; },
  "unsupported report version": ({ report }) => { report.auditReportVersion = 3; },
  "missing counts": ({ report }) => { delete report.metadata; },
  "mismatched counts": ({ report }) => { report.metadata.vulnerabilities.high = 0; },
  "missing entries": ({ report }) => { delete report.vulnerabilities; },
  "malformed entries": ({ report }) => { report.vulnerabilities.astro = null; },
  "malformed nodes": ({ report }) => { report.vulnerabilities.astro.nodes = [null]; },
  "missing dependency reference": ({ report }) => { report.vulnerabilities.astro.via = ["missing"]; },
  "a source-free reference cycle": ({ report }) => { report.vulnerabilities["http-cache-semantics"].via = ["astro"]; },
  "wrong exit status": ({ context }) => { context.exitCode = 0; },
  "process failure": ({ context }) => { context.exitCode = 2; },
})) {
  test(`audit fails closed for ${name}`, () => {
    const data = fixture();
    mutate(data);
    assert.equal(evaluateAudit(data.report, data.context).passed, false);
  });
}

test("the last instant before expiry remains valid", () => {
  const { report, context } = fixture();
  context.now = new Date("2026-10-17T03:59:59.999Z");
  assert.equal(evaluateAudit(report, context).passed, true);
});

test("a clean audit does not depend on an expired exception", () => {
  const report = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } };
  const result = evaluateAudit(report, { exitCode: 0, now: new Date("2026-10-18T00:00:00Z") });
  assert.equal(result.passed, true);
  assert.equal(result.exceptionUsed, false);
  assert.equal(evaluateAudit(report, { exitCode: 1 }).passed, false);
});

function moderateReport() {
  return { auditReportVersion: 2, vulnerabilities: { other: {
    name: "other", severity: "moderate", nodes: ["node_modules/other"],
    via: [{ source: 999, name: "other", dependency: "other", severity: "moderate", range: "*", url: "https://github.com/advisories/GHSA-test-test-test" }],
  } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 1 } } };
}

test("moderate-only advisories retain npm's existing high threshold", () => {
  const report = moderateReport();
  assert.equal(evaluateAudit(report, { exitCode: 0 }).passed, true);
});

test("a critical advisory cannot hide inside a moderate aggregate", () => {
  const report = moderateReport();
  report.vulnerabilities.other.via[0].severity = "critical";
  assert.equal(evaluateAudit(report, { exitCode: 0 }).passed, false);
});

test("invalid advisory and node values cannot take the clean success path", () => {
  for (const invalid of [null, {}, 1, false, [], "missing"]) {
    const report = moderateReport();
    report.vulnerabilities.other.via = [invalid];
    assert.equal(evaluateAudit(report, { exitCode: 0 }).passed, false);
  }
  for (const invalid of [null, 1, "", "node_modules/../other", "/node_modules/other"]) {
    const report = moderateReport();
    report.vulnerabilities.other.nodes = [invalid];
    assert.equal(evaluateAudit(report, { exitCode: 0 }).passed, false);
  }
});

test("malformed reports never receive an exception", () => {
  for (const report of [null, [], {}, "invalid"]) assert.equal(evaluateAudit(report, {}).passed, false);
});

test("CI keeps the audit mandatory and rechecks expiry before deployment", () => {
  const workflow = yaml.load(readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"));
  const audit = workflow.jobs.checks.steps.find((step) => step.id === "audit");
  assert.match(audit.run, /^npm run audit:dependencies /);
  assert.doesNotMatch(audit.run, /\|\|\s*true/);
  assert.equal(audit["continue-on-error"], undefined);
  assert.equal(workflow.jobs.deploy.needs, "checks");
  assert.equal(workflow.jobs.checks.outputs.exception_expires_at, "${{ steps.audit.outputs.exception_expires_at }}");
  const steps = workflow.jobs.deploy.steps;
  const expiry = steps.findIndex((step) => step.name === "Recheck temporary security exception expiry");
  assert.ok(expiry >= 0 && expiry < steps.findIndex((step) => step.id === "deployment"));
  assert.equal(steps[expiry].env.EXCEPTION_EXPIRES_AT, "${{ needs.checks.outputs.exception_expires_at }}");
  assert.match(steps[expiry].run, /now >= deadline/);
  assert.equal(steps[expiry]["continue-on-error"], undefined);
});
