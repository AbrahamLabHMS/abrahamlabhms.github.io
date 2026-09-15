import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { createStaticSiteTools, normalizeBasePath } from "./lib/static-site-server.mjs";
import { collectFitSnapshot, enlargeText, inspectFit, visitLocalImages, waitForLocalImages, waitForSystemTheme } from "./lib/review-checks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const siteRoot = path.join(repoRoot, "_site");
const outputRoot = path.join(repoRoot, "output", "quality-review");
const port = Number(process.env.QUALITY_REVIEW_PORT || 4174);
const basePath = normalizeBasePath(process.env.SITE_BASE_PATH);
const staticSite = createStaticSiteTools({ siteRoot, basePath });

process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(repoRoot, ".cache", "ms-playwright");

const primaryRoutes = [
  { slug: "home", path: "/" },
  { slug: "publications", path: "/publications/" },
  { slug: "jonathan-abraham", path: "/jonathan-abraham/" },
  { slug: "team", path: "/team/" },
  { slug: "news", path: "/news/" },
  { slug: "contact", path: "/contact/" },
  { slug: "research", path: "/research/" }
];

const legacyRoutes = [
  { slug: "people", path: "/people/", target: "/team/" },
  { slug: "contact-us", path: "/contact-us/", target: "/contact/" },
  { slug: "meet-the-pi", path: "/meet-the-pi/", target: "/jonathan-abraham/" }
];

const compatibilityViewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet-portrait", width: 820, height: 1180 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 }
];

const stressViewports = [
  { name: "reflow-400-percent-equivalent", width: 320, height: 800 },
  ...[599, 601, 819, 821, 1039, 1041].map((width) => ({ name: `breakpoint-${width}`, width, height: 960 })),
  { name: "narrow-window", width: 600, height: 960 },
  { name: "short-wide", width: 900, height: 600 },
  { name: "wide-desktop", width: 1600, height: 900 }
];

const accessibilityViewports = [
  compatibilityViewports[0],
  compatibilityViewports[1],
  compatibilityViewports[3]
];

const defaultBrowsers = ["chromium", "firefox", "webkit"];
const themes = ["light", "dark"];

function parseBrowsers(value) {
  if (!value) return defaultBrowsers;
  const names = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const invalid = names.filter((name) => !defaultBrowsers.includes(name));
  if (invalid.length) throw new Error(`Unknown browser engine: ${invalid.join(", ")}`);
  return [...new Set(names)];
}

const selectedBrowsers = parseBrowsers(process.env.QUALITY_REVIEW_BROWSERS);

function tabKey(browserName) {
  // Safari on macOS uses Option-Tab for links unless full keyboard access is enabled.
  return browserName === "webkit" && process.platform === "darwin" && process.env.QUALITY_REVIEW_WEBKIT_OPTION_TAB === "1"
    ? "Alt+Tab"
    : "Tab";
}

function routeUrl(origin, routePath) {
  return `${origin}${basePath}${routePath}`;
}

