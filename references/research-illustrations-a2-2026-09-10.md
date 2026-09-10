# Research illustrations A2

This branch places James's approved editorial A2 set into the existing Research
page. The page's scientific text, paper references, navigation, and route are
unchanged. Only image paths, descriptive alt text, the entry caption, and labeled
color keys are updated.

## Artwork

Source PNGs and prompts: source-assets/research/editorial-a2/.
These are the approved study files, copied without further image generation.
The source hashes are recorded in the adjacent asset-manifest.json.
The original artwork was generated with the built-in image tool. It is conceptual,
not microscopy, experimental evidence, a coordinate-derived model, or a depiction
of a specific virus or measured binding interface.

- Viral surface protein: charcoal, #4b5156.
- Cell receptor: cyan, #168d9b.
- Antibody: muted gold, #c49339.
- Polymerase: muted blue, #4e6faa.
- Template strand: silver-gray, #a8b0b7.
- New strand: green, #6b884b.

Midtone targets identify each entity consistently; the raster includes tonal
variation from paper texture and shading. Labels and distinct shapes supplement
color. The shared researchEntities map supplies all rendered keys.

## Delivery

The asset optimizer creates 960- and 1536-pixel WebP exports, preserving the full
3:2 composition. Versioned filenames avoid reusing cached old illustrations.
Original sources and prompts remain outside public/ and are not deployed.

The initial integration was reviewed on preview/research-illustrations-a2.
James approved publication of the in-context preview on September 10, 2026.

## Verification

- Content, security, build-target, and presentation checks passed.
- Root and project-base-path builds passed.
- Astro check: 60 files, no errors or warnings.
- Unit tests: 102 passed, five opt-in browser fixtures skipped.
- Research screenshot matrix: eight widths (320 to 1440), both themes, no failures.
- Focused Research review: 24 checks across Chromium, Firefox, and WebKit;
  six automated WCAG 2.1 AA-subset scans; no violations.
- Phone text enlargement and image/legend consistency passed in all three engines.
- The broader whole-site quality sweep stopped on a News-page navigation timeout.
  It did not complete and is not claimed as a full-site accessibility sign-off.
  The subsequent focused review above covered the changed page successfully.
- Screenshot artifacts: output/visual-review/.
- Focused review script and results: output/visual-review/research-focus.mjs and
  output/visual-review/research-focus/report.json.

The local review server uses the built output on http://127.0.0.1:4324/research/.
Publication uses the existing main-branch deployment checks and GitHub Pages
workflow. Local preview availability alone does not confirm a public deployment.
