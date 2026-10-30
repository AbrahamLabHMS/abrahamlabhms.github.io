import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const asset = (path) => new URL(path, root);
const diagrams = [
  { name: "entry", revision: "a3" },
  { name: "antibody", revision: "a6" },
  { name: "replication", revision: "a2" }
];
const manifest = [];
await mkdir(asset("public/assets/images/research/"), { recursive: true });

for (const { name, revision } of diagrams) {
  const sourcePath = `references/source-assets/research/editorial-${revision}/${name}.png`;
  const source = await readFile(asset(sourcePath));
  const metadata = await sharp(source).metadata();
  manifest.push({
    name,
    source: `editorial-${revision}/${name}.png`,
    width: metadata.width,
    height: metadata.height,
    sha256: createHash("sha256").update(source).digest("hex")
  });
  for (const width of [960, 1536]) {
    const destination = `public/assets/images/research/${name}-editorial-${revision}-${width}.webp`;
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 })
      .toFile(fileURLToPath(asset(destination)));
    console.log(destination);
  }
}

await writeFile(asset("references/source-assets/research/active-asset-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

if (process.argv.includes("--illustrations-only")) process.exit(0);

const mark = asset("public/assets/images/brands/abraham-lab-mark.svg");
for (const [name, width] of [["icon-32", 32], ["touch-180", 180]]) {
  const destination = `public/assets/images/brands/abraham-lab-${name}.png`;
  await sharp(fileURLToPath(mark), { density: 288 }).resize(width, width).png().toFile(fileURLToPath(asset(destination)));
  console.log(destination);
}

// Preserve the two historical favicon paths for existing links and checkouts.
await copyFile(mark, asset("public/assets/images/brands/favicon.svg"));
await copyFile(mark, asset("src/assets/images/brands/favicon.svg"));
