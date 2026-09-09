import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { createStaticSiteTools, ForbiddenPathError, normalizeBasePath } from "./lib/static-site-server.mjs";
import { collectFitSnapshot, inspectFit, waitForLocalImages, waitForSystemTheme } from "./lib/review-checks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const siteRoot = path.join(repoRoot, "_site");
const outputRoot = path.join(repoRoot, "output", "visual-review");
const screenshotRoot = path.join(outputRoot, "screenshots");
const port = Number(process.env.VISUAL_REVIEW_PORT || 4173);
const basePath = normalizeBasePath(process.env.SITE_BASE_PATH);
const staticSite = createStaticSiteTools({ siteRoot, basePath });

process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(repoRoot, ".cache", "ms-playwright");

const routes = [
  { slug: "home", path: "/" },
  { slug: "research", path: "/research/" },
  { slug: "publications", path: "/publications/" },
  { slug: "jonathan-abraham", path: "/jonathan-abraham/" },
  { slug: "team", path: "/team/" },
  { slug: "news", path: "/news/" },
  { slug: "contact", path: "/contact/" }
];

const viewports = [
  { name: "320", width: 320, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "820", width: 820, height: 1180 },
  { name: "1024", width: 1024, height: 1366 },
  { name: "1280", width: 1280, height: 1440 },
  { name: "1440", width: 1440, height: 1600 }
];

const themes = ["light", "dark"];

function parseSelection(value, catalog, matcher) {
  if (!value) {
    return catalog;
  }

  const requested = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!requested.length) {
    return catalog;
  }

  const selected = catalog.filter((item) => requested.some((entry) => matcher(item, entry)));
  if (!selected.length) {
    throw new Error(`VISUAL_REVIEW selection did not match any items: ${requested.join(", ")}`);
  }

  return selected;
}

const selectedRoutes = parseSelection(process.env.VISUAL_REVIEW_ROUTES, routes, (route, entry) => {
  const normalizedEntry = entry.replace(/^\/+|\/+$/g, "");
  return route.slug === entry || route.path === entry || route.path.replace(/^\/+|\/+$/g, "") === normalizedEntry;
});

const selectedViewports = parseSelection(process.env.VISUAL_REVIEW_VIEWPORTS, viewports, (viewport, entry) => viewport.name === entry);
const selectedThemes = parseSelection(process.env.VISUAL_REVIEW_THEMES, themes, (theme, entry) => theme === entry);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function screenshotName(route, viewport, theme) {
  return `${route.slug}-${viewport.name}-${theme}.png`;
}

