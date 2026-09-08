import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createBuildTargetValidator, srcsetUrls } from "./lib/build-targets.mjs";
import * as sitePaths from "./lib/site-paths.mjs";
import { staticFixture } from "./test-helpers/static-fixture.mjs";

const origin = "https://example.test";

test("validator accepts encoded fragments, named anchors, srcset, and external references", async (t) => {
  const siteRoot = await staticFixture(t);
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  const html = `<link rel='canonical' href='${origin}/demo/'>
    <h1 id='home'>Home</h1><a href='#home'>Home</a><a href='#top'>Top</a>
    <a href='team/?q=a&amp;b=c#caf%C3%A9'>Name</a><a href='/demo/team/#old-anchor'>Old</a>
    <a href='${origin}/demo/team/#team'>Team</a><a href='//external.test/no-local-file'>External</a>
    <img src='/demo/assets/with%20space.svg' srcset='/demo/assets/one.svg 1x, /demo/assets/with%20space.svg 2x'>
    <source srcset='data:image/svg+xml,%3Csvg%3E 1x, /demo/assets/one.svg 2x'>
    <a href='mailto:example@example.test'>Email</a><script>const text = 'href="/not-a-link/"';</script>`;
  assert.deepEqual(await validator.validateHtml(path.join(siteRoot, "index.html"), html), []);
});

test("missing prefixes cannot pass via existing files, absolute URLs, or responsive images", async (t) => {
  const siteRoot = await staticFixture(t);
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  const html = `<link rel=canonical href='${origin}/'>
    <a href='/team/'>Team</a><a href='${origin}/team/'>Absolute</a><a href='//example.test/team/'>Protocol relative</a>
    <img srcset='/assets/one.svg 1x, /demo/assets/one.svg 2x'>
    <link rel=preload imagesrcset='/assets/one.svg 1x'>`;
  const failures = await validator.validateHtml(path.join(siteRoot, "index.html"), html);
  assert.equal(failures.length, 6);
  assert.ok(failures.every((failure) => failure.includes("missing deployment prefix")), failures.join("\n"));
});

test("relative links resolve from the public route; fragments and missing files fail", async (t) => {
  const siteRoot = await staticFixture(t);
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  const file = path.join(siteRoot, "team/index.html");
  for (const target of ["../#home", "?q=1#team", "#old-anchor", "#caf%C3%A9", "../assets/one.svg#icon"]) {
    assert.equal(await validator.targetFailure(file, target), null, target);
  }
  for (const target of ["#missing", "../#missing", "#%zz", "../../team/", "../missing/", "../assets/one.svg/", "/demo-other/team/"]) {
    assert.ok(await validator.targetFailure(file, target), target);
  }
});

test("canonical, sitemap, and robots enforce origin, prefix, uniqueness and root normalization", async (t) => {
  const siteRoot = await staticFixture(t);
  const file = path.join(siteRoot, "index.html");
  for (const basePath of ["", "/", "///", "/demo/"]) {
    const prefix = basePath === "/demo/" ? "/demo" : "";
    const validator = createBuildTargetValidator({ siteRoot, basePath, origin });
    assert.deepEqual(await validator.validateHtml(file, `<link rel=canonical href='${origin}${prefix}/'>`), []);
    const xml = `<urlset><url><loc>${origin}${prefix}/</loc></url><url><loc>${origin}${prefix}/team/</loc></url></urlset>`;
    assert.deepEqual(await validator.validateSitemap(xml, `User-agent: *\nSitemap: ${origin}${prefix}/sitemap.xml\n`), []);
  }
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  for (const canonical of ["/demo/", "https://wrong.test/demo/", `${origin}/demo/#home`, `${origin}/demo/?q=1`]) {
    assert.ok((await validator.validateHtml(file, `<link rel=canonical href='${canonical}'>`)).length, canonical);
  }
  assert.ok((await validator.validateHtml(file, "<h1>Missing canonical</h1>")).length);
  const bad = await validator.validateSitemap(`<urlset><loc>${origin}/team/</loc><loc>${origin}/team/</loc><loc>${origin}/demo/missing/</loc></urlset>`, `Sitemap: ${origin}/sitemap.xml`);
  assert.equal(bad.length, 5);
});

