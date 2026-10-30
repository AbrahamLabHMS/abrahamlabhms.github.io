import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createStaticSiteTools, normalizeBasePath } from "./lib/static-site-server.mjs";

test("publication figures recover from failed requests without trapping readers in empty viewers", {
  skip: process.env.RUN_REVIEW_BROWSER_FIXTURES !== "1",
  timeout: 180000
}, async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, ".cache/ms-playwright");
  const { chromium, firefox, webkit } = await import("playwright");
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const basePath = normalizeBasePath(process.env.SITE_BASE_PATH);
  const server = await createStaticSiteTools({ siteRoot: path.join(root, "_site"), basePath }).start(Number(process.env.FIGURE_LOADING_PORT || 4177));
  t.after(() => server.close());
  const url = `${server.origin}${basePath}/publications/`;
  const output = path.resolve(root, process.env.FIGURE_LOADING_OUTPUT || "output/playwright/figure-loading");
  await mkdir(output, { recursive: true });
  const selector = '[data-figure-key="submergence"]';
  const fullImage = await readFile(path.join(root, "public/assets/images/publications/submergence-fig3-1063.webp"));
  const cases = [
    { name: "healthy", width: 1440, theme: "light" },
    { name: "healthy-mobile", width: 390, theme: "dark", scale: 2 },
    { name: "thumbnail-retry", width: 1440, theme: "dark", fail: "thumbnail", recover: true },
    { name: "full-image-retry", width: 1440, theme: "light", scale: 3, fail: "thumbnail", recover: true },
    { name: "source-fallback", width: 1440, theme: "dark", fail: "thumbnail" },
    { name: "source-fallback-mobile", width: 390, theme: "light", fail: "thumbnail" },
    { name: "viewer-retry", width: 1440, theme: "dark", fail: "viewer", recover: true },
    { name: "viewer-fallback", width: 1440, theme: "light", fail: "viewer" },
    { name: "no-js", width: 390, theme: "dark", fail: "thumbnail", noJs: true }
  ];

  for (const [engineName, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const scenario of cases) {
        const context = await browser.newContext({
          viewport: { width: scenario.width, height: 900 }, colorScheme: scenario.theme,
          deviceScaleFactor: scenario.scale || 1, javaScriptEnabled: !scenario.noJs,
          reducedMotion: "reduce"
        });
        try {
          context.setDefaultTimeout(10000);
          context.setDefaultNavigationTimeout(10000);
          const attempts = [];
          await context.route("**/submergence-fig3-*.webp*", async route => {
            const requestUrl = new URL(route.request().url());
            const retry = requestUrl.searchParams.get("figure_retry") === "1";
            const fails = scenario.fail === "thumbnail" || (scenario.fail === "viewer" && requestUrl.pathname.endsWith("-1063.webp"));
            attempts.push({ url: requestUrl.href, retry, fails });
            if (!fails) return route.continue();
            if (retry && scenario.recover) return route.fulfill({ contentType: "image/webp", body: fullImage });
            return route.abort("failed");
          });
          // A source link is exercised locally, without contacting the publisher.
          await context.route("https://pmc.ncbi.nlm.nih.gov/**", route => route.fulfill({ contentType: "text/html", body: "<title>Source figure fixture</title>" }));
          const page = await context.newPage();
          await page.goto(url);
          const figure = page.locator(selector);
          const thumbnail = figure.locator("[data-figure-image]");
          const link = figure.locator("[data-figure-viewer]");
          const viewer = page.locator("#figure-viewer-submergence");
          await figure.scrollIntoViewIfNeeded();

          if (scenario.noJs) {
            await page.waitForFunction(s => {
              const image = document.querySelector(`${s} img`);
              return image.complete && image.naturalWidth === 0;
            }, selector);
            assert.equal(await thumbnail.evaluate(node => getComputedStyle(node).color), "rgb(32, 39, 39)");
            assert.equal(await link.getAttribute("aria-haspopup"), null);
            assert.match(await link.getAttribute("href"), /submergence-fig3-1063\.webp$/);
            assert.equal(attempts.filter(attempt => attempt.retry).length, 0);
          } else if (scenario.fail === "thumbnail" && !scenario.recover) {
            await figure.locator("[data-figure-error]").waitFor({ state: "visible" });
            assert.equal(await thumbnail.isVisible(), false);
            assert.equal(await link.getAttribute("aria-haspopup"), null);
            assert.match(await link.getAttribute("aria-label"), /Open source figure 3.*opens in a new tab/);
            assert.match(await link.textContent(), /Source figure/);
            const source = await link.getAttribute("href");
            const popupEvent = page.waitForEvent("popup");
            await link.click();
            const popup = await popupEvent;
            await popup.waitForLoadState();
            assert.equal(popup.url(), source);
            assert(await popup.evaluate(() => window.opener === null));
            assert.equal(await viewer.isVisible(), false);
            await popup.close();
          } else {
            await page.waitForFunction(s => {
              const image = document.querySelector(`${s} img`);
              return image.complete && image.naturalWidth > 0;
            }, selector);
            assert.equal(await figure.locator("[data-figure-error]").isVisible(), false);
            await link.click();
            await viewer.waitFor({ state: "visible" });
            if (scenario.fail === "viewer" && !scenario.recover) {
              await viewer.locator("[data-figure-error]").waitFor({ state: "visible" });
              assert.equal(await viewer.locator("img").isVisible(), false);
              assert(await viewer.getByRole("link", { name: "Source figure" }).isVisible());
              const axe = await new AxeBuilder({ page }).include("#figure-viewer-submergence").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
              assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
              await viewer.screenshot({ path: path.join(output, `${engineName}-${scenario.name}-dialog.png`) });
            } else {
              await page.waitForFunction(() => {
                const image = document.querySelector("#figure-viewer-submergence img");
                return image.complete && image.naturalWidth > 0;
              });
            }
            await page.keyboard.press("Escape");
            assert.equal(await viewer.isVisible(), false);
            assert(await link.evaluate(node => document.activeElement === node));
          }

          if (!scenario.noJs) {
            const axe = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
          }
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          await figure.screenshot({ path: path.join(output, `${engineName}-${scenario.name}.png`) });
          // Some engines reuse the thumbnail's successful retry for the independent viewer image.
          const maxRetries = scenario.fail && !scenario.noJs ? (scenario.fail === "thumbnail" && scenario.recover ? 2 : 1) : 0;
          const retryCount = attempts.filter(attempt => attempt.retry).length;
          assert(retryCount <= maxRetries && retryCount >= Math.min(1, maxRetries), JSON.stringify(attempts));
          if (scenario.fail && !scenario.noJs) {
            assert(attempts.filter(attempt => attempt.fails).length <= maxRetries * 2, JSON.stringify(attempts));
            const retriedImage = scenario.fail === "viewer" ? viewer.locator("img") : thumbnail;
            assert.match(await retriedImage.getAttribute("src"), /figure_retry=1$/);
          }
          console.log(`${engineName}: ${scenario.name} passed`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
});
