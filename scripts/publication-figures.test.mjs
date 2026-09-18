import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { publications } from "../src/data/publications.ts";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url));
const figures = JSON.parse(await read("src/data/publication-figures.json"));
const evidence = JSON.parse(await read("references/publication-figures.json"));

test("publication figures have unique paper matches and resolved reuse evidence", () => {
  assert.equal(new Set(figures.map((figure) => figure.key)).size, figures.length);
  assert.equal(new Set(figures.map((figure) => figure.doi)).size, figures.length);
  assert.deepEqual(figures.map((figure) => figure.key), evidence.figures.map((figure) => figure.key));
  for (const figure of figures) {
    const matches = publications.filter((paper) => paper.doi === figure.doi);
    assert.equal(matches.length, 1, figure.key);
    assert.equal(figure.publicationTitle, matches[0].title);
    const approval = evidence.figures.find((entry) => entry.key === figure.key);
    assert.equal(approval.identityStatus, "verified");
    assert.equal(approval.rightsStatus, "resolved");
    for (const field of ["doi", "figureNumber", "license", "licenseUrl"]) assert.equal(figure[field], approval[field]);
    for (const field of ["caption", "alt", "attribution"]) assert.ok(figure[field]?.trim());
    assert.ok(figure.attribution.includes(figure.doi) && figure.attribution.includes(figure.license));
    assert.ok(approval.licenseEvidence.length && approval.creditCheck && approval.restrictions);
    if (figure.license === "Cell Press author reuse") {
      assert.ok(matches[0].authors.includes("Abraham J"));
      assert.equal(figure.licenseUrl, "https://www.cell.com/cell/information-for-authors/journal-policies#permissions");
      assert.ok(approval.licenseEvidence.includes(figure.licenseUrl));
      assert.ok(approval.reuseBasis && /author/i.test(approval.restrictions));
      assert.doesNotMatch(figure.attribution, /CC BY|Creative Commons/);
    }
    for (const url of [figure.sourceUrl, figure.licenseUrl, approval.identityEvidence, ...approval.licenseEvidence]) {
      assert.equal(new URL(url).protocol, "https:");
    }
  }
});

test("web figures match the approved complete-image files and dimensions", async () => {
  for (const figure of figures) {
    assert.ok(figure.variants.some((variant) => variant.src === figure.image && variant.width === figure.width && variant.height === figure.height));
    const approval = evidence.figures.find((entry) => entry.key === figure.key);
    assert.deepEqual(figure.variants.map((variant) => variant.src), approval.variants.map((variant) => variant.src));
    for (const variant of figure.variants) {
      assert.match(variant.src, /^\/assets\/images\/publications\/[a-z0-9-]+\.webp$/);
      const expected = approval.variants.find((entry) => entry.src === variant.src);
      const bytes = await read(`public${variant.src}`);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, variant.src);
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, variant.width);
      assert.equal(metadata.height, variant.height);
      assert.equal(metadata.format, "webp");
      assert.ok(variant.width <= approval.resolution.nativeWidth);
    }
  }
});

test("figure thumbnails preserve the full image and work without JavaScript", async () => {
  const component = String(await read("src/components/PublicationFigure.astro"));
  assert.match(component, /object-fit: contain/);
  assert.doesNotMatch(component, /object-fit: cover|View figure/);
  assert.match(component, /href=\{withBase\(figure\.image\)\}/);
  assert.match(component, /<dialog[^>]+aria-labelledby=/);
  assert.match(component, /<form method="dialog">/);
  assert.match(component, /figure\.attribution/);
  assert.match(component, /href=\{figure\.sourceUrl\}/);
  assert.match(component, /href=\{figure\.licenseUrl\}/);
});
