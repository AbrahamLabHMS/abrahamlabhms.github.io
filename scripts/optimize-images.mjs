import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const source = path.join(repoRoot, "references", "source-assets", "arenavirus-gpc-figure-2.png");
const outputDir = path.join(repoRoot, "public", "assets", "images", "publications");
const socialOutputDir = path.join(repoRoot, "public", "assets", "images", "social");
const filmSource = path.join(repoRoot, "public", "assets", "images", "editorial", "inside-labs-hms-film-still.webp");
const widths = [720, 1200, 1800];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(socialOutputDir, { recursive: true });

for (const width of widths) {
  const output = path.join(outputDir, `arenavirus-gpc-figure-2-${width}.webp`);
  await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 84, effort: 5 })
    .toFile(output);
  console.log(path.relative(repoRoot, output));
}

const socialImages = [
  {
    source: path.join(repoRoot, "references", "source-assets", "hms-gordon-hall-quadrangle.jpg"),
    output: path.join(socialOutputDir, "abraham-lab-gordon-hall.jpg")
  },
  {
    source,
    output: path.join(socialOutputDir, "abraham-lab-science.jpg")
  },
  {
    source: filmSource,
    output: path.join(socialOutputDir, "inside-labs-hms.jpg")
  }
];

for (const image of socialImages) {
  await sharp(image.source)
    .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" })
    .toFile(image.output);
  console.log(path.relative(repoRoot, image.output));
}
