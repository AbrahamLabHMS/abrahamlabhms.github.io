# Abraham Lab Website

Static Astro site for the Abraham Lab at Harvard Medical School.

Repository: [AbrahamLabHMS/abrahamlabhms.github.io](https://github.com/AbrahamLabHMS/abrahamlabhms.github.io).
GitHub Pages address: [abrahamlabhms.github.io](https://abrahamlabhms.github.io/).
The repository name follows GitHub's account-site naming requirement; the project is named **Abraham Lab Website**.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
SITE_URL=https://abrahamlabhms.github.io SITE_BASE_PATH= npm run build
```

The Pages workflow uses this root-domain configuration. The HMS custom domain is not connected yet; coordinate that change with HMS IT before changing the deployment URL or adding a `CNAME` file.

The GitHub Actions workflow in `.github/workflows/deploy.yml` validates and builds the site, checks screenshots, and runs the accessibility/browser tests before publishing that same `_site` artifact. A failed check leaves the previous deployment serving.

Pull requests run the same checks without publishing. A manual run is review-only by default; enable its `publish` input on `main` to publish after all checks pass. The former separate visual-review workflow is consolidated into this release workflow to avoid duplicate runs.

## GitHub Pages configuration

This repository is intended to publish through the custom GitHub Actions workflow in `.github/workflows/deploy.yml`.

In GitHub repository settings, set `Settings > Pages > Build and deployment > Source` to `GitHub Actions`.

If Pages is left on a branch source, GitHub will try to run its built-in Jekyll workflow against the Astro source tree at the repository root. That produces the failing `pages build and deployment` run seen on `main`, even when the custom Astro deploy succeeds.

The repository root and `public/` both include `.nojekyll` markers so a branch-based fallback will bypass the Jekyll build. The authoritative deployment path is still the custom Actions workflow.

The content research notes live under `references/` rather than `docs/` so the repo no longer looks like a branch-published `/docs` site.

## Content validation

```bash
npm run validate:content
```

This checks publication title/DOI/PMID consistency, homepage proof ordering, and the canonical institutional wording used across the site data modules.

Run `npm test` for offline regression tests covering paper selection, roster grouping, and publication-monitor failure handling. CI uses Node 24.

The homepage feature defaults to the most recent dated research article, independently of the hero figure and preprint curation flags. To intentionally feature another verified paper, set `siteData.publicationRecord.homepageDoi` to its DOI. A preprint override is labeled "Recent preprint". Unknown DOI overrides fail validation.

`siteData.graduatePrograms` contains general Contact-page program names. `siteData.trainingPrograms` resolves individual program tags on Team; MD-PhD combinations belong to those individual records only. Allowed current roster groups are shared by the data type, renderer, and validator so a misspelled group cannot silently hide a person.

### Optional LinkedIn profiles

Current and seasonal members can opt into a discreet LinkedIn link beside their name. After the member approves the exact profile URL, add `linkedin: { url: "https://www.linkedin.com/in/their-profile/", optedIn: true }` to their record in `src/data/people.ts`. Do not infer consent or add profiles found by searching. Leave the field absent until approved, and remove it if consent is withdrawn. No profiles are enabled by default.

Only HTTPS LinkedIn personal-profile URLs without tracking parameters are accepted. The link opens in a new tab, with an accessible label and no third-party scripts, cookies, or requests before activation.

## Publication record

```bash
npm run check:publications
```

The checker compares the local record with PubMed and bioRxiv and writes a read-only report to `output/publication-check/`. Update `siteData.publicationRecord.checkedAt` only after both sources complete successfully and any candidate records have been reviewed.

The check date is internal review metadata, not a visible page label. Publications has no custom print/PDF control; ordinary browser printing still has a readable stylesheet.

Unavailable or incomplete sources produce a partial report and a failed check, not a successful "no changes" result. The checker never edits the public record or its review date.

## Image optimization

Publication thumbnails are joined to the citation list by DOI in `src/data/publication-figures.json`. The reusable component displays each complete figure without cropping; it opens an accessible image viewer, with a direct image-link fallback when JavaScript is unavailable.

`references/publication-figures.json` records approved figures' identity and reuse evidence, file checksums, and source-resolution limits. Only those approved web derivatives belong in `public/assets/images/publications/`. The supplied originals and unresolved figures remain outside this checkout; do not copy the whole review archive into public assets. New figures require a matching DOI, figure source, verified reuse terms, caption, alt text, and attribution before inclusion. Approvals under Cell Press author reuse apply to this author's lab website, not to third-party reuse; do not relabel these images as Creative Commons.

After a build, run `node scripts/review-publication-figures.mjs` to check thumbnails, image viewers, keyboard focus, no-JavaScript fallbacks, both themes, and phone/tablet/desktop layouts in all three browser engines. Results are saved in `output/playwright/publication-figures/`. The same check runs before deployment.

The full-resolution, open-access homepage figure is retained under `references/source-assets/`. Rebuild its responsive WebP files after replacing that source:

```bash
npm run images:optimize
```

## Research explainer and favicon

`/research/` is an indexable explainer linked in navigation. Its three topics live in `src/data/research.ts`; paper references resolve by DOI against the shared publication record. Titles, journal names, dates, and destination links are not duplicated in the explainer data. See `references/research-explainer-2026-09-09.md` for the source review and the limits of its conceptual illustrations.

The schematic source PNGs live in `references/source-assets/research/`. The canonical favicon is `public/assets/images/brands/abraham-lab-mark.svg`. Regenerate their optimized assets and icon fallbacks with:

```bash
node scripts/optimize-research-assets.mjs
```

The SVG monogram, 32px PNG, and 180px touch icon share one design. Versioned names let new pages request the updated favicon without depending on a stale favicon cache.

## Visual review

```bash
npm run visual:setup
npm run visual:review
```

This captures screenshots for all public routes across the required desktop, tablet, and mobile viewport matrix and writes artifacts to `output/visual-review/`.

For quicker local passes, you can scope the run:

```bash
VISUAL_REVIEW_ROUTES=home,publications VISUAL_REVIEW_VIEWPORTS=390,768 VISUAL_REVIEW_THEMES=light npm run visual:review
```

`VISUAL_REVIEW_ROUTES`, `VISUAL_REVIEW_VIEWPORTS`, and `VISUAL_REVIEW_THEMES` all accept comma-separated lists.

On some local macOS environments, headless Chromium can fail with a MachPort permission error even when the Astro build succeeds. Use a review-only manual run of `Deploy site` for the CI test artifacts. Browser permission blocks are separate: resolve the permission before reviewing that site in another surface.

## Accessibility and browser review

```bash
npm run quality:setup
npm run quality:review
```

The quality review checks the automated WCAG 2.1 Level AA rule set, keyboard navigation, text-spacing resilience, 320px reflow, light and dark modes, legacy route handoffs, and layout behavior in Chromium, Firefox, and WebKit. It covers phone, tablet, laptop, wide desktop, narrow-window, and short-wide-window shapes.

Before inspecting images, the review scrolls each visible local image into view. This preserves native lazy loading and responsive image selection while avoiding false failures for images between the first screen and the footer. Broken image checks remain enabled. To run the browser regression fixture after installing the engines:

```bash
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright RUN_REVIEW_BROWSER_FIXTURES=1 node --test scripts/review-lazy-images.test.mjs
```

Local macOS WebKit may skip links when using Tab unless full keyboard navigation is enabled; this can produce keyboard-only audit failures unrelated to the page. Check [Apple's Safari keyboard guidance](https://support.apple.com/en-gb/guide/safari/cpsh003/mac) before interpreting those results. The release workflow runs all three engines on Ubuntu and does not skip keyboard checks.

On macOS with Safari's default keyboard preference, run `QUALITY_REVIEW_WEBKIT_OPTION_TAB=1 npm run quality:review` to use Option-Tab for WebKit. This changes only the test keystroke, not system preferences. The report records the key used; Chromium, Firefox, and Linux CI continue to use ordinary Tab. Text enlargement and spacing checks cover all seven primary routes, and the review verifies that the shared editorial font loads rather than falling back.

Reports are written to `output/quality-review/`. The release workflow runs these checks against the build it will publish and uploads screenshots, reports, and logs under `site-review-<commit>`, including when a check fails.

## Contact map

The page provides an outbound Google Maps link without JavaScript or third-party requests. `Show map` creates a compact iframe only when activated; `Hide map` removes it. The directions link remains available when Google is blocked or unavailable. An iframe load event is not treated as proof that Google rendered a valid map.

Automated testing does not establish full WCAG conformance. Complete the manual checks in `references/accessibility-release-checklist.md` before the custom-domain launch.
