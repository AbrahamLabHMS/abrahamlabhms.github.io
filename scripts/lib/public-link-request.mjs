import { promises as dns } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

// Conservative public-web policy based on IANA special-purpose address registries.
const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
]) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]]) {
  blocked.addSubnet(address, prefix, "ipv6");
}
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");

export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4")
    : family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

function publicUrl(input) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Link check blocked: invalid public HTTP URL");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new Error("Link check blocked: nonpublic address");
  return url;
}

export function createPublicLookup(lookup = dns.lookup) {
  return (hostname, options, callback) => {
    // The connector consumes these vetted answers directly; no second DNS lookup.
    lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
      if (!addresses.length || addresses.some(({ address, family }) => !isPublicAddress(address) || isIP(address) !== family)) {
        throw new Error("Link check blocked: DNS returned a nonpublic address");
      }
      if (options.all) callback(null, addresses);
      else {
        const answer = addresses.find((item) => !options.family || item.family === options.family);
        if (!answer) throw new Error("Link check: no address for requested family");
        callback(null, answer.address, answer.family);
      }
    }).catch((error) => callback(error));
  };
}

function nativeRequest(url, options, callback) {
  return (url.protocol === "https:" ? https : http).request(url, options, callback);
}

export function createPublicLinkFetch({ lookup = dns.lookup, request = nativeRequest, maxRedirects = 20 } = {}) {
  const checkedLookup = createPublicLookup(lookup);
  return async (input, { headers = {}, signal = AbortSignal.timeout(20000) } = {}) => {
    let url = publicUrl(input);
    for (let hop = 0; ; hop++) {
      signal.throwIfAborted();
      const response = await new Promise((resolve, reject) => {
        let settled = false;
        const fail = (error) => {
          if (!settled) { settled = true; reject(error); }
        };
        // Keep the URL hostname for Host, TLS SNI and certificate verification.
        const req = request(url, { method: "GET", headers, signal, lookup: checkedLookup, agent: false }, (value) => {
          if (settled) { value.destroy(); return; }
          settled = true;
          resolve(value);
        });
        req.on("error", fail);
        req.on("upgrade", (_response, socket) => {
          socket.destroy();
          fail(new Error("Link check: unsupported HTTP upgrade"));
        });
        req.on("close", () => fail(new Error("Link check: connection closed before response headers")));
        req.end();
      });
      response.on("error", () => {});
      const status = response.statusCode;
      const location = response.headers.location;
      response.destroy();
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        if (hop >= maxRedirects) throw new Error("Link check redirect limit exceeded");
        url = publicUrl(new URL(location, url));
        continue;
      }
      return { status, url: url.href, body: { cancel: async () => {} } };
    }
  };
}

export const publicLinkFetch = createPublicLinkFetch();
