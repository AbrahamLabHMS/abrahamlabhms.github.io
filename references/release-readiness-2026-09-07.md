# September 7 revision: release readiness

## Release state

**Local implementation; not released or visually approved.**

Baseline: main commit `1921c921ba3065ab2ab398c9cf307f63aa511215`, deployed September 5. The work in this pass starts from that release, not the August 30 checkout or the August 10 visual demo.

Saved browser permissions currently block inspection of `jamesspencer-source.github.io`. Do not bypass that setting through another browser, local rendering, or remote screenshot capture. Permission was requested; no browser-based acceptance check has been completed in this pass. The public site and deployment configuration remain unchanged until release approval.

## Approved work implemented

1. **Publication accuracy:** added the September 2 Nature paper; retained explicit preprint status on the three existing preprints; reconciled missing identifiers, the Lachesin author list, and all six older citation discrepancies against front matter. The 20 listed records are checked through September 7. Evidence and narrowly accepted indexing differences are recorded in `references/content-source-brief.md`.
2. **Homepage:** simplified the recent-paper feature to its title, journal/date, one statement, and useful links. Removed the repeated full citation and metadata column. Kept two additional papers and one HMS coverage entry.
3. **Hero:** changed the presentation to one credited panel from the existing open-access source figure. The original asset bytes are unchanged. The panel, scrim, safe text area, and responsive placement still require rendered review.
4. **Publications:** preserved the simple year-grouped ledger; added identifier-based citation links, removed duplicate destination links, and included complete DOI URLs in print styles. No research-card section was added.
5. **Team:** grouped each row into name, appointment/program, and dates. No roster facts or photos were added. Separate valid date elements preserve the existing Started/Ended labels when only one date is known.
6. **Supporting pages:** removed repeated appointment/science wording on Jonathan's page and filler on Contact and coverage pages. Preserved all three current appointments, the full PubMed link, and the compact Contact-only map.
7. **Reliability:** made reveal content visible by default; made navigation enhancement fail open, with an in-flow header when JavaScript is unavailable; corrected institutional identity metadata and footer navigation semantics; strengthened base-path, fragment, image, link, and publication-version checks. Theme tests now observe the site's response rather than injecting a correct theme. The weekly-publication workflow change is not active until pushed.
8. **QA:** expanded the repository checks for text enlargement, breakpoint boundaries, reflow, parent/sibling collisions, interrupted reveals, and image timeouts. Browser execution and manual acceptance remain blocked, not passed.

## Non-browser checks completed

- Dependency installation from the lockfile completed using the repository cache. `parse5` is now a direct development dependency because the validators use its structured HTML parser; no installed dependency versions were changed by this pass.
- Dependency audit: zero reported vulnerabilities.
- Root-path build passed for `https://abrahamlab.med.harvard.edu/`, without adding a CNAME or changing DNS.
- GitHub Pages project-path build passed for `/abraham-lab-website-demo/`.
- Built-output presentation checks passed: one homepage feature, 20 citations, 19 current/seasonal roster rows, valid month dates, no homepage map, and labelled footer navigation.
- External-link check: 114 links, 110 reachable, zero confirmed broken, four source-restricted responses. Restricted destinations: Harvard accessibility policy and the Virology, Biophysics, and BBS program homepages. These need interactive confirmation, not removal based on a bot-blocking response.
- Local link-check details are in `output/link-check/report.json` and `report.md` (ignored generated artifacts).

Final checks after citation reconciliation:

- `npm test`: 95 total tests, 93 passed, zero failed, two browser-backed fixtures explicitly skipped because of the access gate.
- `astro check`: 53 files, zero errors, warnings, or hints.
- Both deployment-format builds passed again: 11 HTML pages and 44 files validated, plus the presentation checks above.
- Live publication checker: 20 records, zero unresolved metadata differences, zero source failures. Four evidence-backed variation rules account for six source-specific differences. Two older preprint matches remain discovery leads for already listed journal papers; they were not added as duplicate public entries.
- `git diff --check`: passed.
- Node prints an informational module-format detection warning when importing the existing TypeScript data modules directly. It does not fail tests or builds; no unrelated package-format migration was made in this pass.

No browser engine, screenshot matrix, automated accessibility scan, rendered print test, or performance measurement has run in this implementation pass. The non-browser results above must not be described as a completed visual review or WCAG certification.

## Required before push

1. Resolve the saved browser permission and inspect the September 5 baseline and revised pages at matching viewport sizes.
2. Check Home, Publications, Team, Jonathan, coverage, Contact, and legacy handoffs in light and dark mode at 390, 430, 768, 820, 1024, 1280, and 1440 pixels. Include 320-pixel reflow and widths around collapse thresholds.
3. Review keyboard navigation, focus, no-JavaScript behavior, reduced motion, text enlargement, figure credit/crop, logo readability, print citations, and interaction-loaded map behavior.
4. Run the browser-backed regression fixtures and the visual/quality scripts only after the permission gate is resolved. Inspect artifacts; a successful screenshot capture alone is not acceptance.
5. Perform the remaining manual accessibility checks. Automated tests alone do not certify WCAG 2.1 AA conformance or actual iPhone/iPad Safari behavior.
6. Push only the visually approved revision and confirm the single existing Pages deployment succeeds for that exact commit. The current changes may be preserved in a local commit before that review. Smoke-test the published routes after deployment.

No email to Hera or Elizabeth was drafted or sent. Unknown personnel dates and unverified alumni destinations were not changed. No unpublished science, lab-member photographs, live social embed, or new public route was added.