function annotation(message) {
  return String(message)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

async function preparePage(page, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await waitForSystemTheme(page, theme);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await visitLocalImages(page);
  await waitForLocalImages(page, 2500);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function inspectLayout(page) {
  const fit = inspectFit(await page.evaluate(collectFitSnapshot));
  const layout = await page.evaluate(() => {
    const selectorFor = (element) => {
      if (!(element instanceof Element)) return "unknown";
      if (element.id) return `#${element.id}`;
      const classes = [...element.classList].slice(0, 2).join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const textSelector = "h1,h2,h3,h4,p,a,button,address,li,dt,dd,time,strong,small";
    const edgeCollisions = [...document.querySelectorAll(textSelector)]
      .filter(visible)
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .slice(0, 10)
      .map((node) => ({ selector: selectorFor(node), text: node.textContent?.trim().slice(0, 80) || "" }));
    const clippedText = [...document.querySelectorAll(textSelector)]
      .filter(visible)
      .filter((node) => {
        const style = getComputedStyle(node);
        const clips = ["hidden", "clip"].includes(style.overflow) || ["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflowY);
        return clips && (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
      })
      .slice(0, 10)
      .map((node) => ({ selector: selectorFor(node), text: node.textContent?.trim().slice(0, 80) || "" }));
    const duplicateIds = [...document.querySelectorAll("[id]")]
      .map((node) => node.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const heading = document.querySelector("main h1");

    return {
      lang: document.documentElement.lang,
      h1Count: document.querySelectorAll("main h1").length,
      editorialHeading: heading instanceof HTMLElement && getComputedStyle(heading).fontFamily.includes("Newsreader"),
      editorialFontLoaded: [...document.fonts].some((font) => font.family.includes("Newsreader") && font.status === "loaded"),
      wrappedChapterNumbers: [...document.querySelectorAll(".research-index a span")].filter((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getClientRects().length > 1;
      }).length,
      hasMain: Boolean(document.querySelector("main#main-content")),
      hasSkipTarget: Boolean(document.querySelector("#main-content")),
      documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      hiddenReveals: [...document.querySelectorAll(".reveal")].filter((node) => {
        const style = getComputedStyle(node);
        return style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 || node.getBoundingClientRect().height === 0;
      }).length,
      brokenImages: [...document.images]
        .filter((image) => new URL(image.currentSrc || image.src, location.href).origin === location.origin && (!image.complete || image.naturalWidth === 0))
        .map((image) => image.currentSrc || image.getAttribute("src")),
      edgeCollisions,
      clippedText,
      duplicateIds: [...new Set(duplicateIds)]
    };
  });
  return { ...layout, ...fit };
}

function addLayoutFailures(failures, label, check) {
  if (check.lang !== "en") failures.push(`${label}: document language is not English.`);
  if (check.h1Count !== 1) failures.push(`${label}: expected one main heading, found ${check.h1Count}.`);
  if (!check.editorialHeading) failures.push(`${label}: the page heading does not use the shared editorial typeface.`);
  if (!check.editorialFontLoaded) failures.push(`${label}: the editorial font did not load; the heading uses a fallback.`);
  if (check.wrappedChapterNumbers) failures.push(`${label}: research chapter numbers wrap across lines.`);
  if (!check.hasMain || !check.hasSkipTarget) failures.push(`${label}: main landmark or skip-link target is missing.`);
  if (check.documentOverflow > 1) failures.push(`${label}: horizontal overflow of ${check.documentOverflow}px.`);
  if (check.hiddenReveals) failures.push(`${label}: ${check.hiddenReveals} content sections remain hidden.`);
  if (check.brokenImages.length) failures.push(`${label}: broken local images: ${check.brokenImages.join(", ")}.`);
  if (check.edgeCollisions.length) failures.push(`${label}: text crosses the viewport edge at ${check.edgeCollisions.map((item) => item.selector).join(", ")}.`);
  if (check.clippedText.length) failures.push(`${label}: clipped text at ${check.clippedText.map((item) => item.selector).join(", ")}.`);
  if (check.duplicateIds.length) failures.push(`${label}: duplicate IDs: ${check.duplicateIds.join(", ")}.`);
  if (check.parentCollisions.length) failures.push(`${label}: content escapes its parent: ${check.parentCollisions.map((item) => `${item.selector} in ${item.parent}`).join(", ")}.`);
  if (check.siblingCollisions.length) failures.push(`${label}: in-flow content overlaps: ${check.siblingCollisions.map((item) => `${item.first} / ${item.second}`).join(", ")}.`);
}

async function checkTextEnlargement(browser, browserName, origin, failures, records) {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    try {
      for (const route of primaryRoutes) {
        const page = await context.newPage();
        const response = await page.goto(routeUrl(origin, route.path), { waitUntil: "domcontentloaded" });
        const label = `${browserName} text-200-percent ${route.slug} ${width}`;
        if (!response?.ok()) failures.push(`${label}: route did not load.`);
        await preparePage(page, "light");
        await page.evaluate(enlargeText);
        const check = await inspectLayout(page);
        addLayoutFailures(failures, label, check);
        records.push({ browser: browserName, route: route.slug, viewport: { width, height: 900 }, mode: "text-200-percent", theme: "light", check });
        await page.close();
      }
    } finally {
      await context.close();
    }
  }
}

async function checkKeyboard(browser, browserName, origin, failures) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(routeUrl(origin, "/"), { waitUntil: "domcontentloaded" });
  await preparePage(page, "light");
  await page.keyboard.press(tabKey(browserName));
  const skipCheck = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return { focused: false, visible: false, outline: 0 };
    const rect = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    return {
      focused: active.classList.contains("skip-link"),
      visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
      outline: Number.parseFloat(style.outlineWidth) || 0
    };
  });
  if (!skipCheck.focused || !skipCheck.visible || skipCheck.outline < 2) {
    failures.push(`${browserName}: skip link is not the first visible keyboard focus target.`);
  }

  const toggle = page.locator(".nav-toggle");
  const nav = page.locator(".site-nav");
  const links = nav.locator("a");
  const isFocused = (locator) => locator.evaluate((node) => node === document.activeElement);
  const toggleBox = await toggle.boundingBox();
  if (!toggleBox || toggleBox.width < 44 || toggleBox.height < 44) {
    failures.push(`${browserName}: mobile menu control is smaller than 44 by 44 CSS pixels.`);
  }
  await page.keyboard.press(tabKey(browserName));
  if (!await isFocused(page.locator(".brand"))) {
    failures.push(`${browserName}: the brand link should follow the skip link in keyboard order.`);
  }
  await page.keyboard.press(tabKey(browserName));
  if (!await isFocused(toggle)) {
    failures.push(`${browserName}: the mobile menu toggle is not before the navigation links in keyboard order.`);
  }
  await page.keyboard.press("Enter");
  if (await toggle.getAttribute("aria-expanded") !== "true" || !await nav.isVisible()) {
    failures.push(`${browserName}: mobile navigation did not open with Enter.`);
  }
  for (let index = 0; index < await links.count(); index += 1) {
    await page.keyboard.press(tabKey(browserName));
    if (!await isFocused(links.nth(index))) {
      failures.push(`${browserName}: Tab did not reach navigation link ${index + 1} in order.`);
    }
  }
  await page.keyboard.press("Escape");
  if (await nav.isVisible() || await toggle.getAttribute("aria-expanded") !== "false" || !await isFocused(toggle)) {
    failures.push(`${browserName}: Escape did not close the menu and return focus to its toggle.`);
  }
  await page.keyboard.press(tabKey(browserName));
  if (await nav.evaluate((node) => node.contains(document.activeElement))) {
    failures.push(`${browserName}: collapsed navigation links remain in the keyboard tab order.`);
  }

  await toggle.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index <= await links.count(); index += 1) {
    await page.keyboard.press(tabKey(browserName));
  }
  const outsideMenu = await page.evaluate(() => !document.querySelector(".site-nav")?.contains(document.activeElement) && !document.activeElement?.matches(".nav-toggle"));
  const previousFocus = await page.evaluateHandle(() => document.activeElement);
  await page.keyboard.press("Escape");
  const focusUnchanged = await page.evaluate((previous) => previous === document.activeElement, previousFocus);
  await previousFocus.dispose();
  if (!outsideMenu || !focusUnchanged || await nav.isVisible()) {
    failures.push(`${browserName}: Escape outside the open menu steals focus or leaves the menu open.`);
  }

  await page.setViewportSize({ width: 1040, height: 844 });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press(tabKey(browserName));
  await page.setViewportSize({ width: 1041, height: 844 });
  await page.waitForFunction(() => document.querySelector(".nav-toggle")?.getAttribute("aria-expanded") === "false", null, { timeout: 2000 })
    .catch(() => failures.push(`${browserName}: navigation state did not reset at the desktop breakpoint.`));
  if (await toggle.isVisible() || !await nav.isVisible() || !await isFocused(links.first())) {
    failures.push(`${browserName}: navigation does not transition cleanly to desktop at 1041px.`);
  }
  await page.setViewportSize({ width: 1040, height: 844 });
  await page.waitForFunction(() => document.activeElement?.matches(".nav-toggle"), null, { timeout: 2000 })
    .catch(() => failures.push(`${browserName}: focus did not return to the mobile menu toggle after resizing.`));
  if (!await toggle.isVisible() || await nav.isVisible() || !await isFocused(toggle)) {
    failures.push(`${browserName}: resizing to 1040px leaves focus in hidden navigation.`);
  }
  await page.setViewportSize({ width: 1200, height: 844 });
  await page.waitForFunction(() => document.activeElement?.matches(".site-nav a"), null, { timeout: 2000 })
    .catch(() => failures.push(`${browserName}: focus did not move off the hidden menu toggle after resizing.`));
  if (!await isFocused(links.first())) {
    failures.push(`${browserName}: resizing to desktop leaves focus on the hidden menu toggle.`);
  }
  await links.first().evaluate((node) => node.blur());
  await page.setViewportSize({ width: 1040, height: 844 });
  await page.waitForTimeout(100);
  if (await isFocused(toggle)) {
    failures.push(`${browserName}: resizing steals focus after the visitor leaves navigation.`);
  }
  await context.close();
}

async function checkHeroFraming(browser, browserName, origin, failures) {
  for (const theme of themes) {
    for (const width of [390, 820, 1440, 2300, 2560]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        await page.goto(routeUrl(origin, "/"), { waitUntil: "domcontentloaded" });
        await preparePage(page, theme);
        const framing = await page.locator(".dossier-hero__media").evaluate((image) => {
          const box = image.getBoundingClientRect();
          const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
          return {
            loaded: image.complete && image.naturalWidth > 0,
            renderedWidth: image.naturalWidth * scale,
            visibleHeightFraction: box.height / (image.naturalHeight * scale),
            documentWidth: document.documentElement.scrollWidth
          };
        });
        const label = `${browserName} hero framing ${width} ${theme}`;
        if (!framing.loaded) failures.push(`${label}: campus photograph did not load.`);
        // The 4:3 source must not expand indefinitely across a shallow, wide banner.
        if (width >= 1440 && (framing.renderedWidth > 1442 || framing.visibleHeightFraction < 0.58)) {
          failures.push(`${label}: wide-window framing over-enlarges or over-crops the campus photograph.`);
        }
        if (width <= 600 && (framing.renderedWidth > 642 || framing.visibleHeightFraction < 0.98)) {
          failures.push(`${label}: phone framing stretches the photograph across the tall text area.`);
        }
        if (framing.documentWidth > width + 1) failures.push(`${label}: photograph causes horizontal overflow.`);
        if (browserName === "chromium" && width >= 2300) {
          const directory = path.join(outputRoot, "hero-framing");
          await fs.mkdir(directory, { recursive: true });
          await page.screenshot({ path: path.join(directory, `${width}-${theme}.png`) });
        }
      } finally {
        await context.close();
      }
    }
  }
}

