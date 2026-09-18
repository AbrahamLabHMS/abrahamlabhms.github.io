import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { visitLocalImages, waitForLocalImages } from "./lib/review-checks.mjs";

const skip = process.env.RUN_REVIEW_BROWSER_FIXTURES !== "1";
const imageBytes = await sharp({ create: { width: 960, height: 640, channels: 3, background: "#087780" } }).png().toBuffer();

for (const engine of ["chromium", "firefox", "webkit"]) {
  test(`${engine}: lazy images load after viewport visits without changing their markup`, { skip }, async (t) => {
    const playwright = await import("playwright");
    const browser = await playwright[engine].launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const requests = [];
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().resourceType() === "document") {
        await route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body style="margin:0">
          <img src="/top.png" width="40" height="40" alt="Top">
          <div style="height:5000px"></div>
          <img id="middle" loading="lazy" src="/middle.png" srcset="/middle-small.png 960w, /middle-large.png 1536w" sizes="90vw" width="350" height="240" alt="Middle">
          <div style="height:5000px"></div>
          <img id="last" loading="lazy" src="/last.png" width="350" height="240" alt="Last">
          <img id="broken" loading="lazy" src="/broken.png" width="40" height="40" alt="Missing">
          <dialog><img id="deferred" loading="lazy" src="/deferred.png" width="960" height="640" alt="Deferred viewer"></dialog>
          <div style="height:1000px"></div>
          </body></html>` });
      } else {
        requests.push(url.pathname);
        await route.fulfill(url.pathname === "/broken.png"
          ? { status: 404, contentType: "text/plain", body: "Missing fixture image" }
          : { contentType: "image/png", body: imageBytes });
      }
    });
    await page.goto("https://review-fixture.invalid/", { waitUntil: "domcontentloaded" });
    const initialMarkup = await page.locator("body").innerHTML();
    assert.equal(await page.locator("#middle").evaluate((node) => node.complete), false);
    assert.equal(await page.locator("#last").evaluate((node) => node.complete), false);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    assert.equal(await waitForLocalImages(page, 100), false, "Jumping to the footer leaves intermediate lazy images unloaded");
    await page.evaluate(() => window.scrollTo(0, 0));
    await visitLocalImages(page);
    assert.equal(await waitForLocalImages(page, 1000), true);
    assert.equal(await page.locator("#deferred").isVisible(), false, "Closed image viewers must not delay the visible-image audit");
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    assert.equal(await page.locator("body").innerHTML(), initialMarkup);
    for (const selector of ["#middle", "#last"]) {
      const state = await page.locator(selector).evaluate((node) => ({ complete: node.complete, width: node.naturalWidth, selected: node.currentSrc }));
      assert.ok(state.complete && state.width > 0, JSON.stringify({ selector, state, requests }));
    }
    assert.ok(requests.includes("/middle-small.png"), requests.join(", "));
    assert.ok(!requests.includes("/middle.png"), "The selected responsive image must load, not a replacement fallback");
    assert.equal(await page.locator("#broken").evaluate((node) => node.naturalWidth), 0, "Broken assets must remain observable by the release checks");
  });
}
