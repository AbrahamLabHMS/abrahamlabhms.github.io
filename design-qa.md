# Editorial Design Release Review

Date: 2026-09-15

## Reference and Scope

The visual target is the approved local HHMI-inspired editorial preview, not a reproduction of HHMI's site. Home and Research establish the reference; the remaining routes apply the same typography, surface colors, spacing, and image framing while retaining their existing purpose.

Source visual truth: `../Lab Website Demo/hhmi-editorial-preview-2026-09-15/output/playwright/focus/`, particularly `home-1280-dark.png`, `research-1280-dark.png`, and `research-chapter-820-light.png`.

Implementation: `output/visual-review/screenshots/`, with `output/visual-review/manifest.json` recording viewport and theme. Browser preview: `http://127.0.0.1:4333/`.

All seven primary routes are included. The 404 page and legacy route handoffs retain the shared shell. Content and image files are unchanged from commit `35bdb5a`.

## Comparison Method

- Home and Research were opened alongside the approved reference in the same comparison input at 1280 x 900, dark theme, initial scroll position, menu closed, and photo credit closed.
- Reference focused images are 1280 x 900 pixels at 1x density. Matching in-app captures use the same CSS viewport. Full-page screenshots use 1x density at the widths recorded in the manifest; their heights follow content. No density rescaling was used to judge wrapping or alignment.
- Full-page phone and tablet captures were inspected for reading order, list density, image composition, labels, and footer spacing. Focused browser views were used where full-page captures made small text hard to read.
- Publications, Jonathan Abraham, Team, HMS coverage, and Contact are intentional extensions, not pixel-identical copies of the Research page. Citation and directory content remains sans-serif for reading at smaller sizes.

## Findings and Corrections

1. **P2, short pages on tall windows:** the old main-element minimum height left an empty band above the footer. The shared body now uses a flex column with a flexible main area. Post-fix profile captures and the browser layout checks confirm normal section-to-footer flow.
2. **P2, Research topic navigation at tablet widths:** the two-digit chapter number could wrap separately from its label. The number now has a non-shrinking two-character slot. The 820px browser view confirms the correction; the quality review now rejects wrapped chapter numbers.
3. **P2, incomplete cross-page type consistency:** display headings previously mixed the old and new systems. The editorial font is loaded once in the shared layout and used by every page heading. Build and browser checks now verify the actual font asset and loaded font face, not just a fallback family declaration.

## Fidelity Review

- **Typography:** self-hosted Newsreader display headings; Inter for body text and lists; mono retained for technical identifiers. Fixed responsive type sizes, normal letter spacing, and readable line lengths. No paper titles or other formal source strings changed.
- **Spacing:** shared page insets and earlier tablet stacking. Research images keep their complete composition; utility pages use quieter layouts. No new card decks or decorative panels.
- **Color:** the approved white/silver baseline and softened charcoal theme now come from shared tokens. System theme behavior is unchanged. Institutional logos retain their original colors and high-contrast light backing.
- **Images:** the existing campus photograph, research illustrations, film thumbnail, and institutional marks are unchanged. Only their presentation changes. No portraits or new imagery were added.
- **Content:** data, assets, citations, dates, and route purposes are unchanged. Production pages remain indexable; sandbox indexing settings and sandbox notes were not promoted.

## Verification

- Content, security, built-site, and presentation validation passed. Parsed rendered text matches the approved sandbox on all 11 routes, and `src/data`, `src/assets`, and `public` match the pre-release commit.
- Astro check: 62 files, no errors, warnings, or hints.
- Offline regression suite: 102 passed; the five browser-only fixtures passed in a separate browser-enabled run.
- Dependency audit: no reported vulnerabilities.
- Cross-browser quality review: 350 compatibility checks, 42 automated WCAG 2.1 AA scans, no failures or axe violations.
- Text enlargement and text-spacing checks now cover all seven primary routes. Keyboard navigation, no-JavaScript fallback, map controls, reduced motion, image loading, and theme behavior remain covered.
- Local macOS WebKit used Option-Tab explicitly, as recorded in the report. Linux release checks continue to use ordinary Tab.
- Final screenshot matrix: 112 captures completed without failures. Widths are 320, 390, 430, 768, 820, 1024, 1280, and 1440, in light and dark themes. Post-fix evidence includes `research-820-light.png`, `jonathan-abraham-1440-light.png`, `publications-390-light.png`, and `contact-390-dark.png` in the implementation screenshot directory.

## Remaining Checks

No actionable P0/P1/P2 design findings remain. This report records pre-release design QA; production deployment verification follows the push. Automated scans do not establish full WCAG conformance; physical-device and assistive-technology sign-off remain separate manual checks.

final result: passed
