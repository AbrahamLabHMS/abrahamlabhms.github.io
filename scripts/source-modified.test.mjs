import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pageSourcePaths, readSourceModificationDates } from "./lib/source-modified.mjs";

async function repository(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "abraham-source-dates-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (args, date = "2026-10-01T12:00:00Z") => execFileSync("git", [
    "-c", "user.name=Date Test", "-c", "user.email=date-test@example.test",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args
  ], { cwd: root, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  const write = async (file, text) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  };
  const commit = (date) => { git(["add", "."]); git(["commit", "-qm", "Fixture source change"], date); };
  git(["init", "-q", "-b", "main"]);
  await write("src/pages/index.astro", "Home fixture");
  await write("src/data/people.ts", "Team fixture");
  await write("src/data/jonathan.ts", "Profile fixture");
  commit();
  return { root, git, write, commit };
}

test("page dates follow relevant source commits, not deploy commits or file mtimes", async (t) => {
  const repo = await repository(t);
  await repo.write("README.md", "Contributor notes");
  repo.commit("2026-10-10T12:00:00Z");
  await fs.utimes(path.join(repo.root, "src/pages/index.astro"), new Date("2030-01-01"), new Date("2030-01-01"));
  const before = readSourceModificationDates(repo.root);
  assert.equal(before["/"], "2026-10-01");
  assert.equal(before["/team/"], "2026-10-01");
  assert.equal(before["/contact/"], undefined);
  await repo.write("src/data/people.ts", "Changed team fixture");
  repo.commit("2026-10-11T12:00:00Z");
  const after = readSourceModificationDates(repo.root);
  assert.equal(after["/team/"], "2026-10-11");
  assert.equal(after["/"], before["/"]);
  assert.equal(after["/jonathan-abraham/"], before["/jonathan-abraham/"]);
  assert.deepEqual(readSourceModificationDates(repo.root), after);
});

test("shared changes affect all pages; unrelated output does not", async (t) => {
  const repo = await repository(t);
  await repo.write("src/layouts/BaseLayout.astro", "Shared fixture");
  repo.commit("2026-10-12T12:00:00Z");
  await repo.write("output/report.json", "{}");
  assert.ok(Object.values(readSourceModificationDates(repo.root)).every((date) => date === "2026-10-12"));
  await fs.unlink(path.join(repo.root, "src/layouts/BaseLayout.astro"));
  assert.ok(Object.values(readSourceModificationDates(repo.root)).every((date) => date === undefined));
});

test("unstaged, staged and new source files omit affected dates", async (t) => {
  const repo = await repository(t);
  await repo.write("src/pages/index.astro", "Unsaved release fixture");
  assert.equal(readSourceModificationDates(repo.root)["/"], undefined);
  assert.equal(readSourceModificationDates(repo.root)["/team/"], "2026-10-01");
  await repo.write("src/data/jonathan.ts", "Staged profile fixture");
  repo.git(["add", "src/data/jonathan.ts"]);
  assert.equal(readSourceModificationDates(repo.root)["/jonathan-abraham/"], undefined);
  await repo.write("src/pages/team/new.astro", "Untracked source fixture");
  assert.equal(readSourceModificationDates(repo.root)["/team/"], undefined);
});

test("shallow history and source archives never manufacture dates", async (t) => {
  const repo = await repository(t);
  await repo.write("README.md", "Unrelated newest commit");
  repo.commit("2026-10-15T12:00:00Z");
  const shallow = path.join(repo.root, "shallow");
  repo.git(["clone", "--quiet", "--depth=1", `file://${repo.root}`, shallow]);
  assert.ok(Object.values(readSourceModificationDates(shallow)).every((date) => date === undefined));
  const archive = path.join(repo.root, "archive");
  await fs.mkdir(archive);
  assert.ok(Object.values(readSourceModificationDates(archive)).every((date) => date === undefined));
});

test("root and project paths share dates; redirects and 404 have no date", async (t) => {
  const repo = await repository(t);
  const module = new URL("./lib/source-modified.mjs", import.meta.url).href;
  const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { pageModifiedAt } from ${JSON.stringify(module)};
    console.log(JSON.stringify([
      pageModifiedAt("/", ""), pageModifiedAt("/demo/", "/demo/"),
      pageModifiedAt("/demo/team/", "/demo/"), pageModifiedAt("/demo-other/team/", "/demo/"),
      pageModifiedAt("/people/", ""), pageModifiedAt("/404/", "")
    ]));
  `], { cwd: repo.root, encoding: "utf8" });
  assert.deepEqual(JSON.parse(result), ["2026-10-01", "2026-10-01", "2026-10-01", null, null, null]);
});

test("every public page has a source scope and both CI builds fetch full history", async () => {
  const pages = await fs.readdir(new URL("../src/pages/", import.meta.url), { withFileTypes: true });
  const legacy = new Set(["people", "contact-us", "meet-the-pi"]);
  const routes = ["/", ...pages.filter((entry) => entry.isDirectory() && !legacy.has(entry.name)).map((entry) => `/${entry.name}/`)];
  assert.deepEqual(Object.keys(pageSourcePaths).sort(), routes.sort());
  for (const workflow of ["deploy", "publication-check"]) {
    const source = await fs.readFile(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), "utf8");
    assert.match(source, /fetch-depth: 0/);
  }
});