async function checkPhotoCredit(browser, browserName, origin, failures) {
  const cases = themes.flatMap((theme) => [390, 820, 1440].map((width) => ({ width, theme, javaScriptEnabled: true })));
  cases.push({ width: 390, theme: "light", javaScriptEnabled: false });
  for (const { width, theme, javaScriptEnabled } of cases) {
    const context = await browser.newContext({
      viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce",
      javaScriptEnabled, hasTouch: width < 1000
    });
    try {
      const page = await context.newPage();
      await page.goto(routeUrl(origin, "/"), { waitUntil: "domcontentloaded" });
      if (javaScriptEnabled) await preparePage(page, theme);
      else await waitForLocalImages(page, 2500);
      const label = `${browserName} photo-credit ${width} ${theme} ${javaScriptEnabled ? "js" : "no-js"}`;
      const disclosure = page.locator("details.dossier-hero__source");
      const summary = disclosure.locator("summary");
      const panel = disclosure.locator(".dossier-hero__credit");
      const links = panel.locator("a");
      if (await panel.isVisible()) failures.push(`${label}: attribution should start collapsed.`);
      await summary.scrollIntoViewIfNeeded();
      const heroHeight = (await page.locator(".home-hero").boundingBox()).height;
      const controlBox = await summary.boundingBox();
      if (controlBox.width < 44 || controlBox.height < 44) failures.push(`${label}: credit control is too small for touch.`);
      if (width < 1000) await summary.tap();
      else await summary.click();
      if (!await panel.isVisible() || await links.count() !== 2) failures.push(`${label}: photo source and license must be available on activation.`);
      const box = await panel.boundingBox();
      if (!box || box.x < 0 || box.y < 0 || box.x + box.width > width + 1 || box.y + box.height > 901) {
        failures.push(`${label}: open attribution leaves the viewport.`);
      }
      if (Math.abs((await page.locator(".home-hero").boundingBox()).height - heroHeight) > 1) {
        failures.push(`${label}: opening attribution shifts the hero layout.`);
      }
      await summary.focus();
      for (let index = 0; index < await links.count(); index += 1) {
        await page.keyboard.press(tabKey(browserName));
        if (!await links.nth(index).evaluate((node) => node === document.activeElement)) {
          failures.push(`${label}: attribution link ${index + 1} is not keyboard reachable.`);
        }
      }
      if (browserName === "chromium") {
        const directory = path.join(outputRoot, "photo-credit");
        await fs.mkdir(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, `${width}-${theme}-${javaScriptEnabled ? "js" : "no-js"}.png`) });
      }
      await summary.focus();
      await page.keyboard.press("Enter");
      if (await panel.isVisible()) failures.push(`${label}: Enter did not collapse attribution.`);
      await page.keyboard.press("Space");
      if (!await panel.isVisible()) failures.push(`${label}: Space did not reopen attribution.`);
    } finally {
      await context.close();
    }
  }
}

