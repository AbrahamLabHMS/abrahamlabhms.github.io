import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { researchTopics } from "../src/data/research.ts";
import { publications } from "../src/data/publications.ts";
import { siteData } from "../src/data/site.ts";

const root = new URL("../", import.meta.url);

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
