import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { publicationAnchor } from "../src/lib/content.ts";
import { publications } from "../src/data/publications.ts";
import { siteData } from "../src/data/site.ts";

const source = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("citation anchors are unique and do not change with a title correction", () => {
  const anchors = publications.map(publicationAnchor);
  assert.equal(new Set(anchors).size, publications.length);
  for (const item of publications) {
    const anchor = publicationAnchor(item);
    assert.equal(publicationAnchor({ ...item, title: "Corrected title" }), anchor);
    assert.equal(decodeURIComponent(encodeURIComponent(anchor)), anchor);
  }
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
});

test("homepage has a single paper summary and keeps the map on Contact", async () => {
  const home = await source("src/pages/index.astro");
  assert.doesNotMatch(home, /publication-feature__facts|recentPaper\.citation|MapWidget/);
  assert.match(home, /recentPaper\.significanceLine \|\| recentPaper\.summary/);
  assert.match(await source("src/pages/contact/index.astro"), /MapWidget/);
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

test("membership dates use valid month values and keep single-date labels", async () => {
  const dates = await source("src/components/MembershipDates.astro");
  assert.match(dates, /datetime=\{start\}/);
  assert.match(dates, /datetime=\{end\}/);
  assert.match(dates, /Started <time/);
  assert.match(dates, /Ended <time/);
  const team = await source("src/pages/team/index.astro");
  assert.doesNotMatch(team, /<time>/);
  assert.match(team, /team-row__appointment/);
});