async function checkMapFallback(browser, browserName, origin, failures) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(routeUrl(origin, "/contact/"), { waitUntil: "domcontentloaded" });
  await preparePage(page, "light");
  const widget = page.locator("[data-map-widget]");
  const toggle = widget.locator(".map-widget__toggle");
  const directions = widget.locator('a[href*="google.com/maps"]');
  const source = await toggle.getAttribute("data-map-src");
  if (!source) throw new Error(`${browserName}: map source is missing.`);
  let blockedRequests = 0;
  await context.route((url) => url.href === source, async (route) => {
    blockedRequests += 1;
    await route.abort("failed");
  });

  if (await widget.locator("iframe").count() || !await directions.isVisible()) {
    failures.push(`${browserName}: map loads before consent or its directions fallback is not visible.`);
  }
  await toggle.focus();
  const failedRequest = page.waitForEvent("requestfailed", { predicate: (request) => request.url() === source, timeout: 5000 }).catch(() => null);
  await page.keyboard.press("Enter");
  if (!await failedRequest) failures.push(`${browserName}: the map failure scenario did not receive the expected blocked request.`);
  const frame = widget.locator("iframe");
  const frameState = await frame.evaluate((node) => ({
    opacity: getComputedStyle(node).opacity,
    hidden: node.hidden || Boolean(node.closest("[hidden]")),
    title: node.title,
    loadHandler: node.getAttribute("onload")
  }));
  if (blockedRequests !== 1 || !await frame.isVisible() || frameState.opacity !== "1" || frameState.hidden || !frameState.title || frameState.loadHandler) {
    failures.push(`${browserName}: blocked map leaves an invisible frame or reports a successful load.`);
  }
  if (!await directions.isVisible() || await toggle.getAttribute("aria-expanded") !== "true") {
    failures.push(`${browserName}: map controls or external directions become unavailable after a blocked load.`);
  }
  await toggle.focus();
  await page.keyboard.press("Enter");
  if (await widget.locator("iframe").count() || await toggle.getAttribute("aria-expanded") !== "false") {
    failures.push(`${browserName}: hiding the map leaves its iframe active.`);
  }
  await page.keyboard.press(tabKey(browserName));
  if (!await directions.evaluate((node) => node === document.activeElement)) {
    failures.push(`${browserName}: external directions are not reachable after the map control by keyboard.`);
  }
  await context.close();

  const noJsContext = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(routeUrl(origin, "/contact/"), { waitUntil: "domcontentloaded" });
  const noJsWidget = noJsPage.locator("[data-map-widget]");
  if (await noJsWidget.locator("iframe").count() || await noJsWidget.locator(".map-widget__toggle").isVisible() || !await noJsWidget.locator('a[href*="google.com/maps"]').isVisible()) {
    failures.push(`${browserName}: the no-JavaScript map fallback is not usable without inactive controls.`);
  }
  if (await noJsPage.locator(".nav-toggle").isVisible() || !await noJsPage.locator(".site-nav").isVisible()) {
    failures.push(`${browserName}: navigation is not visible when JavaScript is disabled.`);
  }
  const noJsLinks = noJsPage.locator(".site-nav a");
  await noJsPage.keyboard.press(tabKey(browserName));
  await noJsPage.keyboard.press(tabKey(browserName));
  for (let index = 0; index < await noJsLinks.count(); index += 1) {
    await noJsPage.keyboard.press(tabKey(browserName));
    if (!await noJsLinks.nth(index).evaluate((node) => node === document.activeElement)) {
      failures.push(`${browserName}: no-JavaScript navigation link ${index + 1} is not reachable in keyboard order.`);
    }
  }
  const noJsDirections = noJsWidget.locator('a[href*="google.com/maps"]');
  let directionsReached = false;
  for (let index = 0; index < 40; index += 1) {
    await noJsPage.keyboard.press(tabKey(browserName));
    if (await noJsDirections.evaluate((node) => node === document.activeElement)) {
      directionsReached = true;
      break;
    }
  }
  if (!directionsReached) failures.push(`${browserName}: no-JavaScript directions are not reachable by Tab.`);
  await noJsContext.close();
}

