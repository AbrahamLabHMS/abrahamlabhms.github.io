# Temporary dependency security exception

Approved by James on October 2, 2026: "Publish the fixes with that one temporary security exception."

**Expires after October 16, 2026, Eastern time** (`2026-10-17T04:00:00Z`). This accepts one known risk; it does not fix the dependency or declare the audit clean.

## Scope and evidence

- [GHSA-ch52-4w7c-c8xp / CVE-2026-93748](https://github.com/advisories/GHSA-ch52-4w7c-c8xp): `http-cache-semantics` can disclose cached responses between users when shared server-side caches process `max-stale` incorrectly.
- Reviewed dependency: `http-cache-semantics@4.2.0`, at `node_modules/http-cache-semantics`, through `astro@7.3.2`, at `node_modules/astro`.
- npm reports two high-severity package entries for this one advisory chain. The gate checks both together; neither package is broadly exempted.
- On October 2, the advisory listed no patched version. The [upstream issue](https://github.com/kornelski/http-cache-semantics/issues/56) and [proposed patch](https://github.com/kornelski/http-cache-semantics/pull/58) are not a released fix. npm's proposed Astro 2.10.9 downgrade is not an appropriate remediation.
- This release produces static files for GitHub Pages, with no server adapter or shared user-response cache. Astro's installed use of this library is in build-time remote-image caching. The site does not use Astro remote-image components. No deployed path exposing visitors to the vulnerable shared-cache behavior was identified.
- The two local maintenance-script issues were fixed separately: bounded publication-provider responses and public-only, DNS-pinned link requests. The compatible `devalue` and `fast-uri` updates are also included. None changes site content or presentation.

## Enforcement

`npm run audit:dependencies` runs the real npm audit and preserves its original JSON, stderr, exit status, and a separate decision in `output/ci/`. GitHub uploads those files with the other release diagnostics, even on failure.

The exception requires the exact advisory identifier, source, dependency chain, severity, install paths, lockfile versions, installed versions, and reviewed Astro configuration hash. It rejects additional high/critical findings, extra advisory causes, changed remediation, configuration drift, malformed reports, audit failures, and expiry. All other advisories retain the existing high-severity blocking threshold.

The configuration hash binds this exception to the reviewed static build. Changing output mode, adding a server adapter, or otherwise editing the Astro configuration requires a new review; do not update the hash merely to make CI pass. A new runtime or shared-cache use also requires review. This approval is not permission to accept unrelated vulnerabilities.

The deployment job checks the deadline again immediately before publishing, including after an environment-approval wait. Tests, build validation, screenshots, accessibility checks, browser fixtures, and publication-image checks remain required. If a check fails or the exception expires, the previous live site keeps serving; it is not taken offline.

## Removal

When a patched compatible dependency is released, update the lockfile, run an unmodified `npm audit --audit-level=high`, repeat release checks, and remove this exception and its deadline plumbing. Do not silently extend the deadline or apply npm's breaking downgrade. Expiry blocks new affected releases until the dependency is fixed or James approves a new, documented assessment. No background monitoring task has been created.
