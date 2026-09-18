import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publications } from '../src/data/publications.ts';
import { createStaticSiteTools, normalizeBasePath } from './lib/static-site-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const figures = JSON.parse(await fs.readFile(path.join(root, 'src/data/publication-figures.json'), 'utf8'));
const output = path.join(root, 'output/playwright/publication-figures');
await fs.mkdir(output, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.cache/ms-playwright');
const { chromium, firefox, webkit } = await import('playwright');
const { default: AxeBuilder } = await import('@axe-core/playwright');
const basePath = normalizeBasePath(process.env.SITE_BASE_PATH);
const server = await createStaticSiteTools({ siteRoot: path.join(root, '_site'), basePath }).start(Number(process.env.FIGURE_REVIEW_PORT || 4175));
const url = server.origin + basePath + '/publications/';
const checks = [];
const save = () => fs.writeFile(path.join(output, 'review.json'), JSON.stringify({
  design: 'visible thumbnails', figures: figures.length, papers: publications.length, checks
}, null, 2) + '\n');

async function waitForImage(image) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await image.evaluate(image => image.complete && image.naturalWidth > 0)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Image did not load: ${await image.getAttribute('src')}`);
}

async function assertLayout(page, label) {
  const result = await page.evaluate(() => ({
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    thumbnails: [...document.querySelectorAll('.publication-figure__thumbnail')].map(link => {
      const image = link.querySelector('img');
      const matte = link.querySelector('.publication-figure__matte');
      const label = link.querySelector('.publication-figure__label').getBoundingClientRect();
      const rect = image.getBoundingClientRect();
      const frame = matte.getBoundingClientRect();
      const fitScale = Math.min(rect.width / Number(image.getAttribute('width')), rect.height / Number(image.getAttribute('height')));
      return {
        visible: image.getClientRects().length > 0 && getComputedStyle(image).visibility === 'visible',
        loaded: image.complete && image.naturalWidth > 0,
        fit: getComputedStyle(image).objectFit,
        filter: getComputedStyle(image).filter,
        background: getComputedStyle(link).backgroundColor,
        unclipped: rect.left >= frame.left && rect.right <= frame.right && rect.top >= frame.top && rect.bottom <= frame.bottom,
        labelOutsideImage: label.top >= rect.bottom,
        fitScale
      };
    })
  }));
  assert(result.overflow <= 1, `${label}: horizontal overflow`);
  assert.equal(result.thumbnails.length, figures.length);
  for (const image of result.thumbnails) {
    assert(image.visible && image.loaded && image.unclipped && image.labelOutsideImage, `${label}: hidden, incomplete, clipped, or overlaid image`);
    assert.equal(image.fit, 'contain');
    assert.equal(image.filter, 'none');
    assert.equal(image.background, 'rgb(255, 255, 255)');
    assert(image.fitScale <= 1);
  }
}

try {
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true, timeout: 30000 });
  try {
    const widths = name === 'chromium' ? [390, 430, 768, 820, 1024, 1280, 1440] : [390, 820, 1440];
    for (const width of widths) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(url, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.publication-row').count(), publications.length);
      assert.equal(await page.locator('.figure-viewer[open]').count(), 0);
      assert.equal(await page.getByText('View figure', { exact: true }).count(), 0);
      for (const image of await page.locator('.publication-figure__thumbnail img').all()) {
        await image.scrollIntoViewIfNeeded();
        await waitForImage(image);
      }
      await assertLayout(page, `${name} ${width} ${theme}`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}-page.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}-top.png`) });

      if ([390, 820, 1440].includes(width)) {
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))));
      }

      for (const figure of figures) {
        const link = page.locator(`[data-figure-key="${figure.key}"] .publication-figure__thumbnail`);
        const viewer = page.locator(`#figure-viewer-${figure.key}`);
        await link.focus();
        await page.keyboard.press('Enter');
        await viewer.waitFor({ state: 'visible' });
        assert.equal(await viewer.getAttribute('open'), '');
        const image = viewer.locator('img');
        await image.scrollIntoViewIfNeeded();
        await waitForImage(image);
        const fit = await image.evaluate(image => {
          const rect = image.getBoundingClientRect();
          return { ratio: rect.width / rect.height, expected: Number(image.getAttribute('width')) / Number(image.getAttribute('height')), loaded: image.complete && image.naturalWidth > 0, width: rect.width, nativeWidth: Number(image.getAttribute('width')) };
        });
        assert(fit.loaded && Math.abs(fit.ratio - fit.expected) < 0.006 && fit.width <= fit.nativeWidth + 1);
        for (let step = 0; step < 6; step++) {
          await page.keyboard.press('Tab');
          assert(await viewer.evaluate(dialog => dialog.contains(document.activeElement)), 'Focus must stay inside the image viewer');
        }
        if (['mpox_replisome', 'arena_spike'].includes(figure.key)) {
          await viewer.evaluate(dialog => dialog.scrollTop = 0);
          await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}-${figure.key}-viewer.png`) });
        }
        if (figure.key === 'mpox_replisome' && [390, 820, 1440].includes(width)) {
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))));
        }
        await page.keyboard.press('Escape');
        await viewer.waitFor({ state: 'hidden' });
        assert.equal(await viewer.getAttribute('open'), null);
        await page.waitForFunction(key => document.activeElement === document.querySelector(`[data-figure-key="${key}"] .publication-figure__thumbnail`), figure.key);
        assert(await link.evaluate(link => document.activeElement === link), 'Closing must return focus to the thumbnail');
      }
      const first = page.locator('.publication-figure__thumbnail').first();
      await first.click();
      await page.locator('.figure-viewer[open]').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Close figure', exact: true }).click();
      await page.locator('.figure-viewer[open]').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.figure-viewer[open]').count(), 0);
      assert(await first.evaluate(link => document.activeElement === link));

      await first.click();
      const openViewer = page.locator('.figure-viewer[open]');
      await openViewer.waitFor({ state: 'visible' });
      await openViewer.locator('img').click();
      assert.equal(await openViewer.count(), 1, 'Clicking the image must not close it');
      await openViewer.click({ position: { x: 4, y: 4 } });
      assert.equal(await openViewer.count(), 1, 'Clicking dialog padding must not close it');
      const bounds = await openViewer.boundingBox();
      const inside = { x: bounds.x + 6, y: bounds.y + 6 };
      const outside = { x: 2, y: 2 };
      for (const [from, to] of [[inside, outside], [outside, inside]]) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y);
        await page.mouse.up();
        assert.equal(await openViewer.count(), 1, 'Dragging across the frame must not close it');
      }
      await page.mouse.click(outside.x, outside.y);
      await openViewer.waitFor({ state: 'hidden' });
      assert(await first.evaluate(link => document.activeElement === link), 'Backdrop dismissal returns focus');
      await page.locator('.publication-figure__credit summary').first().click();
      assert.equal(await page.locator('.publication-figure__credit[open]').count(), 1);
      assert.equal(errors.length, 0, errors.join('\n'));
      checks.push({ browser: name, width, theme, figuresVisible: figures.length, viewersChecked: figures.length, focusReturn: true, backdropDismissal: true, dragSafe: true, passed: true });
      await save();
      console.log(`${name} ${width} ${theme}: thumbnails, viewer, keyboard, and layout passed`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const first = page.locator('.publication-figure__thumbnail').first();
    assert(await first.isVisible());
    await first.focus();
    const popupEvent = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup = await popupEvent;
    await popup.waitForLoadState('load');
    assert(popup.url().endsWith(figures[0].image));
    assert.equal((await page.request.get(popup.url())).status(), 200);
    await popup.close();
    const credit = page.locator('.publication-figure__credit').first();
    await credit.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await credit.getAttribute('open'), '');
    checks.push({ browser: name, width: 390, noJavaScript: true, thumbnailAndCreditAccessible: true, imageFallback: true, passed: true });
    await save();
    await context.close();

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    try {
      const page = await touchContext.newPage();
      await page.goto(url, { waitUntil: 'load' });
      const first = page.locator('.publication-figure__thumbnail').first();
      await first.tap();
      const viewer = page.locator('.figure-viewer[open]');
      await viewer.waitFor({ state: 'visible' });
      await viewer.locator('img').tap();
      assert.equal(await viewer.count(), 1);
      await page.touchscreen.tap(2, 2);
      await viewer.waitFor({ state: 'hidden' });
      assert(await first.evaluate(link => document.activeElement === link));
      checks.push({ browser: name, width: 390, touchBackdropDismissal: true, passed: true });
      await save();
    } finally { await touchContext.close(); }
  } finally { await browser.close(); }
}
console.log(`Passed ${checks.length} thumbnail-preview checks.`);

} finally { await server.close(); }
