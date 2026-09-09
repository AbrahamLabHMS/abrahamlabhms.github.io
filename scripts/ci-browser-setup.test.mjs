import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const workflow = yaml.load(readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"));
const install = workflow.jobs.checks.steps.find((step) => step.id === "browsers").run;

test("browser setup isolates both Chrome feed formats without changing Ubuntu feeds or release checks", () => {
  const root = mkdtempSync(join(tmpdir(), "lab-ci-browser-"));
  const sources = join(root, "sources");
  const backup = join(root, "backup");
  mkdirSync(sources);
  mkdirSync(backup);
  const ubuntu = "Types: deb\nURIs: http://azure.archive.ubuntu.com/ubuntu\nSuites: noble\n";
  writeFileSync(join(sources, "ubuntu.sources"), ubuntu);
  writeFileSync(join(sources, "chrome.list"), "deb https://dl.google.com/linux/chrome-stable/deb stable main\n");
  writeFileSync(join(sources, "renamed-browser.sources"), "Types: deb\nURIs: https://dl.google.com/linux/chrome-stable/deb\nSuites: stable\n");
  try {
    assert.match(install, /npx --no-install playwright install --with-deps chromium firefox webkit/);
    assert.doesNotMatch(install, /allow-unauthenticated|allow-insecure|continue-on-error/);
    const preparation = install.split("npx --no-install")[0].replaceAll("/etc/apt/sources.list.d", sources);
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", `sudo() { "$@"; }\n${preparation}`], {
      env: { ...process.env, RUNNER_TEMP: backup },
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(sources, "ubuntu.sources"), "utf8"), ubuntu);
    for (const name of ["chrome.list", "renamed-browser.sources"]) {
      assert.equal(existsSync(join(sources, name)), false);
      assert.equal(existsSync(join(backup, name)), true);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
