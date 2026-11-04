# Accessibility and Responsive Release Checklist

Harvard's Digital Accessibility Policy names WCAG 2.1 Level AA as the standard for websites and web applications. The repository's quality review automates the checks that can be tested reliably in a browser and keeps this manual checklist for the rest.

## Automated on every quality-review run

- WCAG 2.1 A and AA rules available through axe-core
- light and dark color contrast
- page language, one main heading, main landmark, and skip-link target
- keyboard access to the skip link and mobile navigation
- 44 by 44 CSS-pixel mobile menu control
- no horizontal overflow at 320, 390, 600, 820, 900, 1024, 1440, and 1600 CSS-pixel widths
- phone, tablet portrait, tablet landscape, short-wide window, laptop, and wide desktop layouts
- Chromium, Firefox, and WebKit browser engines
- text-spacing stress using the values in WCAG Success Criterion 1.4.12
- broken local images, duplicate IDs, clipped text, and local runtime errors
- system light and dark modes
- reduced-motion behavior
- legacy route handoffs for `/people/`, `/contact-us/`, and `/meet-the-pi/`
- retention of axe's incomplete results in the JSON report's `manualReview` fields

Run locally after installing the repo-controlled browsers:

```sh
npm run quality:setup
npm run quality:review
```

GitHub Actions runs the same checks and uploads `output/quality-review` as an artifact.

## Manual before production launch

- Review every `manualReview` result. Record the affected element, evidence, outcome, and any fix; do not treat an incomplete rule as a pass.
- Use the whole site with only a keyboard. Confirm that focus order follows the reading order and that every focused control is visible.
- Use VoiceOver with Safari on macOS or iOS. Confirm that the header, navigation, main content, section headings, links, publication lists, and footer are announced in a useful order.
- At 200% and 400% browser zoom, review Home, Publications, Team, Jonathan Abraham, News, and Contact. Confirm that content remains readable without horizontal scrolling at an equivalent 320 CSS-pixel width.
- Increase text size and spacing in the browser or an accessibility extension. Confirm that no names, affiliations, email addresses, buttons, or publication metadata are clipped.
- Confirm that the HMS film has accurate captions and that any future video or audio content includes captions or a transcript.
- Confirm that paper-derived figures have meaningful alt text and that captions identify the paper and figure source.
- Check complex figures against their linked full captions or equivalent text. A short visual description alone may not convey all the information in a multi-panel figure.
- Keep the figure's text/source link visible beside its caption, not only inside Image credit. A revised figure needs a matching description; do not label an older source caption as the revised figure's text equivalent.
- Check the current CV PDF's reading order, headings, links, and text extraction with a screen reader, including pages with columns or long publication lists.
- Activate the Contact map with a keyboard, enter and leave the loaded frame, and confirm that the directions link works without loading Google. A simulated or blocked frame does not complete this check.
- Check both light and dark system settings on an actual phone and tablet.
- Check one recent version each of Safari, Chrome, Firefox, and Edge on physical devices when available.
- Ask a user who relies on assistive technology to review the main paths before the custom-domain launch when feasible.

## Scope note

Automated tools can find many WCAG failures, but they cannot prove full conformance. A release can be described as having passed the automated WCAG 2.1 AA review only after the automated report has no violations. Full WCAG 2.1 AA conformance also requires the manual checks above and a review of future content as it is added.

For each release, keep the dated results with the review output and distinguish passed, failed, and not tested items. Browser-engine checks and simulated small viewports do not replace physical-device or screen-reader testing.

Do not change James's macOS accessibility settings or enable VoiceOver without separate permission. Use isolated browser tests for routine checks and arrange the remaining assistive-technology review with a willing tester.

The [November 3 follow-up](accessibility-followup-2026-11-03.md) records the latest browser, CV and caption checks and the remaining human-review tasks.

## Sources

- Harvard Digital Accessibility Policy: https://accessibility.huit.harvard.edu/digital-accessibility-policy
- WCAG 2.1: https://www.w3.org/TR/WCAG21/
- axe-core rules: https://github.com/dequelabs/axe-core
