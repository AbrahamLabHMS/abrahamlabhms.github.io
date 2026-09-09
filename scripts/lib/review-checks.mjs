export async function waitForSystemTheme(page, theme, timeout = 2500) {
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected &&
      getComputedStyle(document.documentElement).colorScheme === expected &&
      window.matchMedia("(prefers-color-scheme: dark)").matches === (expected === "dark"),
    theme,
    { timeout }
  );
}

export async function waitForLocalImages(page, timeout) {
  try {
    await page.waitForFunction(
      () => [...document.images]
        .filter((image) => new URL(image.currentSrc || image.src, location.href).origin === location.origin)
        .every((image) => image.complete),
      undefined,
      { timeout }
    );
    return true;
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    return false;
  }
}

export async function visitLocalImages(page, timeout = 2500) {
  const position = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  try {
    const images = page.locator("img");
    for (let index = 0; index < await images.count(); index += 1) {
      const image = images.nth(index);
      if (!await image.isVisible() || !await image.evaluate((node) =>
        new URL(node.currentSrc || node.src, location.href).origin === location.origin)) continue;
      const handle = await image.elementHandle();
      if (!handle) continue;
      try {
        // Native lazy loading needs a real viewport visit, not a jump to the footer.
        await image.scrollIntoViewIfNeeded({ timeout });
        await page.waitForFunction((node) => node.complete, handle, { timeout });
      } catch (error) {
        if (error.name !== "TimeoutError") throw error;
        // Keep failed/pending images intact for the layout audit to report.
      } finally {
        await handle.dispose();
      }
    }
  } finally {
    await page.evaluate(({ x, y }) => window.scrollTo({ left: x, top: y, behavior: "instant" }), position);
  }
}

// This function is serialized into the page; keep browser dependencies inside it.
export function collectFitSnapshot() {
  const ids = new Map();
  const id = (element) => {
    if (!ids.has(element)) ids.set(element, ids.size);
    return ids.get(element);
  };
  const label = (element) => element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}${[...element.classList].slice(0, 2).map((value) => `.${value}`).join("")}`;
  const box = (rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
  const eligible = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 ||
          ["absolute", "fixed", "sticky"].includes(style.position) || current.hidden ||
          current.getAttribute("aria-hidden") === "true" || style.clipPath !== "none" || style.getPropertyValue("clip") !== "auto") return false;
    }
    return true;
  };
  const units = [];
  const add = (element, rects, container) => {
    if (!container || !eligible(element)) return;
    while (container && ["inline", "contents"].includes(getComputedStyle(container).display)) container = container.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const painted = [...rects].filter((rect) => rect.width > 0 && rect.height > 0).map(box);
    if (!painted.length || bounds.width <= 0 || bounds.height <= 0) return;
    const ancestors = [];
    for (let current = element.parentElement; current; current = current.parentElement) ancestors.push(id(current));
    const clips = [];
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      const x = ["hidden", "clip"].includes(style.overflowX);
      const y = ["hidden", "clip"].includes(style.overflowY);
      if (x || y) clips.push({ x, y, selector: label(current), bounds: box(current.getBoundingClientRect()) });
    }
    units.push({ id: id(element), selector: label(element), parent: label(container), ancestors, bounds: box(bounds), rects: painted, clips });
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(node.parentElement.tagName)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    add(node.parentElement, range.getClientRects(), node.parentElement);
  }
  for (const element of document.querySelectorAll("img,svg,button,input,select,textarea")) {
    add(element, element.getClientRects(), element.parentElement);
  }
  return units;
}

export function inspectFit(units, tolerance = 2) {
  const parentCollisions = [];
  const siblingCollisions = [];
  const seenParents = new Set();
  const seenPairs = new Set();
  for (const unit of units) {
    // Font ink can exceed line boxes vertically. Horizontal escape is unambiguous;
    // vertical clipping remains covered by the existing scroll/client-size check.
    if (unit.rects.some((rect) => rect.left < unit.bounds.left - tolerance || rect.right > unit.bounds.right + tolerance) && !seenParents.has(unit.id)) {
      parentCollisions.push({ selector: unit.selector, parent: unit.parent });
      seenParents.add(unit.id);
    }
    for (const clip of unit.clips || []) {
      const escapes = unit.rects.some((rect) =>
        (clip.x && (rect.left < clip.bounds.left - tolerance || rect.right > clip.bounds.right + tolerance)) ||
        (clip.y && (rect.top < clip.bounds.top - tolerance || rect.bottom > clip.bounds.bottom + tolerance)));
      if (escapes && !seenParents.has(unit.id)) {
        parentCollisions.push({ selector: unit.selector, parent: clip.selector });
        seenParents.add(unit.id);
      }
    }
  }
  const painted = units.flatMap((unit) => unit.rects.map((rect) => ({ unit, rect }))).sort((a, b) => a.rect.top - b.rect.top);
  for (let a = 0; a < painted.length; a += 1) {
    const first = painted[a];
    for (let b = a + 1; b < painted.length && painted[b].rect.top < first.rect.bottom - tolerance; b += 1) {
      const second = painted[b];
      const left = first.unit;
      const right = second.unit;
      if (left.id === right.id || left.ancestors.includes(right.id) || right.ancestors.includes(left.id)) continue;
      const width = Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
      const height = Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);
      const key = [left.id, right.id].sort((a, b) => a - b).join(":");
      if (width > tolerance && height > tolerance && !seenPairs.has(key)) {
        siblingCollisions.push({ first: left.selector, second: right.selector });
        seenPairs.add(key);
      }
    }
  }
  return { parentCollisions: parentCollisions.slice(0, 10), siblingCollisions: siblingCollisions.slice(0, 10) };
}

export function enlargeText() {
  // Capture before writing so nested em/rem styles are not multiplied repeatedly.
  const sizes = [...document.querySelectorAll("body,body *")].map((element) => {
    const style = getComputedStyle(element);
    return { element, fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
  });
  for (const { element, fontSize, lineHeight } of sizes) {
    element.style.setProperty("font-size", `${fontSize * 2}px`, "important");
    if (Number.isFinite(lineHeight)) element.style.setProperty("line-height", `${lineHeight * 2}px`, "important");
  }
}