function githubAnnotation(message) {
  return String(message)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

async function writeIndex(manifest) {
  const cards = manifest
    .map(
      ({ route, viewport, theme, relativePath }) => `
        <article class="card">
          <h2>${route.slug} · ${viewport.name}px · ${theme}</h2>
          <p>${route.path}</p>
          <a href="${relativePath}"><img src="${relativePath}" alt="${route.slug} at ${viewport.name}px" loading="lazy" /></a>
        </article>
      `
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Abraham Lab Visual Review</title>
    <style>
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #11161d; color: #f5f7fa; }
      main { width: min(1320px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
      h1 { margin: 0 0 10px; font-size: 2rem; }
      p { margin: 0 0 16px; color: rgba(245,247,250,0.78); }
      .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 20px; font-size: 0.9rem; color: rgba(245,247,250,0.62); }
      .meta code { font: inherit; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
      .card { padding: 16px; border: 1px solid rgba(255,255,255,0.12); background: #171f29; }
      .card h2 { margin: 0 0 8px; font-size: 1rem; }
      .card p { font-size: 0.9rem; margin-bottom: 12px; }
      .card img { width: 100%; height: auto; display: block; border: 1px solid rgba(255,255,255,0.08); }
      a { color: inherit; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Abraham Lab Visual Review</h1>
      <p>Generated screenshots for all public routes across the required viewport matrix.</p>
      <div class="meta">
        <span>Routes: <code>${selectedRoutes.length}</code></span>
        <span>Viewports: <code>${selectedViewports.length}</code></span>
        <span>Themes: <code>${selectedThemes.join(", ")}</code></span>
      </div>
      <section class="grid">
        ${cards}
      </section>
    </main>
  </body>
</html>`;

  await fs.writeFile(path.join(outputRoot, "index.html"), html, "utf8");
}

async function run() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await ensureDir(screenshotRoot);
  const server = await staticSite.start(port);

  try {
    const { chromium } = await import("playwright");
    let browser;

    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to launch Chromium for local visual review. On some macOS environments, headless Chromium fails with local MachPort permission errors even when the site build succeeds. The repo-integrated GitHub Actions workflow remains the canonical screenshot review path, and local review may require a headed browser outside this sandbox.\n\n${message}`
      );
    }

    const manifest = [];
    const failures = [];
    const origin = server.origin;
    const unknownResponse = await fetch(`${origin}${basePath}/visual-review-missing-route/`);
    if (unknownResponse.status !== 404) {
      failures.push(`Static server returned ${unknownResponse.status} for an unknown route.`);
    }

    const noJsContext = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    const noJsResponse = await noJsPage.goto(`${origin}${basePath}/`, { waitUntil: "domcontentloaded" });
    const visibleNoJsLinks = await noJsPage.locator(".site-nav a:visible").count();
    if (!noJsResponse?.ok() || visibleNoJsLinks < 4) {
      failures.push("Mobile navigation is not usable when JavaScript is disabled.");
    }
    await noJsContext.close();

    const printContext = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
    const printPage = await printContext.newPage();
    await printPage.emulateMedia({ media: "print", colorScheme: "light" });
    const printResponse = await printPage.goto(`${origin}${basePath}/publications/`, { waitUntil: "domcontentloaded" });
    const printCheck = await printPage.evaluate(() => ({
      headerDisplay: getComputedStyle(document.querySelector(".site-header")).display,
      footerDisplay: getComputedStyle(document.querySelector(".site-footer")).display,
      indexDisplay: getComputedStyle(document.querySelector(".publication-index")).display,
      hasPrintButton: Boolean(document.querySelector(".publication-print")),
      documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
    }));
    if (!printResponse?.ok()) failures.push("Publications print view did not load.");
    if (printCheck.hasPrintButton || [printCheck.headerDisplay, printCheck.footerDisplay, printCheck.indexDisplay].some((value) => value !== "none")) {
      failures.push("Publications print view includes screen-only navigation or controls.");
    }
    if (printCheck.documentOverflow > 1) failures.push(`Publications print view has ${printCheck.documentOverflow}px of horizontal overflow.`);
    await printContext.close();

    for (const viewport of selectedViewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1
      });

      for (const route of selectedRoutes) {
        for (const theme of selectedThemes) {
          const page = await context.newPage();
          const pageFailures = [];
          page.on("pageerror", (error) => pageFailures.push(`page error: ${error.message}`));
          page.on("console", (message) => {
            if (message.type() !== "error") return;
            const sourceUrl = message.location().url || "";
            if (!sourceUrl || sourceUrl.startsWith(origin)) {
              pageFailures.push(`console error: ${message.text()}`);
            }
          });
          page.on("requestfailed", (request) => {
            if (request.url().startsWith(origin)) {
              pageFailures.push(`request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`);
            }
          });
          await page.emulateMedia({ colorScheme: theme });
          const url = `${origin}${basePath}${route.path}`;
          // Third-party embeds can keep background requests open indefinitely.
          // Audit the local document first, then check each embed explicitly below.
          const response = await page.goto(url, { waitUntil: "domcontentloaded" });
          if (!response?.ok()) {
            pageFailures.push(`route returned ${response?.status() ?? "no response"}: ${url}`);
          }
          await waitForSystemTheme(page, theme);
          await page.evaluate(async () => {
            if (document.fonts?.ready) {
              await document.fonts.ready;
            }
          });

          const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < pageHeight; y += Math.max(Math.floor(viewport.height * 0.72), 300)) {
            await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
            await page.waitForTimeout(100);
          }
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(200);
          await waitForLocalImages(page, 5000);
          if (route.slug === "contact") {
            await page.locator(".map-widget").scrollIntoViewIfNeeded();
            const mapCheck = await page.evaluate(() => {
              const toggle = document.querySelector(".map-widget__toggle");
              const media = document.querySelector(".map-widget__media");
              const outbound = document.querySelector('.map-widget__body a[href*="google.com/maps"]');
              return {
                frameSource: toggle?.getAttribute("data-map-src") || "",
                hasEagerFrame: Boolean(media?.querySelector("iframe")),
                hasUsableToggle: Boolean(toggle && !toggle.hidden && toggle.getAttribute("aria-expanded") === "false"),
                mediaHidden: Boolean(media?.hidden),
                outboundHref: outbound?.getAttribute("href") || ""
              };
            });
            if (!mapCheck.frameSource.startsWith("https://maps.google.com/maps?") || !mapCheck.frameSource.includes("output=embed")) {
              pageFailures.push("Google map embed source is missing or invalid.");
            }
            if (mapCheck.hasEagerFrame || !mapCheck.hasUsableToggle || !mapCheck.mediaHidden) {
              pageFailures.push("Google map must remain unloaded until its visible control is activated.");
            }
            if (!mapCheck.outboundHref.startsWith("https://www.google.com/maps/")) {
              pageFailures.push("Google Maps directions link is missing or invalid.");
            }
          }
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            window.scrollTo(0, 0);
          });
          await page.waitForFunction(() => window.scrollY === 0);
          await page.waitForTimeout(150);

          const behaviorCheck = await page.evaluate(() => ({
            hiddenReveals: [...document.querySelectorAll(".reveal")].filter((node) => {
              const style = getComputedStyle(node);
              return style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 || node.getBoundingClientRect().height === 0;
            }).length,
            documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            brokenImages: [...document.images]
              .filter((img) => new URL(img.currentSrc || img.src, location.href).origin === location.origin && (!img.complete || img.naturalWidth === 0))
              .map((img) => img.currentSrc || img.getAttribute("src"))
          }));
          if (behaviorCheck.hiddenReveals) {
            pageFailures.push(`${behaviorCheck.hiddenReveals} content sections remain hidden.`);
          }
          if (behaviorCheck.documentOverflow > 1) {
            pageFailures.push(`horizontal overflow of ${behaviorCheck.documentOverflow}px.`);
          }
          if (behaviorCheck.brokenImages.length) {
            pageFailures.push(`broken local images: ${behaviorCheck.brokenImages.join(", ")}`);
          }
          const fit = inspectFit(await page.evaluate(collectFitSnapshot));
          for (const item of fit.parentCollisions) pageFailures.push(`content escapes parent: ${item.selector} in ${item.parent}`);
          for (const item of fit.siblingCollisions) pageFailures.push(`in-flow content overlaps: ${item.first} / ${item.second}`);

          if (viewport.width <= 430 && route.slug === "home" && theme === "light") {
            await page.locator(".nav-toggle").click();
            if (await page.locator(".site-nav.is-open").count() !== 1) {
              pageFailures.push("mobile navigation did not open.");
            }
            await page.keyboard.press("Escape");
            if (await page.locator(".site-nav.is-open").count() !== 0) {
              pageFailures.push("mobile navigation did not close with Escape.");
            }
          }

          await page.addStyleTag({
            content: `
              *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                scroll-behavior: auto !important;
              }
              .reveal {
                opacity: 1 !important;
                transform: none !important;
              }
            `
          });

          const fileName = screenshotName(route, viewport, theme);
          const filePath = path.join(screenshotRoot, fileName);
          await page.screenshot({
            path: filePath,
            fullPage: true,
            animations: "disabled"
          });

          manifest.push({
            route,
            viewport,
            theme,
            relativePath: `screenshots/${fileName}`,
            failures: pageFailures
          });

          failures.push(...pageFailures.map((message) => `${route.slug} ${viewport.name}px ${theme}: ${message}`));

          await page.close();
        }
      }

      await context.close();
    }

    await browser.close();
    await fs.writeFile(
      path.join(outputRoot, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
    await writeIndex(manifest);
    if (failures.length) {
      await fs.writeFile(path.join(outputRoot, "failures.json"), JSON.stringify(failures, null, 2), "utf8");
      if (process.env.GITHUB_ACTIONS === "true") {
        console.error(`::error title=Visual review failed::${githubAnnotation(failures.join("\n"))}`);
      }
      throw new Error(`Visual review failed:\n- ${failures.join("\n- ")}`);
    }
  } finally {
    await server.close();
  }
}

async function runSelfTest() {
  const rejected = ["/..%5c..%5cpackage-lock.json", "/..%2f..%2fpackage-lock.json", "/%2e%2e/%2e%2e/package-lock.json"];
  for (const requestPath of rejected) {
    let didReject = false;
    try {
      staticSite.safeStaticRequestPath(requestPath);
    } catch (error) {
      didReject = error instanceof ForbiddenPathError;
    }
    if (!didReject) {
      throw new Error(`Expected traversal path to be rejected: ${requestPath}`);
    }
  }
  const direct = staticSite.staticCandidate("index.html");
  if (!staticSite.isInsideSiteRoot(direct)) {
    throw new Error("Expected normal static path to remain inside _site");
  }
  console.log("visual-review path containment self-test passed");
}

const entrypoint = process.env.VISUAL_REVIEW_SELF_TEST === "1" ? runSelfTest : run;

entrypoint().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
