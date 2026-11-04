import assert from "node:assert/strict";
import test from "node:test";
import postcss from "postcss";
import { stringifyAnimations } from "astro/runtime/server/transition.js";

test("Astro animation strings cannot introduce CSS rules or declarations", () => {
  for (const property of ["name", "duration", "delay", "easing", "direction", "fillMode"]) {
    for (const payload of ["1ms;}#injected{color:red}x{animation-duration:1ms", "1ms;color:red"]) {
      const css = stringifyAnimations([{ name: "fade", duration: 180, [property]: payload }]);
      // Untrusted values may become invalid CSS, but must stay in their declarations.
      assert.equal(css.replace(/^\s*animation-[a-z-]+:[^;{}]*;/gm, "").trim(), "", property);
      assert.match(css, /\\3B /, `${property}: semicolon must be escaped`);
    }
  }
});

test("Astro preserves ordinary numeric timings and CSS functions", () => {
  const css = stringifyAnimations([{ name: "fade", duration: 180, delay: "calc(1s + 20ms)", easing: "var(--ease)" }]);
  const declarations = Object.fromEntries(postcss.parse(`#safe {${css}}`).first.nodes.map(node => [node.prop, node.value]));
  assert.equal(declarations["animation-duration"], "180ms");
  assert.equal(declarations["animation-delay"], "calc(1s + 20ms)");
  assert.equal(declarations["animation-timing-function"], "var(--ease)");
  assert.equal(declarations["animation-name"], "fade");
});
