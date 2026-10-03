const origins = new Set([
  "https://eutils.ncbi.nlm.nih.gov",
  "https://www.ebi.ac.uk",
  "https://api.biorxiv.org",
  "https://api.crossref.org"
]);
const redirects = new Set([301, 302, 303, 307, 308]);

function metadataUrl(input) {
  const url = new URL(input);
  if (!origins.has(url.origin) || url.username || url.password) {
    throw new Error("Metadata request blocked: unapproved source origin");
  }
  url.hash = "";
  return url;
}

export function createMetadataReader({
  fetchImpl = globalThis.fetch,
  headers = {},
  responseLimit = 8 * 1024 * 1024,
  totalLimit = 32 * 1024 * 1024,
  requestLimit = 256
} = {}) {
  for (const limit of [responseLimit, totalLimit, requestLimit]) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid metadata budget");
  }
  const cache = new Map();
  let consumed = 0;
  let requests = 0;

  async function load(initialUrl) {
    const signal = AbortSignal.timeout(20000);
    let url = initialUrl;
    for (let hop = 0; ; hop++) {
      if (consumed >= totalLimit || requests >= requestLimit) throw new Error("Metadata run budget exceeded");
      signal.throwIfAborted();
      requests++;
      const response = await fetchImpl(url, { headers, signal, redirect: "manual" });
      if (redirects.has(response.status)) {
        await response.body?.cancel().catch(() => {});
        if (hop >= 5) throw new Error("Metadata redirect limit exceeded");
        const location = response.headers.get("location");
        if (!location) throw new Error("Metadata redirect has no destination");
        url = metadataUrl(new URL(location, url));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Metadata response has no body");
      const chunks = [];
      let size = 0;
      try {
        // Count decoded transport bytes, not the optional Content-Length header.
        for (;;) {
          signal.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          consumed += value.byteLength;
          size += value.byteLength;
          if (size > responseLimit) throw new Error("Metadata response size limit exceeded");
          if (consumed > totalLimit) throw new Error("Metadata run budget exceeded");
          chunks.push(value);
        }
        return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks, size)));
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
      }
    }
  }

  return async (input) => {
    const url = metadataUrl(input);
    const key = url.href;
    if (!cache.has(key)) cache.set(key, load(url));
    return cache.get(key);
  };
}
