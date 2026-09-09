import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "references/source-assets/hms-gordon-hall.jpg");
const output = path.join(root, "public/assets/images/campus");
await mkdir(output, { recursive: true });

// Preserve the full photograph; responsive framing is handled by object-fit.
for (const width of [960, 1600, 2400]) {
  const file = path.join(output, `gordon-hall-${width}.webp`);
  const result = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 84, effort: 5 })
    .toFile(file);
  console.log(`${path.relative(root, file)}: ${result.width}x${result.height}, ${result.size} bytes`);
}
