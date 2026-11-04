# Accessibility follow-up: November 3, 2026

This review continues the pre-cutover checks. It does not certify full WCAG 2.1 AA conformance. No macOS accessibility settings were changed and no screen reader was enabled.

## Completed

- The three-browser quality review passed 350 layout checks, 432 navigation and logo-focus checks, and 42 automated WCAG scans in light and dark themes. No definite accessibility violations were reported.
- The publication review passed 32 scenarios covering thumbnails, enlarged figures, keyboard controls, no-JavaScript behavior and touch interactions. Chromium covered widths 390, 430, 768, 820, 1024, 1280 and 1440; Firefox and WebKit covered 390, 820 and 1440, in both themes.
- Figure source links now appear beside each caption, outside the collapsed Image credit disclosure. Their accessible names identify the figure and paper. Build validation and browser checks enforce this placement for future additions.
- All seven main routes have one primary heading and one main landmark. The native figure dialog has a descriptive name, initially focuses Close, excludes the background from Chromium's exposed accessibility tree, closes with Escape and returns focus to its opener. These are browser-semantic and keyboard checks, not screen-reader listening tests.
- The current nine-page CV has English language metadata, a document title, 16 bookmarks, heading/list/table tags, and 39 tagged links. All 18,826 extracted characters belong to the structure tree, with no missing or duplicated text groups. The extracted tag order on pages 1 and 7 follows the visible rows and sections. The rendered pages were reviewed alongside the extraction. The PDF was not changed.
- The official [HMS film](https://www.youtube.com/watch?v=GFM3KLZCDps) has an English caption track, labeled English rather than English (auto-generated) in the player. Its timed transcript was available and reviewed for coverage from the opening through the closing remarks. This does not establish word-for-word accuracy, timing accuracy, speaker identification or audio-description sufficiency.

The remaining axe incomplete findings are unchanged: six image-backed-text cases on Home and six decorative-arrow cases on Team. The earlier rendered-background contrast review passed 58 checks; the arrow is hidden from assistive technology and its link has visible text. Neither is being silently counted as an automated pass.

## Still needs human review before claiming full conformance

1. Test Home, navigation, publication section jumps, the figure viewer and Contact with a screen reader. Include a physical phone or tablet. Do not enable assistive features on James's computer without separate permission.
2. Listen to the CV in a PDF reader with assistive technology, including its date/appointment tables and pages 1 and 7. Structure-tree coverage alone does not prove a useful reading experience or PDF/UA conformance; the layout tables have data cells but no header cells.
3. Compare the HMS film's captions with its audio, check speaker changes and on-screen names, and determine whether important visual information needs description. Keep the existing official film link; do not substitute an unchecked transcript.
4. Ask the authors to review whether the full figure captions convey the important information in the images. Jesse's revised Figure 3 differs from the posted preprint version; its link is deliberately labeled Preprint and figure context, not Full caption. Its revised text equivalent still needs author review. No scientific descriptions were invented in this pass.

## Evidence

Local, non-public artifacts: `output/playwright/precutover-accessibility-2026-11-03/`.

- `quality/quality-report.json`: browser, layout, keyboard and axe results, including incomplete rules.
- `figures/review.json` and screenshots: publication figure checks.
- `semantics-review.json`, route summaries and `figure-dialog-accessibility-tree.json`: browser semantics.
- `cv-structure-review.json` and `cv-tag-reading-order.txt`: CV structure and extraction.

Reference: [Harvard Digital Accessibility Policy](https://accessibility.huit.harvard.edu/digital-accessibility-policy), [Harvard manual testing guidance](https://accessibility.huit.harvard.edu/manual-testing-accessibility), and the repository's accessibility release checklist.
