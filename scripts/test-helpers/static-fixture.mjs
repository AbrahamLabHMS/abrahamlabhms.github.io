import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

export async function staticFixture(t, files = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "abraham-static-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, contents] of Object.entries({
    "index.html": '<h1 id="home">Home</h1>',
    "team/index.html": '<h1 id="team">Team</h1><a name="old-anchor"></a><p id="caf\u00e9">Name</p>',
    "404.html": "Not found",
    "assets/one.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    "assets/with space.svg": "image",
    "sitemap.xml": "<urlset></urlset>",
    ...files
  })) {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  }
  return root;
}
