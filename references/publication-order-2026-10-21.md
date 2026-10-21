# Publication order - October 21, 2026

James requested this reading order: Preprints, peer-reviewed articles, then
Reviews. The page now uses separate sections in that order, followed by the two
existing Commentaries. Each section keeps newest-first year and date ordering.

The section jump links replace the former research/review/commentary filters.
All 21 records, existing article classifications, figure assets, credits, and
citation anchors are unchanged. Former journal-year bookmarks remain available,
including the commentary-only year 2020.

## Release dependency maintenance

The mandatory audit reported Vite 8.2.1 as affected by the launch-editor
advisories GHSA-587h-7wmj-h5pm, GHSA-698v-4r3x-3vcv, and GHSA-r825-w8mm-5pxw.
Vite is pinned to the compatible patched version 8.2.4. No audit exception or
weakened release gate was introduced.

Source: https://github.com/advisories/GHSA-587h-7wmj-h5pm

The registry audit returned zero vulnerabilities after installation. The native
anchor-navigation test waits for scrolling to settle before starting the next
jump; it continues to check operation without JavaScript.

## Local verification

- Content, built-output, presentation, and Astro checks passed.
- Offline regression tests: 161 passed; seven opt-in browser fixtures skipped.
- Publication browser review: 32 cases passed across Chromium, Firefox, and
  WebKit, including no-JavaScript links and touch interactions.
- Visual review: 16 publication screenshots passed layout checks at widths
  320, 390, 430, 768, 820, 1024, 1280, and 1440 in light and dark themes.
- Desktop light and phone dark screenshots were inspected for section order,
  navigation wrapping, and readable spacing.

The first GitHub release attempt passed 350 compatibility checks and 42
accessibility scans but stopped on an immediate URL assertion after a keyboard
citation jump. The browser test now waits for that native fragment navigation
to commit before checking the same destination. The page and release gates are
unchanged by this test repair.
