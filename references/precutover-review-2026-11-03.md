# Pre-cutover review: November 3, 2026

## Maintenance changes

- Jonathan's overview now says that he studies the molecular mechanisms of viral infection. His title remains Professor of Microbiology.
- The publication monitor recognizes two reviewed preprints already represented by journal records. Each run rechecks the exact bioRxiv and Crossref relationships. New versions, changed metadata, conflicting identifiers and failed source requests still require review.
- Added PMCID PMC13645618 to PMID 42686903 after the source check.
- Sitemap and structured-data modification dates now use the last relevant source commit, not a publication-check date or build date. Dates are omitted when source history is unavailable or relevant files are uncommitted. Release workflows fetch full history.
- Publication output links now have the group role required by their accessible label.
- Accessibility reports retain automated findings that need manual review, rather than reporting only definite violations.

## Checks completed

- Offline regression tests: 188 passed; eight optional browser tests skipped in that command. The release workflow runs the browser tests separately.
- Astro check: 82 files, no errors, warnings or hints.
- Build and generated-site validation passed.
- Publication-source check: no pending candidates, metadata discrepancies or source errors; two reviewed preprint-to-journal relationships confirmed.
- Full Chromium, Firefox and WebKit review before the final ARIA group correction: 350 page checks, 432 navigation/logo-focus checks and 42 automated accessibility scans; no failures or definite accessibility violations.
- Automated findings requiring manual review were retained: six publication group-role findings (corrected), six image-backed-text findings and six decorative-arrow findings. The arrows are hidden from assistive technology.
- After the group-role fix, the Chromium rerun passed 210 page checks, 144 navigation/logo-focus checks and 42 accessibility scans. The six group-role findings were gone; only the image-backed-text and decorative-arrow findings remained.
- Image-backed text: 58 rendered-background contrast checks passed at widths 390, 820 and 1440 in both themes. Text-line areas were tested with animations and transitions disabled. This is a targeted check, not a site-wide accessibility certification.
- Native browser zoom spot checks: Firefox Home at 200% and 400%, Firefox Publications at 400%, and Safari Home at 200%. The inspected content remained readable and within the viewport. Browser zoom was restored to 100%.
- Live Google Map in Firefox: loaded successfully; keyboard focus entered the map controls, exited to footer navigation, returned to Hide map and closed it without a trap.
- Earlier live checks in this review confirmed all 17 publication thumbnails and enlarged viewers loaded, Escape closed the viewer, and the CV download matched the local file.
- Fresh GitHub publication check [41754264443](https://github.com/AbrahamLabHMS/abrahamlabhms.github.io/actions/runs/41754264443) passed on commit `525af71`, including the external-link check.
- The first deployment attempt stopped on an immediate visibility assertion after Escape in the figure-loading fixture. The test now waits for native dialog cancellation to finish, then checks that the viewer is hidden and focus returns to its link. The existing timeout still fails a viewer that does not close. No website behavior or release gate was removed.
- The corrected browser-fixture group passed all 12 tests locally, including 27 figure-loading/recovery cases across Chromium, Firefox and WebKit and the full team-contact-link matrix.

Local test artifacts are under `output/playwright/precutover-review-2026-11-03/`, `output/playwright/precutover-fixes-2026-11-03/` and `output/playwright/precutover-final-2026-11-03/`. These are not public site assets. The release workflow uploads its own review artifacts.

## Remaining review

These checks do not establish complete WCAG 2.1 AA conformance. Before treating the review as complete:

- Test the main flows with a screen reader, including the figure viewer and publication filters. VoiceOver testing was attempted but not completed.
- Review the CV's reading order and semantics with assistive technology.
- Review the HMS film's caption accuracy and whether visual content needs an audio description or text equivalent.
- Review equivalent text for complex scientific figures with the authors.
- Supplement automated device sizes with physical phone/tablet and assistive-technology testing. Native browser zoom checks above were spot checks, not a full route matrix.

Use [Harvard's digital accessibility policy](https://accessibility.huit.harvard.edu/digital-accessibility-policy) and [manual testing guidance](https://accessibility.huit.harvard.edu/manual-testing-accessibility) with the repository's accessibility release checklist.

## Security and cutover boundaries

The dependency gate passed with no high or critical findings and no active exception. Lower-severity advisories remain for Astro and fast-uri; this is not an all-severity clean audit. The old temporary exception is expired and retained only as historical documentation.

The MGB profile correction request and the HMS IT cutover inquiry remain unsent drafts. No DNS, custom-domain or hosting cutover was performed as part of this review. HMS IT must confirm timing and requirements before the domain changes.
