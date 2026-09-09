# Campus Hero Review: September 9, 2026

## Request and image choice

James requested a more stately, leafy campus photograph in place of the winter view, with straighter architectural alignment. This pass changes the hero photograph, responsive framing, image treatment, attribution, and image checks only. Scientific copy and all personnel records are unchanged.

The replacement is a straight-on photograph of Gordon Hall across the Harvard Medical School Quadrangle. The original retains the full facade, green lawn, and leafy trees. It was photographed on September 6, 2009, not at commencement; no commencement or spring date is claimed on the site.

## Source and reuse

- Photographer: EgorovaSvetlana.
- [Source and license declaration](https://commons.wikimedia.org/wiki/File:Gordon_Hall_Harvard_Medical_School_Quadrangle.jpg).
- [Original JPEG](https://upload.wikimedia.org/wikipedia/commons/3/3d/Gordon_Hall_Harvard_Medical_School_Quadrangle.jpg): 4000 x 3000 pixels.
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Attribution, source link, license link, and a crop notice are available through the hero's Photo credit disclosure. The photographic derivatives retain this license; it does not change the license of the website's code.
- Original: `references/source-assets/hms-gordon-hall-quadrangle.jpg`.
- Derivatives: `public/assets/images/campus/gordon-hall-quad-{960,1600,2400}.webp`.
- Regenerate with `node scripts/optimize-campus-image.mjs`. This only resizes and compresses the original. CSS controls the responsive crop and text-contrast overlay.
- No generative edits, invented greenery, altered architecture, or people removal.
- The winter original remains in the internal source-assets folder for provenance, but its derivatives are no longer used by the homepage.

## Commencement alternatives

The banner-draped Gordon Hall photograph on the [HMS Faculty of Medicine Handbook](https://facultyhandbook.hms.harvard.edu/8assoc-prof/) is a useful visual reference. It has not been added to the site because its permission for reuse on this banner has not been established.

The [HMS photography guide](https://identityguide.hms.harvard.edu/multimedia/photography) distinguishes photos requiring OCER approval from the approved campus-photo gallery. That gallery requires the campus network or VPN and was unreachable in this session. James was asked whether he could connect to the HMS VPN. Publication of a different official commencement photograph should wait for an approved gallery asset or explicit permission.

## Local verification

- Static build and generated-page validation pass, including the responsive hero files, source/license links, alt text, and intrinsic dimensions.
- Astro check: no errors, warnings, or hints.
- Regression suite: 96 passed, 2 existing browser-fixture skips, no failures.
- Screenshot audit: Home at 320, 390, 430, 768, 820, 1024, 1280, and 1440 pixels, light and dark. No detected layout failures.
- Chromium site-quality review: 204 compatibility checks and 42 automated WCAG scans passed. These automated checks are not a complete accessibility certification.
- Additional hero-photo check sampled the background pixels beneath each heading, deck, and overline text rectangle at the eight widths in both themes. All 48 checks passed; the lowest measured contrast was 5.05:1. Tablet shading follows the actual width of the copy.
- New asset filenames prevent the previous winter photograph from remaining in the browser's image cache. The unused winter WebP files were removed from the public assets.

## Link-preview image

The default social image now uses the same Gordon Hall source rather than a scientific figure. Home, Team, and Contact inherit this default; Publications keeps its paper image, and the Jonathan and News pages keep their HMS film image.

- File: `public/assets/images/social/abraham-lab-gordon-hall.jpg`, 1200 x 630 pixels.
- Regenerate with `npm run images:optimize`. The centered crop preserves the facade, trees, and lawn. No photo content is added or retouched.
- This photographic derivative remains CC BY-SA 4.0. Creator, source, license URL, and crop notice are recorded in the public `abraham-lab-gordon-hall.jpg.license.txt` beside it. Sharing alt text also names the photographer, license, and crop; the homepage keeps its source and license links in the Photo credit disclosure. The JPEG has no camera or location metadata, consistent with the site's image privacy checks.
- Open Graph, Twitter Card, and structured page metadata use the new image URL. The new filename separates it from the old scientific-image cache.
- [Slack's crawler documentation](https://api.slack.com/robots) explains that it caches link metadata and images. Deployment changes the site's response to crawlers; it does not edit a thumbnail already attached to a Slack message.

## Discreet hero attribution

The full-width caption is replaced by a small Photo credit disclosure at the lower-right of the hero. The full location, photographer, source, license, and crop notice remain available on tap, click, or keyboard activation, including with JavaScript disabled. Opening the bounded panel does not resize the hero. The disclosure is checked in phone, tablet, and desktop browser tests alongside the existing light/dark screenshot matrix.
