import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const asset = (path) => new URL(path, root);
const diagrams = ["entry", "antibody", "replication"];
await mkdir(asset("public/assets/images/research/"), { recursive: true });

for (const name of diagrams) {
  for (const width of [960, 1536]) {
    const destination = `public/assets/images/research/${name}-schematic-${width}.webp`;
    await sharp(fileURLToPath(asset(`references/source-assets/research/${name}-schematic.png`)))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 85, effort: 5 })
      .toFile(fileURLToPath(asset(destination)));
    console.log(destination);
  }
}

const mark = asset("public/assets/images/brands/abraham-lab-mark.svg");
for (const [name, width] of [["icon-32", 32], ["touch-180", 180]]) {
  const destination = `public/assets/images/brands/abraham-lab-${name}.png`;
  await sharp(fileURLToPath(mark), { density: 288 }).resize(width, width).png().toFile(fileURLToPath(asset(destination)));
  console.log(destination);
}

// Preserve the two historical favicon paths for existing links and checkouts.
await copyFile(mark, asset("public/assets/images/brands/favicon.svg"));
await copyFile(mark, asset("src/assets/images/brands/favicon.svg"));
