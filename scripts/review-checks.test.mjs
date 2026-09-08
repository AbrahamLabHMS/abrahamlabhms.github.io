import assert from "node:assert/strict";
import test from "node:test";
import { enlargeText, inspectFit, waitForLocalImages, waitForSystemTheme } from "./lib/review-checks.mjs";

const rect = (left, right, top = 0, bottom = 20) => ({ left, right, top, bottom });
const unit = (id, bounds, rects, ancestors = []) => ({ id, selector: `#item-${id}`, parent: "#parent", bounds, rects, ancestors });

test("system-theme checks inspect the site's state and propagate failures", async () => {
  const page = { waitForFunction: async (predicate, argument, options) => {
    assert.equal(argument, "dark");
    assert.equal(options.timeout, 2500);
    assert.match(predicate.toString(), /dataset\.theme === expected/);
    assert.doesNotMatch(predicate.toString(), /dataset\.theme\s*=(?!=)/);
  } };
  await waitForSystemTheme(page, "dark");
  await assert.rejects(waitForSystemTheme({ waitForFunction: async () => { throw new Error("theme did not follow system"); } }, "light"), /theme did not follow system/);
});

test("unresolved-image fixture uses the options argument and reports a bounded timeout", async () => {
  for (const timeout of [2500, 5000]) {
    const page = { waitForFunction: async (predicate, argument, options) => {
      assert.equal(typeof predicate, "function");
      assert.equal(argument, undefined);
      assert.equal(options.timeout, timeout);
      throw Object.assign(new Error("image remains unresolved"), { name: "TimeoutError" });
    } };
    assert.equal(await waitForLocalImages(page, timeout), false);
  }
  assert.equal(await waitForLocalImages({ waitForFunction: async () => {} }, 2500), true);
  await assert.rejects(waitForLocalImages({ waitForFunction: async () => { throw new Error("page closed"); } }, 2500), /page closed/);
});

test("parent pressure and sibling text overlap are found inside a wide viewport", () => {
  const result = inspectFit([
    unit(1, rect(0, 100), [rect(0, 125)]),
    unit(2, rect(110, 220), [rect(110, 210)])
  ]);
  assert.deepEqual(result.parentCollisions, [{ selector: "#item-1", parent: "#parent" }]);
  assert.deepEqual(result.siblingCollisions, [{ first: "#item-1", second: "#item-2" }]);
});

test("nested controls, ancestor text, wrapped lines, and subpixel contact are not collisions", () => {
  const result = inspectFit([
    unit(1, rect(0, 200, 0, 50), [rect(0, 200, 0, 50)]),
    unit(2, rect(0, 200), [rect(10, 80), rect(10, 90, 25, 45)], [1]),
    unit(3, rect(200, 300), [rect(199, 300)])
  ]);
  assert.deepEqual(result, { parentCollisions: [], siblingCollisions: [] });
});

test("same-owner inline fragments do not create self collisions", () => {
  assert.deepEqual(inspectFit([unit(1, rect(0, 100), [rect(0, 60), rect(40, 100)])]), { parentCollisions: [], siblingCollisions: [] });
});

test("an ancestor's vertical clipping is detected without treating ordinary line ink as overflow", () => {
  const text = unit(1, rect(0, 100, 0, 20), [rect(0, 100, 0, 24)]);
  assert.deepEqual(inspectFit([text]).parentCollisions, []);
  text.clips = [{ x: false, y: true, selector: "#clipped-row", bounds: rect(0, 100, 0, 20) }];
  assert.deepEqual(inspectFit([text]).parentCollisions, [{ selector: "#item-1", parent: "#clipped-row" }]);
});

test("200 percent text mode snapshots computed sizes before touching nested elements", (t) => {
  const writes = [];
  const elements = [16, 12, 10].map((size) => ({ size, style: { setProperty: (...args) => writes.push(args) } }));
  const oldDocument = globalThis.document;
  const oldComputedStyle = globalThis.getComputedStyle;
  t.after(() => { globalThis.document = oldDocument; globalThis.getComputedStyle = oldComputedStyle; });
  globalThis.document = { querySelectorAll: () => elements };
  globalThis.getComputedStyle = (element) => {
    assert.equal(writes.length, 0, "font-size writes must not affect later snapshots");
    return { fontSize: `${element.size}px`, lineHeight: `${element.size * 1.5}px` };
  };
  enlargeText();
  assert.deepEqual(writes.filter(([key]) => key === "font-size").map(([, value]) => value), ["32px", "24px", "20px"]);
  assert.ok(writes.every(([, , priority]) => priority === "important"));
});

test("image readiness uses the selected srcset resource and excludes remote images", async (t) => {
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  t.after(() => { globalThis.document = oldDocument; globalThis.location = oldLocation; });
  globalThis.location = { href: "https://local.test/", origin: "https://local.test" };
  const image = { src: "https://remote.test/image", currentSrc: "https://local.test/selected.webp", complete: false };
  globalThis.document = { images: [image, { src: "https://remote.test/missing", complete: false }] };
  const page = { waitForFunction: async (predicate) => {
    assert.equal(predicate(), false);
    image.complete = true;
    assert.equal(predicate(), true);
  } };
  assert.equal(await waitForLocalImages(page, 2500), true);
});
