import assert from "node:assert/strict";
import test from "node:test";
import { checkUrl, classifyStatus, collectExternalLinks, linkCheckExitCode, renderMarkdown } from "./check-external-links.mjs";

function responses(...statuses) {
  return async () => {
    assert.ok(statuses.length, "unexpected fetch; tests must not use the network");
    const status = statuses.shift();
    if (status instanceof Error) throw status;
    return { status, url: "https://final.example.test/", body: { cancel: async () => {} } };
  };
}

test("only repeated 404/410 results cause a broken-link failure", async () => {
  for (const status of [404, 410]) {
    const result = await checkUrl("https://example.test", responses(status, status));
    assert.equal(result.state, "broken");
    assert.equal(result.confirmed, true);
    assert.equal(result.attempts.length, 2);
    assert.equal(linkCheckExitCode([result]), 1);
  }
  for (const status of [200, 403, 429, 503, new Error("timeout")]) {
    const result = await checkUrl("https://example.test", responses(404, status));
    assert.equal(result.confirmed, false);
    assert.equal(linkCheckExitCode([result]), 0);
  }
});

test("restricted, rate-limited, and transient states remain distinct and nonfatal", async () => {
  for (const [status, state] of [[200, "ok"], [401, "restricted"], [403, "restricted"], [405, "restricted"], [429, "rate-limited"], [408, "transient"], [503, "transient"], [400, "warning"]]) {
    assert.equal(classifyStatus(status), state);
    const result = await checkUrl("https://example.test", responses(status));
    assert.equal(result.state, state);
    assert.equal(linkCheckExitCode([result]), 0);
  }
});

test("reports identify source pages and final destinations; extraction parses HTML entities", () => {
  assert.deepEqual(collectExternalLinks(`<a href='http://example.test/?x=1&amp;y=2'>Link</a><!-- <a href="https://ignore.test/"> -->`), ["http://example.test/?x=1&y=2"]);
  const report = renderMarkdown({ generatedAt: "fixture", total: 1, counts: { ok: 0, broken: 1, restricted: 0, "rate-limited": 0, transient: 0, warning: 0 }, results: [{ state: "broken", status: 410, url: "https://example.test/", finalUrl: "https://final.example.test/", pages: ["team/index.html"] }] });
  assert.match(report, /team\/index.html/);
  assert.match(report, /Final destination: https:\/\/final.example.test\//);
  assert.match(report, /Repeated 404\/410 responses fail/);
});
