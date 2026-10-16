# Release dependency updates - October 16, 2026

The pre-release npm audit found three high and one moderate advisory. Compatible
updates were applied before publishing the approved publication-page draft:

| Package | Previous | Updated | Advisory |
| --- | --- | --- | --- |
| http-cache-semantics | 4.2.0 | 4.3.0 | https://github.com/advisories/GHSA-ch52-4w7c-c8xp |
| sharp | 0.35.4 | 0.35.5 | https://github.com/advisories/GHSA-wq5f-xc86-pv6w |
| smol-toml | 1.8.0 | 1.9.1 | https://github.com/advisories/GHSA-r4xh-jqrq-34v2 |
| source-map-js | 1.2.1 | 1.2.2 | https://github.com/advisories/GHSA-68fv-2mgg-jv7q |

Sharp's platform binaries and libvips packages were updated with Sharp. No Astro
upgrade, site configuration change, or additional security exception was made.
The registry audit returned zero vulnerabilities after these updates, including
an unmodified `npm audit --audit-level=high`.

The earlier cache-advisory exception is retired. The audit continues to reject
high/critical advisories, inconsistent reports, and failed audit processes.
Its prior advisory fixture is retained as a regression test: it must now fail,
even when evaluated with a date inside the former approval window.

The cache advisory's rendered GitHub page still showed the October 2 snapshot
with no patched version during review. The live npm registry supplied version
4.3.0, and its current audit no longer flagged that installed version. Record
this source difference rather than treating the earlier page as current.

Raw audit evidence and approved-output checksums are local under `output/ci`.
The publication display, citations, figures, and themes are unchanged by these
dependency and release-check edits.
