import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { linkedInProfileError, publicLinkedInUrl } from "../src/lib/team-links.ts";
import { renderTeamName } from "./test-helpers/render-team-name.mjs";
import { createStaticSiteTools, normalizeBasePath } from "./lib/static-site-server.mjs";

const profile = { url: "https://www.linkedin.com/in/example-member/", optedIn: true };

test("LinkedIn links require explicit opt-in and a valid personal-profile URL", () => {
  assert.equal(linkedInProfileError(undefined), null);
  assert.equal(publicLinkedInUrl(), undefined);
  assert.equal(publicLinkedInUrl({ ...profile, optedIn: false }), undefined);
  assert.equal(publicLinkedInUrl({ url: profile.url }), undefined);
  assert.equal(publicLinkedInUrl({ ...profile, optedIn: "true" }), undefined);
  assert.equal(publicLinkedInUrl(profile), profile.url);
  assert.equal(linkedInProfileError({ ...profile, url: "https://linkedin.com/in/test-member-123" }), null);
  for (const url of [
    "javascript:alert(1)", "http://www.linkedin.com/in/example/", "/in/example/",
    "https://linkedin.com.evil.example/in/example/", "https://www.linkedin.com/company/example/",
    "https://www.linkedin.com/in/", "https://www.linkedin.com/in/example/?tracking=1",
    "https://www.linkedin.com/in/example/#section", "https://user:password@www.linkedin.com/in/example/",
    "https://www.linkedin.com:8443/in/example/", " https://www.linkedin.com/in/example/",
    "https://www.linkedin.com/in/%ZZ/"
  ]) {
    assert.ok(linkedInProfileError({ ...profile, url }), url);
    assert.equal(publicLinkedInUrl({ ...profile, url }), undefined);
  }
});

test("the actual team-name component omits unapproved links and labels approved links", async () => {
  for (const linkedin of [undefined, { ...profile, optedIn: false }, { url: profile.url }, { ...profile, url: "https://example.org/" }]) {
    const html = await renderTeamName({ name: "Test Member", linkedin });
    assert.match(html, /<h3>Test Member<\/h3>/);
    assert.doesNotMatch(html, /<a\b|<svg\b/);
  }
  const html = await renderTeamName({ name: "Test Member", linkedin: profile });
  assert.match(html, /href="https:\/\/www.linkedin.com\/in\/example-member\/"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Test Member on LinkedIn \(opens in a new tab\)"/);
  assert.match(html, /<svg[^>]+aria-hidden="true"/);
});

test("opted-in team links fit both themes and open a separate tab in all browsers", {
  skip: process.env.RUN_REVIEW_BROWSER_FIXTURES !== "1",
  timeout: 120000
}, async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, ".cache/ms-playwright");
  const { chromium, firefox, webkit } = await import("playwright");
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const basePath = normalizeBasePath(process.env.SITE_BASE_PATH);
  const server = await createStaticSiteTools({ siteRoot: path.join(root, "_site"), basePath }).start(Number(process.env.TEAM_REVIEW_PORT || 4176));
  const teamUrl = server.origin + basePath + "/team/";
  t.after(() => server.close());
  const output = path.join(root, "output/playwright/team-links");
  await mkdir(output, { recursive: true });
  const name = "Example Graduate Researcher With A Long Name";
  const html = await renderTeamName({ name, linkedin: profile });

  for (const [engineName, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const width of [390, 820, 1440]) for (const theme of ["light", "dark"]) for (const javaScriptEnabled of (width === 390 ? [true, false] : [true])) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce", javaScriptEnabled });
        try {
          context.setDefaultTimeout(10000);
          context.setDefaultNavigationTimeout(10000);
          // Never contact a real profile during a fixture test.
          await context.route("https://www.linkedin.com/**", route => route.fulfill({ contentType: "text/html", body: "<title>Profile fixture</title>" }));
          const page = await context.newPage();
          await page.goto(teamUrl);
          // Firefox does not settle this promise when page scripting is disabled.
          if (javaScriptEnabled) await page.evaluate(() => document.fonts.ready);
          const identity = page.locator(".team-row__identity").first();
          await identity.evaluate((node, html) => { node.innerHTML = html; }, html);
          const link = identity.getByRole("link", { name: `${name} on LinkedIn (opens in a new tab)` });
          await link.scrollIntoViewIfNeeded();
          const fit = await identity.evaluate(node => {
            const name = node.querySelector("h3").getBoundingClientRect();
            const link = node.querySelector("a").getBoundingClientRect();
            const row = node.closest(".team-row").getBoundingClientRect();
            return { target: link.width >= 44 && link.height >= 44, noOverlap: name.right <= link.left, fits: link.right <= row.right, overflow: document.documentElement.scrollWidth - innerWidth };
          });
          assert(fit.target && fit.noOverlap && fit.fits && fit.overflow <= 1, JSON.stringify(fit));
          await link.focus();
          assert(await link.evaluate(node => getComputedStyle(node).outlineStyle !== "none"));
          await page.screenshot({ path: path.join(output, `${engineName}-${width}-${theme}${javaScriptEnabled ? "" : "-nojs"}.png`) });
          console.log(`${engineName} ${width} ${theme} ${javaScriptEnabled ? "JS" : "no JS"}: layout and focus passed`);
          if (javaScriptEnabled) {
            const axe = await new AxeBuilder({ page }).include(".team-row").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
          }
          await link.focus();
          const popupEvent = page.waitForEvent("popup");
          await page.keyboard.press("Enter");
          const popup = await popupEvent;
          await popup.waitForLoadState("load");
          assert.equal(popup.url(), profile.url);
          assert.equal(page.url(), teamUrl);
          assert(await popup.evaluate(() => window.opener === null));
          await popup.close();
          console.log(`${engineName} ${width} ${theme}: LinkedIn opens separately; original page preserved`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
});
