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
    assert.ok(["verified", "user-confirmed"].includes(approval.identityStatus), figure.key);
    if (approval.identityStatus === "user-confirmed") {
      assert.equal(approval.userConfirmation.doi, figure.doi);
      assert.equal(approval.userConfirmation.figureNumber, figure.figureNumber);
      assert.equal(approval.userConfirmation.sourceFile, approval.sourceFile);
      assert.equal(approval.downloadsComparison.sha256, approval.sourceSha256);
      assert.equal(approval.publicComparison.status, "visual-content-corroborated-not-pixel-matched");
    }
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
      if (approval.resolution.nativeHeight) {
        assert.equal(variant.height, Math.round(variant.width * approval.resolution.nativeHeight / approval.resolution.nativeWidth));
      }
    }
  }
});

test("October 29 selections stay DOI-matched and preserve the unresolved source conflict", () => {
  const expected = {
    arena_neut_2015: ["10.1016/j.chom.2015.11.005", "Figure 2", 800, 669],
    sars2_immunocomp: ["10.1016/j.cell.2021.03.027", "Figure 3", 738, 490],
    arena_spike: ["10.1038/s41564-025-02085-6", "Figure 1", 2165, 1282],
    orthoflavi_ldlr: ["10.64898/2026.08.22.744730", "Figure 1", 1965, 1411],
    chikv_mosq: ["10.64898/2026.07.28.741352", "Figure 1", 1252, 960]
  };
  for (const [key, values] of Object.entries(expected)) {
    const figure = figures.find(item => item.key === key);
    assert.deepEqual([figure.doi, figure.figureNumber, figure.width, figure.height], values);
  }
  for (const key of ["orthoflavi_ldlr", "chikv_mosq"]) {
    assert.match(figures.find(item => item.key === key).attribution, /bioRxiv preprint.*version 1/);
  }
  const hold = evidence.holds.find(item => item.key === "lachesin");
  assert.equal(hold.identityStatus, "conflicting-evidence");
  assert.equal(hold.userConfirmation.doi, "10.64898/2026.07.28.741058");
  assert.ok(!figures.some(item => item.key === hold.key));
  const mann = publications.find(paper => paper.doi === expected.arena_spike[0]);
  const figure = figures.find(item => item.key === "arena_spike");
  assert.equal(mann.image, figure.image);
  assert.equal(mann.imageAlt, figure.alt);
  assert.equal(mann.figureNumber, figure.figureNumber);
  assert.equal(mann.visualSource, figure.sourceUrl);
});

test("the science social preview uses the complete replacement figure on a white matte", async () => {
  const preview = evidence.socialPreview;
  assert.equal(preview.key, "arena_spike");
  assert.equal(preview.fit, "contain");
  const bytes = await read(`public${preview.image}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), preview.sha256);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  const pixels = await sharp(bytes).removeAlpha().raw().toBuffer();
  for (const x of [0, 1199]) {
    const index = (315 * 1200 + x) * 3;
    assert.ok([...pixels.subarray(index, index + 3)].every(channel => channel >= 250));
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
