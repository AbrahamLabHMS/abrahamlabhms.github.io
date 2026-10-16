import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const severities = ["info", "low", "moderate", "high", "critical"];
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function validAdvisory(advisory, entry) {
  if (!isRecord(advisory) || !Number.isSafeInteger(advisory.source) || advisory.source <= 0
    || advisory.name !== entry.name || advisory.dependency !== entry.name
    || !severities.includes(advisory.severity)
    || severities.indexOf(advisory.severity) > severities.indexOf(entry.severity)
    || typeof advisory.range !== "string" || !advisory.range
    || typeof advisory.url !== "string") return false;
  try {
    const url = new URL(advisory.url);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function hasAdvisorySource(name, entries) {
  const pending = [name];
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const cause of entries[current].via) {
      if (typeof cause !== "string") return true;
      pending.push(cause);
    }
  }
  return false;
}

export function evaluateAudit(report, { exitCode } = {}) {
  const fail = (reason) => ({ passed: false, exceptionUsed: false, reason });
  if (!isRecord(report) || report.error || report.auditReportVersion !== 2
    || !isRecord(report.vulnerabilities) || !isRecord(report.metadata?.vulnerabilities)) {
    return fail("Missing, failed, or unsupported npm audit report.");
  }
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!isRecord(entry) || entry.name !== name || !severities.includes(entry.severity)
      || !Array.isArray(entry.via) || entry.via.length === 0
      || !Array.isArray(entry.nodes) || entry.nodes.length === 0
      || new Set(entry.nodes).size !== entry.nodes.length
      || entry.nodes.some((node) => typeof node !== "string"
        || !/^node_modules\/(?:@[^/\\]+\/)?[^/\\]+(?:\/node_modules\/(?:@[^/\\]+\/)?[^/\\]+)*$/.test(node)
        || node.split("/").some((part) => part === "." || part === ".."))) {
      return fail("Malformed npm audit vulnerability entry.");
    }
    for (const cause of entry.via) {
      if (typeof cause === "string") {
        const dependency = Object.hasOwn(report.vulnerabilities, cause) && report.vulnerabilities[cause];
        if (!isRecord(dependency) || !severities.includes(dependency.severity)
          || severities.indexOf(dependency.severity) > severities.indexOf(entry.severity)) {
          return fail("Invalid dependency reference or inconsistent advisory severity.");
        }
      } else if (!validAdvisory(cause, entry)) {
        return fail("Malformed advisory or inconsistent advisory severity.");
      }
    }
    counts[entry.severity]++;
  }
  if (Object.keys(report.vulnerabilities).some((name) => !hasAdvisorySource(name, report.vulnerabilities))) {
    return fail("Dependency references do not resolve to an advisory source.");
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (severities.some((severity) => counts[severity] !== report.metadata.vulnerabilities[severity])
    || total !== report.metadata.vulnerabilities.total) {
    return fail("npm audit counts do not match the reported vulnerabilities.");
  }
  const blocking = Object.values(report.vulnerabilities)
    .filter(({ severity }) => severity === "high" || severity === "critical");
  if (exitCode !== (blocking.length ? 1 : 0)) {
    return fail("npm audit exit status does not match its report.");
  }
  if (blocking.length === 0) {
    return { passed: true, exceptionUsed: false, reason: "No high or critical dependency advisories." };
  }
  return fail("High or critical dependency advisory. Update the affected packages before deployment; no exceptions are active.");
}

function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const output = path.join(root, "output/ci");
  mkdirSync(output, { recursive: true });
  const audit = spawnSync("npm", ["audit", "--json", "--audit-level=high", "--cache", path.join(root, ".cache/npm")], {
    cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(path.join(output, "dependency-audit.json"), audit.stdout || "");
  writeFileSync(path.join(output, "dependency-audit.stderr.log"), audit.stderr || "");
  writeFileSync(path.join(output, "dependency-audit-process.json"), JSON.stringify({
    status: audit.status, signal: audit.signal, error: audit.error?.message || null,
  }, null, 2) + "\n");

  let decision;
  try {
    if (audit.error || audit.signal || ![0, 1].includes(audit.status)) {
      throw new Error("npm audit did not complete normally.");
    }
    decision = evaluateAudit(JSON.parse(audit.stdout), {
      exitCode: audit.status,
    });
  } catch (error) {
    decision = { passed: false, exceptionUsed: false, reason: `Audit gate failed: ${error.message}` };
  }
  writeFileSync(path.join(output, "dependency-audit-decision.json"), JSON.stringify({
    checkedAt: new Date().toISOString(), ...decision,
  }, null, 2) + "\n");
  console.log(`${decision.passed ? "PASS" : "FAIL"}: ${decision.reason}`);
  console.log("Original npm audit report and decision: output/ci/dependency-audit*.json");
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Dependency audit\n\n${decision.passed ? "Passed" : "Failed"}. ${decision.reason}\n\nRaw evidence is in the site-review artifact under output/ci.\n`);
  }
  process.exitCode = decision.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