async function checkTextSpacing(browser, origin, failures) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const route of primaryRoutes) {
    const page = await context.newPage();
    const response = await page.goto(routeUrl(origin, route.path), { waitUntil: "domcontentloaded" });
    if (!response?.ok()) {
      failures.push(`text-spacing ${route.slug}: route did not load.`);
      await page.close();
      continue;
    }
    await preparePage(page, "light");
    await page.addStyleTag({
      content: `
        :where(p, li, dt, dd, address, a, button, h1, h2, h3, h4, span, strong, small, time) {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p { margin-block-end: 2em !important; }
      `
    });
    const check = await inspectLayout(page);
    addLayoutFailures(failures, `text-spacing ${route.slug}`, check);
    await page.close();
  }
  await context.close();
}

async function runCompatibility(browser, browserName, origin, failures, records) {
  const viewports = browserName === "chromium"
    ? [...compatibilityViewports, ...stressViewports]
    : compatibilityViewports;

  for (const viewport of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
        reducedMotion: "reduce"
      });

      for (const route of primaryRoutes) {
        const page = await context.newPage();
        const label = `${browserName} ${route.slug} ${viewport.name} ${theme}`;
        const runtimeErrors = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        page.on("console", (message) => {
          if (message.type() !== "error") return;
          const source = message.location().url || "";
          if (!source || source.startsWith(origin)) runtimeErrors.push(message.text());
        });
        const response = await page.goto(routeUrl(origin, route.path), { waitUntil: "domcontentloaded" });
        if (!response?.ok()) failures.push(`${label}: route returned ${response?.status() ?? "no response"}.`);
        await preparePage(page, theme);
        const check = await inspectLayout(page);
        addLayoutFailures(failures, label, check);
        if (runtimeErrors.length) failures.push(`${label}: runtime errors: ${runtimeErrors.join(" | ")}.`);
        records.push({ browser: browserName, route: route.slug, viewport, theme, check, runtimeErrors });
        await page.close();
      }

      await context.close();
    }
  }
}

