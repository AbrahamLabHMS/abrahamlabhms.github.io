import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";
import { collectFitSnapshot, inspectFit, waitForLocalImages } from "./lib/review-checks.mjs";

// Opt-in only: ordinary offline tests must never launch a browser or bind a server.
const skip = process.env.RUN_REVIEW_BROWSER_FIXTURES !== "1";

test("browser fixture distinguishes pressure from hidden, nested, and positioned content", { skip }, async (t) => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(await fs.readFile(new URL("./fixtures/review-layout.html", import.meta.url), "utf8"));
  const result = inspectFit(await page.evaluate(collectFitSnapshot));
  assert.ok(result.parentCollisions.some((item) => item.selector === "#long"));
  assert.ok(result.parentCollisions.some((item) => item.selector === "#clip-text"));
  assert.equal(result.siblingCollisions.length, 1);
  assert.deepEqual(new Set(Object.values(result.siblingCollisions[0])), new Set(["#long", "#neighbor"]));
});

test("browser unresolved-image fixture respects a short timeout with no network", { skip }, async (t) => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({ contentType: "text/html", body: '<img src="/pending.png" alt="Pending fixture">' });
    }
    // The image route intentionally remains unresolved until page cleanup.
  });
  await page.goto("https://review-fixture.invalid/", { waitUntil: "domcontentloaded" });
  const started = performance.now();
  assert.equal(await waitForLocalImages(page, 80), false);
  assert.ok(performance.now() - started < 2000, "image timeout must not fall back to Playwright's default wait");
});
