import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { researchEntities, researchTopics } from "../src/data/research.ts";
import { publications } from "../src/data/publications.ts";
import { siteData } from "../src/data/site.ts";

const root = new URL("../", import.meta.url);

test("illustrations use consistent entity colors and labeled keys", () => {
  assert.deepEqual(researchEntities, {
    viralProtein: { label: "Viral surface protein", color: "#4b5156" },
    receptor: { label: "Cell receptor", color: "#168d9b" },
    antibody: { label: "Antibody", color: "#c49339" },
    polymerase: { label: "Polymerase", color: "#4e6faa" },
    template: { label: "Template strand", color: "#a8b0b7" },
    newStrand: { label: "New strand", color: "#6b884b" }
  });
  assert.equal(new Set(Object.values(researchEntities).map((entity) => entity.color)).size, 6);
  const expectedKeys = {
    "viral-entry": ["viralProtein", "receptor"],
    "antibody-neutralization": ["viralProtein", "antibody", "receptor"],
    "genome-replication": ["polymerase", "template", "newStrand"]
  };
  for (const topic of researchTopics) {
    assert.deepEqual(topic.imageEntities, expectedKeys[topic.id]);
    assert.match(topic.image, /-editorial-a2-1536\.webp$/);
  }
});

test("Research is discoverable and its evidence resolves to journal research articles", () => {
  assert.equal(siteData.nav.filter((item) => item.href === "/research/").length, 1);
  assert.equal(new Set(researchTopics.map((item) => item.id)).size, 3);
  for (const topic of researchTopics) {
    assert.ok(topic.papers.length >= 2);
    for (const reference of topic.papers) {
      const publication = publications.find((paper) => paper.doi === reference.doi);
      assert.ok(publication, reference.doi);
      assert.equal(publication.articleType, "Research article");
      assert.ok(publication.correspondingAuthor);
    }
  }
});

test("research graphics retain a full 3:2 composition and no embedded private metadata", async () => {
  for (const topic of researchTopics) {
    for (const [image, width] of [[topic.image, 1536], [topic.imageSmall, 960]]) {
      const metadata = await sharp(fileURLToPath(new URL(`public${image}`, root))).metadata();
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, width * 2 / 3);
      assert.equal(metadata.format, "webp");
      assert.ok(!metadata.exif && !metadata.xmp);
    }
  }
});

test("favicon fallbacks share the new monogram and expected dimensions", async () => {
  const mark = await readFile(new URL("public/assets/images/brands/abraham-lab-mark.svg", root), "utf8");
  for (const path of ["public/assets/images/brands/favicon.svg", "src/assets/images/brands/favicon.svg"]) {
    assert.equal(await readFile(new URL(path, root), "utf8"), mark);
  }
  for (const [name, width] of [["icon-32", 32], ["touch-180", 180]]) {
    const metadata = await sharp(fileURLToPath(new URL(`public/assets/images/brands/abraham-lab-${name}.png`, root))).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, width);
  }
});
