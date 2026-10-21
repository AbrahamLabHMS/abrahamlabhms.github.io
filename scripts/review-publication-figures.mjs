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
const publicationGroups = [
  { id: 'preprints', label: 'Preprints', type: 'Preprint' },
  { id: 'published-papers', label: 'Peer-reviewed research articles', type: 'Research article' },
  { id: 'reviews', label: 'Reviews', type: 'Review' },
  { id: 'commentaries', label: 'Commentaries', type: 'Commentary' },
];
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
    textOnlyRows: [...document.querySelectorAll('.publication-row:not(.publication-row--with-figure)')].map(row => {
      const frame = row.getBoundingClientRect();
      const content = [...row.querySelectorAll('.publication-row__record, .publication-row__title, .publication-row__citation')];
      return {
        id: row.id,
        fullWidth: content.every(node => Math.abs(node.getBoundingClientRect().width - frame.width) <= 1),
        noFigure: !row.querySelector('.publication-figure'),
      };
    }),
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
  assert.equal(result.textOnlyRows.length, publications.length - figures.length);
  for (const row of result.textOnlyRows) {
    assert(row.noFigure && row.fullWidth, `${label}: text-only paper must use its full row width: ${row.id}`);
  }
  for (const image of result.thumbnails) {
    assert(image.visible && image.loaded && image.unclipped && image.labelOutsideImage, `${label}: hidden, incomplete, clipped, or overlaid image`);
    assert.equal(image.fit, 'contain');
    assert.equal(image.filter, 'none');
    assert.equal(image.background, 'rgb(255, 255, 255)');
    assert(image.fitScale <= 1);
  }
}

async function assertViewerLayout(viewer, width, label) {
  const layout = await viewer.evaluate(dialog => {
    const frame = dialog.getBoundingClientRect();
    const matte = dialog.querySelector('.figure-viewer__matte').getBoundingClientRect();
    const info = dialog.querySelector('.figure-viewer__info').getBoundingClientRect();
    return {
      overflow: dialog.scrollWidth - dialog.clientWidth,
      contained: info.left >= frame.left && info.right <= frame.right,
      beside: info.left >= matte.right - 1 && Math.abs(info.top - matte.top) < 1,
      below: info.top >= matte.bottom - 1,
    };
  });
  assert(layout.overflow <= 1 && layout.contained, `${label}: viewer content must stay within its frame`);
  assert(width > 1040 ? layout.beside : layout.below, `${label}: figure details must follow the responsive reading order`);
}

async function assertSectionNavigation(page) {
  const nav = page.getByRole('navigation', { name: 'Publication sections', exact: true });
  const jump = async (link) => {
    const href = await link.getAttribute('href');
    const id = decodeURIComponent(href.slice(1));
    await link.focus();
    await page.keyboard.press('Enter');
    // Poll from Node so this also works when in-page JavaScript is disabled.
    let lastScrollY;
    let settled = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      const position = await page.evaluate(({ href, id }) => {
        const target = document.getElementById(id);
        const header = document.querySelector('.site-header');
        if (!target || !header || location.hash !== href) return { positioned: false, scrollY };
        const top = target.getBoundingClientRect().top;
        const headerBounds = header.getBoundingClientRect();
        const atBottom = Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 2;
        return { scrollY, positioned: top >= Math.max(0, headerBounds.bottom) - 1
          && (top <= headerBounds.height + 80 || (atBottom && top < innerHeight)) };
      }, { href, id });
      settled = position.positioned && Math.abs(position.scrollY - lastScrollY) < 1 ? settled + 1 : 0;
      lastScrollY = position.scrollY;
      if (settled >= 2) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail(`Jump target did not settle below the header: ${href}`);
  };
  assert.deepEqual(await nav.getByRole('link').allTextContents(), publicationGroups.map(group => group.label));
  assert.deepEqual(await page.locator('.publication-record').evaluateAll(nodes => nodes.map(node => node.id)), publicationGroups.map(group => group.id));
  for (const group of publicationGroups) {
    await jump(nav.getByRole('link', { name: group.label, exact: true }));
    const rows = page.locator(`#${group.id} .publication-row:visible`);
    const expected = publications.filter(paper => paper.articleType === group.type);
    assert.deepEqual(new Set(await rows.evaluateAll(nodes => nodes.map(node => node.id))), new Set(expected.map(paper => `paper-${paper.doi.toLowerCase()}`)));
  }
  const bounds = await nav.getByRole('link').evaluateAll(links => links.map(link => {
    const rect = link.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, viewport: innerWidth };
  }));
  assert(bounds.every(rect => rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= rect.viewport), 'Section links must remain touch-sized and within the viewport');
  const years = page.getByRole('navigation', { name: 'Peer-reviewed research articles by year', exact: true }).getByRole('link');
  await jump(years.nth(1));
}