async function runAxe(browser, AxeBuilder, origin, failures, axeResults) {
  for (const viewport of accessibilityViewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
        reducedMotion: "reduce"
      });

      for (const route of primaryRoutes) {
        const page = await context.newPage();
        const response = await page.goto(routeUrl(origin, route.path), { waitUntil: "domcontentloaded" });
        if (!response?.ok()) {
          failures.push(`axe ${route.slug} ${viewport.name} ${theme}: route did not load.`);
          await page.close();
          continue;
        }
        await preparePage(page, theme);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const compactViolations = results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
        }));
        axeResults.push({ route: route.slug, viewport, theme, violations: compactViolations });
        for (const violation of compactViolations) {
          failures.push(
            `axe ${route.slug} ${viewport.name} ${theme}: ${violation.id} (${violation.impact || "unrated"}) at ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}.`
          );
        }
        await page.close();
      }

      await context.close();
    }
  }
}

async function checkLegacyRoutes(origin, failures) {
  for (const route of legacyRoutes) {
    const response = await fetch(routeUrl(origin, route.path));
    const html = await response.text();
    const targetWithBase = `${basePath}${route.target}`;
    if (!response.ok) failures.push(`${route.slug}: legacy route returned ${response.status}.`);
    if (!html.includes('name="robots" content="noindex,follow"')) failures.push(`${route.slug}: legacy route is not marked noindex.`);
    if (!html.includes('http-equiv="refresh"') || !html.includes(`url=${targetWithBase}`)) {
      failures.push(`${route.slug}: legacy route does not refresh to ${targetWithBase}.`);
    }
    if (!html.includes(`href="${targetWithBase}"`)) failures.push(`${route.slug}: visible destination link is missing.`);
  }
}

