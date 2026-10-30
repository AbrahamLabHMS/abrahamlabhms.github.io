import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const source = path.join(repoRoot, "public", "assets", "images", "publications", "arena-spike-fig1-2165.webp");
const socialOutputDir = path.join(repoRoot, "public", "assets", "images", "social");
const filmSource = path.join(repoRoot, "public", "assets", "images", "editorial", "inside-labs-hms-film-still.webp");
await fs.mkdir(socialOutputDir, { recursive: true });

const socialImages = [
  {
    source: path.join(repoRoot, "references", "source-assets", "hms-gordon-hall-quadrangle.jpg"),
    output: path.join(socialOutputDir, "abraham-lab-gordon-hall.jpg")
  },
  {
    source,
    fit: "contain",
    output: path.join(socialOutputDir, "abraham-lab-science.jpg")
  },
  {
    source: filmSource,
    output: path.join(socialOutputDir, "inside-labs-hms.jpg")
  }
];

for (const image of socialImages) {
  await sharp(image.source)
    .resize({ width: 1200, height: 630, fit: image.fit || "cover", position: "centre", background: "#ffffff", withoutEnlargement: image.fit === "contain" })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" })
    .toFile(image.output);
  console.log(path.relative(repoRoot, image.output));
}