test("srcset URL tokens preserve data commas and do not inspect descriptors as paths", () => {
  assert.deepEqual(srcsetUrls("data:image/png;base64,AAAA 1x, /two.png 2x"), ["data:image/png;base64,AAAA", "/two.png"]);
  assert.deepEqual(srcsetUrls("/one.png, /two.png 800w, /three.png 1200w"), ["/one.png", "/two.png", "/three.png"]);
});

test("actual config and endpoint code agree for explicit root and project builds", async (t) => {
  const siteRoot = await staticFixture(t, Object.fromEntries(["publications", "jonathan-abraham", "news", "contact"].map((name) => [`${name}/index.html`, `<h1>${name}</h1>`])));
  for (const basePath of [undefined, "", "/", "///", "/demo/"]) {
    const env = { SITE_URL: origin, SITE_BASE_PATH: basePath };
    const load = async (relative) => {
      const source = await fs.readFile(new URL(relative, import.meta.url), "utf8");
      const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
      const exports = {};
      vm.runInNewContext(outputText, {
        exports, process: { env }, Response,
        require: (name) => {
          if (name.endsWith("site-paths.mjs")) return sitePaths;
          if (name === "astro/config") return { defineConfig: (config) => config };
          if (name === "../data/site") return { siteData: { url: origin, publicationRecord: { checkedAt: "2026-09-07" } } };
          throw new Error(`Unexpected endpoint dependency: ${name}`);
        }
      });
      return exports;
    };
    const config = await load("../astro.config.mjs");
    assert.equal(config.default.base, sitePaths.normalizeBasePath(basePath) || undefined);
    const sitemap = await (await load("../src/pages/sitemap.xml.ts")).GET().text();
    const robots = await (await load("../src/pages/robots.txt.ts")).GET().text();
    const validator = createBuildTargetValidator({ siteRoot, basePath, origin });
    assert.deepEqual(await validator.validateSitemap(sitemap, robots), [], basePath);
  }
});

test("malformed base tags and non-document canonical destinations fail with diagnostics", async (t) => {
  const siteRoot = await staticFixture(t);
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  const failures = await validator.validateHtml(path.join(siteRoot, "index.html"), `<base href='http://['><link rel=canonical href='${origin}/demo/assets/one.svg'>`);
  assert.ok(failures.includes("invalid base href"));
  assert.ok(failures.some((failure) => failure.includes("must identify an HTML page")));
});

test("only the generated 404 page may use Astro's deliberate /404/ canonical", async (t) => {
  const siteRoot = await staticFixture(t);
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  const html = `<link rel=canonical href='${origin}/demo/404/'>`;
  assert.deepEqual(await validator.validateHtml(path.join(siteRoot, "404.html"), html), []);
  assert.ok((await validator.validateHtml(path.join(siteRoot, "index.html"), html)).length);
  assert.ok((await validator.validateHtml(path.join(siteRoot, "404.html"), `<link rel=canonical href='${origin}/demo/missing/'>`)).length);
  assert.ok((await validator.validateSitemap(`<urlset><loc>${origin}/demo/404/</loc></urlset>`, `Sitemap: ${origin}/demo/sitemap.xml`)).length);
});

test("raw DOI identifiers resolve from once-encoded publication fragment links", async (t) => {
  const siteRoot = await staticFixture(t, { "publications/index.html": '<article id="paper-10.1234/example.42">Citation</article>' });
  const validator = createBuildTargetValidator({ siteRoot, basePath: "/demo", origin });
  const file = path.join(siteRoot, "index.html");
  assert.equal(await validator.targetFailure(file, "/demo/publications/#paper-10.1234%2Fexample.42"), null);
  assert.match(await validator.targetFailure(file, "/demo/publications/#paper-10.1234%252Fexample.42"), /missing fragment/);
});
