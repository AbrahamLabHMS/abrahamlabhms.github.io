import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { transform } from "@astrojs/compiler-rs";
import { build } from "esbuild";
import { experimental_AstroContainer } from "astro/container";

// Render the production component without adding fixture routes or people to the website.
const source = new URL("../../src/components/TeamMemberName.astro", import.meta.url);
const compiled = transform(await readFile(source, "utf8"), {
  filename: fileURLToPath(source),
  internalURL: import.meta.resolve("astro/compiler-runtime"),
  resultScopedSlot: true,
  resolvePath: (specifier) => new URL(specifier, source).href
});
const bundled = await build({
  stdin: { contents: compiled.code, loader: "ts", resolveDir: fileURLToPath(new URL(".", source)) },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  external: ["file:*"]
});
const { default: component } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const container = await experimental_AstroContainer.create();

export const renderTeamName = (props) => container.renderToString(component, { props });