async function writeReports({ failures, records, axeResults }) {
  await fs.mkdir(outputRoot, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    standard: "WCAG 2.1 Level AA automated subset",
    browsers: selectedBrowsers,
    keyboardTabKeys: Object.fromEntries(selectedBrowsers.map((name) => [name, tabKey(name)])),
    compatibilityViewports,
    stressViewports,
    primaryRoutes,
    legacyRoutes,
    failures,
    compatibilityChecks: records,
    accessibilityChecks: axeResults
  };
  await fs.writeFile(path.join(outputRoot, "quality-report.json"), JSON.stringify(report, null, 2), "utf8");

  const axeViolationCount = axeResults.reduce((sum, result) => sum + result.violations.length, 0);
  const summary = [
    "# Abraham Lab Site Quality Review",
    "",
    `- Browser engines: ${selectedBrowsers.join(", ")}`,
    `- Keyboard navigation: ${selectedBrowsers.map((name) => `${name}: ${tabKey(name)}`).join(", ")}`,
    `- Compatibility page checks: ${records.length}`,
    `- Automated WCAG 2.1 AA scans: ${axeResults.length}`,
    `- Axe violations: ${axeViolationCount}`,
    `- Total failures: ${failures.length}`,
    "",
    "Text enlargement uses doubled computed font sizes; the 320px reflow case models 1280px at 400% zoom. Native browser zoom and device checks remain manual.",
    "",
    failures.length ? "## Failures" : "All automated release checks passed.",
    "",
    ...failures.map((failure) => `- ${failure}`)
  ].join("\n");
  await fs.writeFile(path.join(outputRoot, "summary.md"), summary, "utf8");
}

