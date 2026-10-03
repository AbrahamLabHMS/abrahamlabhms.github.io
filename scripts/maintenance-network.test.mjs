import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import { Duplex, PassThrough } from "node:stream";
import test from "node:test";
import { createMetadataReader } from "./lib/metadata-json.mjs";
import { createPublicLinkFetch, createPublicLookup, isPublicAddress } from "./lib/public-link-request.mjs";
import { checkUrl } from "./check-external-links.mjs";

const api = "https://api.crossref.org/works/";

test("metadata limits delivered bytes with absent or misleading length headers", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let canceled = false;
    const get = createMetadataReader({ responseLimit: 32, fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(20)); },
      cancel() { canceled = true; }
    }), { headers }) });
    await assert.rejects(get(`${api}large`), /response size limit/);
    assert.equal(canceled, true);
  }
});

test("metadata accepts the exact byte boundary, split UTF-8 and BOM without MIME requirements", async () => {
  const text = '\uFEFF{"name":"Núñez"}';
  const bytes = new TextEncoder().encode(text);
  const get = createMetadataReader({ responseLimit: bytes.length, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    }
  })) });
  assert.deepEqual(await get(`${api}valid`), { name: "Núñez" });
});

test("run budgets count failed parses and cache misses, never cache hits", async () => {
  let calls = 0;
  const get = createMetadataReader({ totalLimit: 6, fetchImpl: async () => {
    calls++;
    return new Response(calls === 2 ? "oops" : "{}");
  } });
  assert.deepEqual(await get(`${api}one`), {});
  await assert.rejects(get(`${api}two`), SyntaxError);
  await assert.rejects(get(`${api}two`), SyntaxError);
  await assert.rejects(get(`${api}three`), /run budget/);
  assert.deepEqual(await get(`${api}one`), {});
  assert.equal(calls, 2);
  const fresh = createMetadataReader({ totalLimit: 6, fetchImpl: async () => new Response("{}") });
  assert.deepEqual(await fresh(`${api}one`), {});
});

test("run budget rejects cumulative excess and request count is bounded", async () => {
  const get = createMetadataReader({ totalLimit: 3, fetchImpl: async () => new Response("{}") });
  await get(`${api}one`);
  await assert.rejects(get(`${api}two`), /run budget/);
  let calls = 0;
  const limited = createMetadataReader({ requestLimit: 2, fetchImpl: async () => { calls++; return new Response("{}"); } });
  await limited(`${api}one`);
  await limited(`${api}two`);
  await assert.rejects(limited(`${api}three`), /run budget/);
  assert.equal(calls, 2);
});

test("metadata redirects stay on approved HTTPS origins with a shared deadline", async () => {
  const calls = [];
  const get = createMetadataReader({ fetchImpl: async (url, options) => {
    calls.push({ url: url.href, options });
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: "/works/final" } }) : Response.json({ ok: true });
  } });
  assert.deepEqual(await get(`${api}first`), { ok: true });
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[0].options.signal, calls[1].options.signal);
  assert.equal(calls[1].url, `${api}final`);
  for (const location of ["http://api.crossref.org/", "https://127.0.0.1/", "https://evil.test/", "https://user@api.crossref.org/"]) {
    let count = 0;
    const blocked = createMetadataReader({ fetchImpl: async () => { count++; return new Response(null, { status: 302, headers: { location } }); } });
    await assert.rejects(blocked(`${api}redirect`), /unapproved source/);
    assert.equal(count, 1);
    await assert.rejects(blocked(location), /unapproved source/);
    assert.equal(count, 1);
  }
  let loops = 0;
  const loop = createMetadataReader({ fetchImpl: async () => { loops++; return new Response(null, { status: 302, headers: { location: "/loop" } }); } });
  await assert.rejects(loop(`${api}start`), /redirect limit/);
  assert.equal(loops, 6);
});

