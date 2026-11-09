import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { publicationAnchor } from "../src/lib/content.ts";
import { publications } from "../src/data/publications.ts";
import { siteData } from "../src/data/site.ts";
import { jonathanProfile } from "../src/data/jonathan.ts";

const source = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Jonathan's overview and focus area retain the requested plain wording", () => {
  assert.equal(jonathanProfile.overview, "Jonathan Abraham studies the molecular mechanisms of viral infection.");
  assert.equal(jonathanProfile.focusAreas[0], "Host receptor recognition");
});

test("citation anchors are unique and do not change with a title correction", () => {
  const anchors = publications.map(publicationAnchor);
  assert.equal(new Set(anchors).size, publications.length);
  for (const item of publications) {
    const anchor = publicationAnchor(item);
    assert.equal(publicationAnchor({ ...item, title: "Corrected title" }), anchor);
    assert.equal(decodeURIComponent(encodeURIComponent(anchor)), anchor);
  }
});

test("publication output labels name an accessible group", async () => {
  const page = await source("src/pages/publications/index.astro");
  assert.match(page, /class="publication-row__outputs" role="group" aria-label=/);
});

test("quality reports retain axe findings that need manual review", async () => {
  const review = await source("scripts/quality-review.mjs");
  assert.match(review, /results\.incomplete\.map/);
  assert.match(review, /violations: compactViolations, manualReview/);
  assert.match(review, /A clean automated scan does not establish WCAG conformance/);
});

test("hero uses the licensed leafy campus photograph without a paper-panel crop", async () => {
  const figure = siteData.heroFigures[0];
  assert.equal(figure.kind, "photograph");
  assert.equal(figure.imageCrop, undefined);
  assert.match(figure.title, /Gordon Hall/);
  assert.match(figure.image, /\/campus\//);
  assert.ok(figure.imageWidth >= 2000 && figure.imageHeight > 0);
  assert.equal(figure.license, "CC BY-SA 4.0");
  assert.equal(figure.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
  assert.equal(figure.figureCredit, "EgorovaSvetlana");
  assert.match(figure.visualSource, /File:Gordon_Hall_Harvard_Medical_School_Quadrangle\.jpg$/);
  assert.match(figure.note, /[Cc]rop/);
  const home = await source("src/pages/index.astro");
  assert.match(home, /href=\{heroFigure\.licenseUrl\}/);
  assert.match(home, /href=\{heroFigure\.visualSource\}/);
  assert.match(home, /sizes="\(max-width: 600px\) 40rem, \(max-width: 1440px\) 100vw, 90rem"/);
});

test("homepage has a single paper summary and keeps the map on Contact", async () => {
  const home = await source("src/pages/index.astro");
  assert.doesNotMatch(home, /publication-feature__facts|recentPaper\.citation|MapWidget/);
  assert.match(home, /recentPaper\.significanceLine \|\| recentPaper\.summary/);
  assert.match(await source("src/pages/contact/index.astro"), /MapWidget/);
});

test("default link preview uses the campus photo with its dimensions and credit", async () => {
  const image = siteData.shareImages.campus;
  const bytes = await readFile(new URL(`../public${image.image}`, import.meta.url));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, image.width);
  assert.equal(metadata.height, image.height);
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
  assert.ok(bytes.length < 500000, "Campus link preview should stay under 500 kB.");
  assert.match(image.alt, /Gordon Hall/);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  const license = await source(`public${image.image}.license.txt`);
  assert.match(license, /EgorovaSvetlana/);
  assert.match(license, /https:\/\/creativecommons.org\/licenses\/by-sa\/4.0\//);
  assert.match(license, /cropped and resized/);
  assert.match(license, /File:Gordon_Hall_Harvard_Medical_School_Quadrangle\.jpg/);

  const layout = await source("src/layouts/BaseLayout.astro");
  assert.match(layout, /socialImagePath \?\? siteData\.shareImages\.campus\.image/);
  assert.doesNotMatch(layout, /siteData\.shareImages\.science/);
  for (const file of ["src/pages/index.astro", "src/pages/team/index.astro", "src/pages/contact/index.astro"]) {
    assert.doesNotMatch(await source(file), /socialImage=/, `${file} should inherit the shared default.`);
  }
});

test("motion cannot make uninitialized content invisible", async () => {
  const css = await source("src/styles/global.css");
  const layout = await source("src/layouts/BaseLayout.astro");
  assert.doesNotMatch(css, /\.reveal(?:\s|\.)[^{}]*\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(layout.split("</head>")[0], /classList\.add\("js"\)/);
  assert.match(layout, /prefers-reduced-motion: reduce/);
  assert.match(css, /html:not\(\.js\) \.site-header\s*\{\s*position: static;/);
  assert.match(css, /padding-block: calc\(var\(--header-height\) \+ 2rem\) 7rem/);
});

test("browser reviews observe theme and navigation state without repairing the page", async () => {
  for (const script of ["scripts/quality-review.mjs", "scripts/visual-review.mjs"]) {
    const content = await source(script);
    assert.doesNotMatch(content, /dataset\.theme\s*=|style\.colorScheme\s*=/);
    assert.match(content, /waitForSystemTheme\(page, theme\)/);
  }
});

test("membership dates use month values without visible start and end labels", async () => {
  const dates = await source("src/components/MembershipDates.astro");
  assert.match(dates, /datetime=\{start\}/);
  assert.match(dates, /datetime=\{end\}/);
  assert.doesNotMatch(dates, /Started|Ended/);
  assert.match(dates, /End date not recorded/);
  assert.match(dates, /Start date not recorded/);
  assert.match(dates, /\.membership-dates__note[\s\S]*clip-path: inset\(50%\)/);
  const team = await source("src/pages/team/index.astro");
  assert.doesNotMatch(team, /<time>/);
  assert.match(team, /team-row__appointment/);
});

test("alumni entries show membership dates without next-position details", async () => {
  const team = await source("src/pages/team/index.astro");
  assert.doesNotMatch(team, /entry\.destination(?:Source)?/);
  assert.match(team, /<MembershipDates start=\{entry\.labStart\} end=\{entry\.labEnd\} summers=\{entry\.summers\} alumni/);
});