async function run() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  const server = await staticSite.start(port);
  const failures = [];
  const records = [];
  const axeResults = [];

  try {
    const [{ default: AxeBuilder }, playwright] = await Promise.all([
      import("@axe-core/playwright"),
      import("playwright")
    ]);
    const browserCatalog = {
      chromium: playwright.chromium,
      firefox: playwright.firefox,
      webkit: playwright.webkit
    };
    await checkLegacyRoutes(server.origin, failures);

    for (const browserName of selectedBrowsers) {
      const browserType = browserCatalog[browserName];
      let browser;
      try {
        browser = await browserType.launch({ headless: true });
      } catch (error) {
        throw new Error(`Unable to launch ${browserName}. Install the repo-controlled Playwright browsers with npm run quality:setup.\n${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        await checkKeyboard(browser, browserName, server.origin, failures);
        await checkHeroFraming(browser, browserName, server.origin, failures);
        await checkPhotoCredit(browser, browserName, server.origin, failures);
        await checkMapFallback(browser, browserName, server.origin, failures);
        await runCompatibility(browser, browserName, server.origin, failures, records);
        await checkTextEnlargement(browser, browserName, server.origin, failures, records);
        if (browserName === "chromium") {
          await checkTextSpacing(browser, server.origin, failures);
          await runAxe(browser, AxeBuilder, server.origin, failures, axeResults);
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }

  await writeReports({ failures, records, axeResults });
  if (failures.length) {
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(`::error title=Site quality review failed::${annotation(failures.join("\n"))}`);
    }
    throw new Error(`Site quality review failed with ${failures.length} issue(s). See output/quality-review/summary.md.`);
  }

  console.log(`Site quality review passed: ${records.length} compatibility checks and ${axeResults.length} WCAG scans.`);
}

async function runSelfTest() {
  if (primaryRoutes.length !== 7) throw new Error("Expected seven primary routes.");
  if (legacyRoutes.length !== 3) throw new Error("Expected three legacy routes.");
  if (!compatibilityViewports.some((viewport) => viewport.width === 390)) throw new Error("Phone viewport is missing.");
  if (!stressViewports.some((viewport) => viewport.width === 320)) throw new Error("320px reflow viewport is missing.");
  for (const requestPath of ["/..%5c..%5cpackage-lock.json", "/..%2f..%2fpackage-lock.json"]) {
    let rejected = false;
    try {
      staticSite.safeStaticRequestPath(requestPath);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Expected traversal path to be rejected: ${requestPath}`);
  }
  const header = await fs.readFile(path.join(repoRoot, "src", "components", "Header.astro"), "utf8");
  const togglePosition = header.indexOf('<button class="nav-toggle"');
  const navPosition = header.indexOf('<nav id="site-nav"');
  if (togglePosition < 0 || navPosition < 0 || togglePosition > navPosition) {
    throw new Error("The navigation toggle must precede the links in DOM order.");
  }
  const layout = await fs.readFile(path.join(repoRoot, "src", "layouts", "BaseLayout.astro"), "utf8");
  if (!layout.includes('matchMedia("(max-width: 1040px)")')) {
    throw new Error("Navigation script must use the 1040px CSS breakpoint.");
  }
  const map = await fs.readFile(path.join(repoRoot, "src", "components", "MapWidget.astro"), "utf8");
  if (/<iframe\b|\bonload\s*=|map-widget__(?:fallback|grid|pin)/i.test(map)) {
    throw new Error("The map must not ship an eager iframe, decorative map fallback, or load-success handler.");
  }
  if (!map.includes('class="map-widget__media" hidden') || !map.includes('data-map-src={siteData.contact.mapEmbedUrl} hidden') || !map.includes('href={siteData.contact.mapUrl}')) {
    throw new Error("The map must provide external directions with inactive controls hidden until enhancement.");
  }
  console.log("quality-review configuration and navigation/map source self-tests passed");
}

const entrypoint = process.env.QUALITY_REVIEW_SELF_TEST === "1" ? runSelfTest : run;
entrypoint().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