test("public address policy covers IPv4, IPv6 and mapped/special-use addresses", () => {
  for (const ip of ["0.0.0.0", "10.1.2.3", "100.100.100.200", "127.0.0.1", "169.254.169.254", "172.31.1.1",
    "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "fc00::1", "fe80::1", "ff02::1", "64:ff9b::a00:1",
    "2001:db8::1", "2001::1", "2002:7f00:1::", "3fff::1", "not-an-ip"]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

function transportFixture({ answers = [{ address: "93.184.216.34", family: 4 }], replies = [], afterResponse } = {}) {
  const connections = [];
  const requests = [];
  let lookups = 0;
  let destroyed = 0;
  const lookup = async (host, options) => {
    lookups++;
    assert.equal(options.all, true);
    return typeof answers === "function" ? answers(host, lookups) : answers;
  };
  const request = (url, options, respond) => {
    requests.push({ url: url.href, options });
    const req = new EventEmitter();
    req.end = () => options.lookup(url.hostname, { all: true }, (error, addresses) => {
      if (error) return req.emit("error", error);
      connections.push({ url: url.href, addresses });
      const reply = replies.shift() || { status: 200 };
      const response = new PassThrough();
      response.statusCode = reply.status;
      response.headers = reply.location ? { location: reply.location } : {};
      const destroy = response.destroy.bind(response);
      response.destroy = (...args) => { destroyed++; return destroy(...args); };
      respond(response);
      afterResponse?.();
    });
    return req;
  };
  return { fetch: createPublicLinkFetch({ lookup, request }), connections, requests, lookups: () => lookups, destroyed: () => destroyed };
}

test("private literals and alternate IPv4 forms never reach the transport", async () => {
  const fixture = transportFixture();
  for (const url of ["http://127.1/", "http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/",
    "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/", "file:///tmp/a", "http://user:pass@example.test/"]) {
    await assert.rejects(fixture.fetch(url), /blocked/);
  }
  assert.equal(fixture.requests.length, 0);
});

test("private or mixed DNS answers cannot become connection addresses", async () => {
  for (const answers of [[{ address: "127.0.0.1", family: 4 }],
    [{ address: "93.184.216.34", family: 4 }, { address: "::1", family: 6 }],
    [{ address: "10.0.0.1", family: 6 }], []]) {
    const fixture = transportFixture({ answers });
    const result = await checkUrl("https://example.test/", fixture.fetch);
    assert.equal(result.state, "transient");
    assert.match(result.detail, /blocked/);
    assert.equal(fixture.connections.length, 0);
  }
});

test("public redirects retain Host/TLS hostname and use vetted connector answers", async () => {
  const fixture = transportFixture({ replies: [{ status: 302, location: "/next" }, { status: 301, location: "https://other.test/final" }, { status: 200 }] });
  const signal = AbortSignal.timeout(20000);
  const result = await fixture.fetch("https://example.test/start", { signal });
  assert.equal(result.url, "https://other.test/final");
  assert.equal(fixture.connections.length, 3);
  assert.equal(fixture.lookups(), 3);
  assert.equal(fixture.destroyed(), 3);
  for (const [index, connection] of fixture.connections.entries()) {
    assert.equal(connection.addresses[0].address, "93.184.216.34");
    assert.equal(fixture.requests[index].options.signal, signal);
    assert.equal(fixture.requests[index].options.agent, false);
    assert.match(connection.url, /^https:\/\/(example|other)\.test\//);
  }
});

test("redirect hops revalidate DNS, including same-name rebinding", async () => {
  for (const location of ["http://127.0.0.1/", "https://other.test/private", "/rebound"]) {
    const fixture = transportFixture({ answers: (_host, count) => [{ address: count === 1 ? "93.184.216.34" : "10.0.0.1", family: 4 }],
      replies: [{ status: 302, location }] });
    await assert.rejects(fixture.fetch("https://example.test/start"), /blocked/);
    assert.equal(fixture.connections.length, 1);
    assert.equal(fixture.destroyed(), 1);
  }
});

test("public redirect loops and an aborted shared deadline stop further requests", async () => {
  const loop = transportFixture({ replies: Array.from({ length: 21 }, () => ({ status: 302, location: "/loop" })) });
  await assert.rejects(loop.fetch("https://example.test/start"), /redirect limit/);
  assert.equal(loop.connections.length, 21);
  const controller = new AbortController();
  const aborted = transportFixture({ replies: [{ status: 302, location: "/next" }], afterResponse: () => controller.abort() });
  await assert.rejects(aborted.fetch("https://example.test/start", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(aborted.connections.length, 1);
});

test("connector lookup supports single-family and all-address callback forms", async () => {
  const lookup = createPublicLookup(async () => [{ address: "8.8.8.8", family: 4 }, { address: "2001:4860:4860::8888", family: 6 }]);
  const answer = await new Promise((resolve, reject) => lookup("example.test", { family: 6 }, (err, address, family) => err ? reject(err) : resolve({ address, family })));
  assert.equal(answer.family, 6);
  assert.equal(answer.address, "2001:4860:4860::8888");
});

test("native HTTP upgrades and premature closure settle without losing reports", async () => {
  for (const status of [101, 200, null]) {
    let sent = false;
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
        if (sent) return;
        sent = true;
        queueMicrotask(() => {
          if (status === null) { this.destroy(); return; }
          this.push(status === 101
            ? "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: test\r\n\r\n"
            : "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
          if (status === 200) this.push(null);
        });
      }
    });
    // Exercise Node's real HTTP parser without opening a listening socket.
    const fetch = createPublicLinkFetch({ request: (url, options, callback) => http.request(url,
      { ...options, agent: undefined, createConnection: () => socket }, callback) });
    let timer;
    try {
      const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve("unsettled"), 200); });
      const result = await Promise.race([checkUrl("http://example.test/", fetch), timeout]);
      assert.notEqual(result, "unsettled", `HTTP ${status} must settle`);
      assert.equal(result.state, status === 200 ? "ok" : "transient");
      if (status === 101) assert.match(result.detail, /upgrade/i);
    } finally {
      clearTimeout(timer);
      socket.destroy();
    }
  }
});
