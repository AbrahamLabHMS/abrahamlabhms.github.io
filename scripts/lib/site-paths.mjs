/** @param {string | undefined} value */
export function normalizeBasePath(value = "") {
  const segment = String(value).trim().replace(/^\/+|\/+$/g, "");
  return segment ? `/${segment}` : "";
}

/** @param {string} pathname @param {string} basePath */
export function hasBasePath(pathname, basePath) {
  return !basePath || pathname === basePath || pathname.startsWith(`${basePath}/`);
}

/** @param {string} origin @param {string | undefined} basePath @param {string} route */
export function siteUrl(origin, basePath, route) {
  return new URL(`${normalizeBasePath(basePath)}/${route.replace(/^\/+/, "")}`, origin).href;
}
