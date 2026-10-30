import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = "scripts/prepare-oct29-publication-figures.mjs";
const sourceDefault = path.resolve(root, "../Website Figure Review/2026-10-29/sources");
const keys = ["arena_neut_2015", "sars2_immunocomp", "arena_spike", "orthoflavi_ldlr", "chikv_mosq"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");

export function encodeFigure(source, width) {
  return sharp(source).resize({ width, withoutEnlargement: true })
    .webp({ lossless: true, effort: 6 }).toBuffer();
}

export function encodeSciencePreview(source) {
  return sharp(source)
    .resize({ width: 1200, height: 630, fit: "contain", position: "centre", background: "#ffffff", withoutEnlargement: true })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" }).toBuffer();
}

export async function prepareFigures({ sourceDirectory = sourceDefault, check = false } = {}) {
  const publicFile = path.join(root, "src/data/publication-figures.json");
  const evidenceFile = path.join(root, "references/publication-figures.json");
  const figures = JSON.parse(await readFile(publicFile, "utf8"));
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  const selected = evidence.figures.filter(entry => entry.preparation?.script === script);
  assert.deepEqual(selected.map(entry => entry.key).sort(), [...keys].sort());
  const pending = [];
  let scienceSource;

  // Validate and encode every source before any output is written.
  for (const entry of selected) {
    assert.equal(entry.rightsStatus, "resolved", entry.key);
    assert.ok(["verified", "user-confirmed"].includes(entry.identityStatus), entry.key);
    assert.equal(path.basename(entry.sourceFile), entry.sourceFile);
    const source = await readFile(path.join(sourceDirectory, entry.sourceFile));
    assert.equal(sha256(source), entry.sourceSha256, `Source changed: ${entry.sourceFile}`);
    const metadata = await sharp(source).metadata();
    assert.equal(metadata.width, entry.resolution.nativeWidth, entry.key);
    assert.equal(metadata.height, entry.resolution.nativeHeight, entry.key);
    const { outputStem, widths, transform, encoding } = entry.preparation;
    assert.match(outputStem, /^[a-z0-9-]+$/);
    assert.equal(transform, "full-frame-resize-only");
    assert.equal(encoding, "lossless-webp");
    assert.deepEqual(widths, [...new Set(widths)].sort((a, b) => a - b));
    assert.equal(widths.at(-1), metadata.width, entry.key);
    const variants = [];
    for (const width of widths) {
      assert.ok(Number.isInteger(width) && width > 0 && width <= metadata.width, entry.key);
      const bytes = await encodeFigure(source, width);
      const output = await sharp(bytes).metadata();
      const src = `/assets/images/publications/${outputStem}-${width}.webp`;
      variants.push({ src, width: output.width, height: output.height, sha256: sha256(bytes) });
      pending.push({ file: path.join(root, "public", src), bytes });
      if (entry.key === "arena_spike" && width === metadata.width) scienceSource = bytes;
    }
    const figure = figures.find(item => item.key === entry.key && item.doi === entry.doi);
    assert.ok(figure, entry.key);
    const full = variants.at(-1);
    Object.assign(figure, { image: full.src, width: full.width, height: full.height,
      variants: variants.map(({ sha256: hash, ...variant }) => variant) });
    entry.variants = variants;
  }

  assert.ok(scienceSource);
  const social = await encodeSciencePreview(scienceSource);
  evidence.socialPreview.sha256 = sha256(social);
  pending.push({ file: path.join(root, "public", evidence.socialPreview.image), bytes: social });
  pending.push({ file: publicFile, bytes: json(figures) }, { file: evidenceFile, bytes: json(evidence) });
  for (const { file, bytes } of pending) {
    if (check) {
      assert.ok((await readFile(file)).equals(bytes), `Deterministic output differs: ${path.relative(root, file)}`);
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    }
  }
  const variantCount = selected.reduce((total, entry) => total + entry.variants.length, 0);
  console.log(`${check ? "Verified" : "Prepared"} ${selected.length} complete figures, ${variantCount} WebP variants, and the contained science preview.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => arg === "--check"), "Only --check is supported; sources stay in the private review folder.");
  await prepareFigures({ check: args.includes("--check") });
}