async function assertPublicationLinks(page) {
  assert.equal(await page.locator('.publication-filters').count(), 0, 'Section navigation replaces the filter toolbar');
  assert.equal(await page.locator('.publication-row:visible').count(), publications.length);
  for (const group of publicationGroups) {
    const row = page.locator(`#${group.id} .publication-row`).first();
    const link = row.locator('.publication-row__permalink');
    await link.focus();
    await page.keyboard.press('Enter');
    assert.equal(decodeURIComponent(new URL(page.url()).hash.slice(1)), await row.getAttribute('id'));
    assert(await row.isVisible(), 'Every saved citation remains visible in its new section');
  }
  await page.goto(`${url}#publications-2020`, { waitUntil: 'load' });
  const legacyYear = page.locator('#publications-2020');
  assert(await legacyYear.isVisible(), 'The former commentary-only year bookmark must still resolve');
  assert.equal(await legacyYear.locator('.publication-year__label').textContent(), '2020');
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

      await assertSectionNavigation(page);
      await assertPublicationLinks(page);
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
        await assertViewerLayout(viewer, width, `${name} ${width} ${theme} ${figure.key}`);
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
      await openViewer.evaluate(dialog => dialog.scrollTop = dialog.scrollHeight);
      await page.keyboard.press('Escape');
      await openViewer.waitFor({ state: 'hidden' });
      await first.click();
      await openViewer.waitFor({ state: 'visible' });
      assert.equal(await openViewer.evaluate(dialog => dialog.scrollTop), 0, 'Reopening a figure starts at its title');
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
      checks.push({ browser: name, width, theme, sectionNavigation: true, publicationOrder: true, citationLinks: true, legacyYearBookmark: true, figuresVisible: figures.length, viewersChecked: figures.length, responsiveViewer: true, scrollReset: true, focusReturn: true, backdropDismissal: true, dragSafe: true, passed: true });
      await save();
      console.log(`${name} ${width} ${theme}: thumbnails, viewer, keyboard, and layout passed`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await assertSectionNavigation(page);
    assert.equal(await page.locator('.publication-row:visible').count(), publications.length, 'All publications must remain accessible without JavaScript');
    assert.equal(await page.locator('.publication-filters').count(), 0, 'Native section links do not need filter controls');
    await assertPublicationLinks(page);
    const first = page.locator('.publication-figure__thumbnail').first();
    const fallbackUrl = new URL(await first.getAttribute('href'), url).href;
    assert(await first.isVisible());
    await first.focus();
    const popupEvent = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup = await popupEvent;
    await popup.waitForLoadState('load');
    assert.equal(popup.url(), fallbackUrl);
    assert.equal((await page.request.get(popup.url())).status(), 200);
    await popup.close();
    const credit = page.locator('.publication-figure__credit').first();
    await credit.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await credit.getAttribute('open'), '');
    checks.push({ browser: name, width: 390, noJavaScript: true, sectionNavigation: true, allPublicationsVisible: true, thumbnailAndCreditAccessible: true, imageFallback: true, passed: true });
    await save();
    await context.close();

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    try {
      const page = await touchContext.newPage();
      await page.goto(url, { waitUntil: 'load' });
      const nav = page.getByRole('navigation', { name: 'Publication sections', exact: true });
      await nav.getByRole('link', { name: 'Reviews', exact: true }).tap();
      assert.equal(new URL(page.url()).hash, '#reviews');
      await nav.getByRole('link', { name: 'Preprints', exact: true }).tap();
      assert.equal(new URL(page.url()).hash, '#preprints');
      const first = page.locator('.publication-figure__thumbnail').first();
      await first.tap();
      const viewer = page.locator('.figure-viewer[open]');
      await viewer.waitFor({ state: 'visible' });
      await viewer.locator('img').tap();
      assert.equal(await viewer.count(), 1);
      await page.touchscreen.tap(2, 2);
      await viewer.waitFor({ state: 'hidden' });
      assert(await first.evaluate(link => document.activeElement === link));
      checks.push({ browser: name, width: 390, touchSectionNavigation: true, touchBackdropDismissal: true, passed: true });
      await save();
    } finally { await touchContext.close(); }
  } finally { await browser.close(); }
}
console.log(`Passed ${checks.length} thumbnail-preview checks.`);

} finally { await server.close(); }
