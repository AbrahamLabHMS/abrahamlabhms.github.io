import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { encodeFigure } from "./prepare-oct29-publication-figures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicFile = path.join(root, "src/data/publication-figures.json");
const evidenceFile = path.join(root, "references/publication-figures.json");
const figures = JSON.parse(await readFile(publicFile, "utf8"));
const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
const entry = evidence.figures.find(item => item.key === "lachesin");
const figure = figures.find(item => item.key === entry.key);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const check = process.argv.includes("--check");
assert.equal(entry.rightsStatus, "resolved");
assert.equal(entry.userConfirmation.publicWebsiteApproved, true);
assert.equal(entry.doi, figure.doi);
assert.equal(entry.preparation.transform, "full-frame-resize-only");
assert.equal(entry.preparation.encoding, "lossless-webp");
const source = await readFile(path.resolve(root, entry.sourceDirectory, entry.sourceFile));
assert.equal(sha256(source), entry.sourceSha256);
const metadata = await sharp(source).metadata();
assert.equal(metadata.width, entry.resolution.nativeWidth);
assert.equal(metadata.height, entry.resolution.nativeHeight);
const variants = [];
const pending = [];

// Encode all sizes and verify the full-resolution pixels before writing any assets.
for (const width of entry.preparation.widths) {
  assert.ok(Number.isInteger(width) && width > 0 && width <= metadata.width);
  const bytes = await encodeFigure(source, width);
  const result = await sharp(bytes).metadata();
  assert.equal(result.width, width);
  assert.equal(result.height, Math.round(width * metadata.height / metadata.width));
  if (width === metadata.width) {
    assert.deepEqual(await sharp(bytes).ensureAlpha().raw().toBuffer(), await sharp(source).ensureAlpha().raw().toBuffer());
  }
  const src = `/assets/images/publications/${entry.preparation.outputStem}-${width}.webp`;
  variants.push({ src, width, height: result.height, sha256: sha256(bytes) });
  pending.push({ file: path.join(root, "public", src), bytes });
}
assert.equal(variants.at(-1).width, metadata.width);
entry.variants = variants;
figure.variants = variants.map(({ sha256: hash, ...variant }) => variant);
assert.equal(figure.image, variants.at(-1).src);
pending.push({ file: publicFile, bytes: Buffer.from(JSON.stringify(figures, null, 2) + "\n") });
pending.push({ file: evidenceFile, bytes: Buffer.from(JSON.stringify(evidence, null, 2) + "\n") });
for (const { file, bytes } of pending) {
  if (check) assert.deepEqual(await readFile(file), bytes, file);
  else await writeFile(file, bytes);
}
console.log(`${check ? "Verified" : "Prepared"} ${variants.length} complete-figure variants; native-size pixels match the supplied original.`);
