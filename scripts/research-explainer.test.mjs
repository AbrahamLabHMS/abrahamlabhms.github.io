import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { researchEntities, researchIntro, researchTopics } from "../src/data/research.ts";
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
    const revision = { "viral-entry": "a3", "antibody-neutralization": "a6", "genome-replication": "a2" }[topic.id];
    assert.ok(topic.image.endsWith(`-editorial-${revision}-1536.webp`));
  }
});

test("meeting revisions retain the agreed explanation and collaboration credit", () => {
  const entry = researchTopics.find(topic => topic.id === "viral-entry");
  const antibody = researchTopics.find(topic => topic.id === "antibody-neutralization");
  const replication = researchTopics.find(topic => topic.id === "genome-replication");
  assert.ok(researchIntro.paragraphs[0].startsWith("A virus must bind to a cell and then enter the cell to copy its genome."));
  assert.doesNotMatch(JSON.stringify(researchTopics), /The virus remains outside the cell/);
  assert.match(entry.imageAlt, /glycoprotein trimer/);
  assert.equal(entry.methods, "Genetic screens, cryo-electron microscopy, and biochemical, biophysical, and infectivity assays.");
  assert.match(antibody.paragraphs[1], /how changes in viral proteins can reduce the activity of antibodies\./);
  assert.match(antibody.imageAlt, /^One arm tip/);
  assert.match(antibody.imageAlt, /three-subunit viral protein/);
  assert.match(antibody.imageAlt, /Its stem points away/);
  assert.equal(antibody.caption, "An antibody binds a viral surface protein through the tip of one arm. This binding can interfere with viral entry.");
  assert.equal(antibody.methods, "Antibody isolation, binding and neutralization assays, and cryo-electron microscopy and X-ray crystallography.");
  assert.equal(replication.relevance, "Knowing how viral replication proteins work helps explain drug action and resistance for existing inhibitors and provides a basis for developing new antivirals.");
  assert.equal(replication.methods, "Cryo-electron microscopy, protein biochemistry, and single-molecule measurements (in collaboration).");
});

test("active illustration sources and derivatives are reproducible without replacing the archived sources", async () => {
  const records = JSON.parse(await readFile(new URL("references/source-assets/research/active-asset-manifest.json", root), "utf8"));
  assert.deepEqual(records.map(record => record.name), ["entry", "antibody", "replication"]);
  for (const record of records) {
    const source = await readFile(new URL(`references/source-assets/research/${record.source}`, root));
    assert.equal(createHash("sha256").update(source).digest("hex"), record.sha256);
    const revision = { entry: "a3", antibody: "a6", replication: "a2" }[record.name];
    for (const width of [960, 1536]) {
      const expected = await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 90, effort: 5 }).toBuffer();
      const actual = await readFile(new URL(`public/assets/images/research/${record.name}-editorial-${revision}-${width}.webp`, root));
      assert.deepEqual(actual, expected);
    }
    if (revision !== "a2") {
      const archived = await readFile(new URL(`references/source-assets/research/editorial-a2/${record.name}.png`, root));
      assert.notEqual(createHash("sha256").update(archived).digest("hex"), record.sha256);
    }
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
