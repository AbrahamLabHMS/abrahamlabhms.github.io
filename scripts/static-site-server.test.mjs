import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import test from "node:test";
import { createStaticSiteTools, ForbiddenPathError, normalizeBasePath } from "./lib/static-site-server.mjs";
import { siteUrl } from "./lib/site-paths.mjs";
import { staticFixture } from "./test-helpers/static-fixture.mjs";

test("empty and slash-only roots agree with project bases", () => {
  for (const base of [undefined, "", "/", "///", " / "]) {
    assert.equal(normalizeBasePath(base), "");
    assert.equal(siteUrl("https://example.test/", base, "/"), "https://example.test/");
    assert.equal(siteUrl("https://example.test/", base, "/sitemap.xml"), "https://example.test/sitemap.xml");
  }
  for (const base of ["demo", "/demo", "/demo/", " //demo// "]) {
    assert.equal(normalizeBasePath(base), "/demo");
    assert.equal(siteUrl("https://example.test", base, "/team/"), "https://example.test/demo/team/");
  }
});

test("project resolver requires an exact prefix for pages and assets without starting a server", async (t) => {
  const siteRoot = await staticFixture(t);
  const server = createStaticSiteTools({ siteRoot, basePath: "/demo/" });
  for (const request of ["/demo", "/demo/", "/demo/team/", "/demo/assets/one.svg", "/demo/assets/with%20space.svg"]) {
    assert.equal((await server.resolveStaticPath(request))?.statusCode, 200, request);
  }
  for (const request of ["/", "/team/", "/assets/one.svg", "/demo-other/team/", "/demonstration/"]) {
    assert.equal(await server.resolveStaticPath(request), null, request);
  }
  for (const request of ["/demo/missing/", "/demo/assets/one.svg/"]) {
    assert.equal((await server.resolveStaticPath(request))?.statusCode, 404, request);
  }
});

test("explicit root resolves real files but rejects traversal and outside symlinks", async (t) => {
  const siteRoot = await staticFixture(t, { "..valid/index.html": "Valid dot-prefixed directory" });
  const server = createStaticSiteTools({ siteRoot, basePath: "/" });
  assert.equal((await server.resolveStaticPath("/team/"))?.statusCode, 200);
  assert.equal((await server.resolveStaticPath("/..valid/"))?.statusCode, 200);
  for (const request of ["/../package.json", "/%2e%2e/package.json", "/..%5cpackage.json", "/%00", "/%zz"]) {
    await assert.rejects(server.resolveStaticPath(request), ForbiddenPathError);
  }
  const outside = await staticFixture(t);
  await fs.symlink(path.join(outside, "index.html"), path.join(siteRoot, "escape.html"));
  await assert.rejects(server.resolveStaticPath("/escape.html"), ForbiddenPathError);
});
