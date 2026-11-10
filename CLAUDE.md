# CLAUDE.md

Claude Code loads this file automatically. `README.md` is the operating manual; this file adds what an assistant needs to keep the Abraham Lab website updated safely.

## What this is

- The Abraham Lab website (Harvard Medical School / HHMI): an Astro site owned by the AbrahamLabHMS GitHub organization and published by GitHub Actions to https://abrahamlabhms.github.io/. James has write access; the organization owner controls repository settings such as branch protection.
- Content lives in `src/data/` (`people.ts`, `publications.ts`, `research.ts`, news) and `src/pages/`; images under `public/assets/images/`; research notes and review evidence under `references/` and `output/`.
- Jonathan Abraham sets content direction. His review with James on 2026-10-29 (Zoom AI summary in James's Zoom account) is the reference for the current content items.

## How to make a change

1. Edit the source. People and alumni live in `src/data/people.ts`; the team page and `scripts/validate-presentation.mjs` enforce the current rules: alumni rows show name and lab dates only (no next-position text or links), dates use `YYYY-MM`, incomplete dates render as a dash with a screen-reader note, current members sit in the groups listed in `src/data/types.ts`.
2. Run `npm test`, then `npm run build` (Node 24; `npm ci` first if `node_modules` is missing). The build runs the security and content validators, builds, and validates the output. Fix the source, never the built output.
3. Commit with a clear message and push to `main`. The push runs `.github/workflows/deploy.yml`: dependency audit, tests, Astro check, build, browser screenshots, accessibility review, publication-figure review, then deploy. It takes about 15 minutes; a failing check leaves the previous site live. Check with `gh run list --repo AbrahamLabHMS/abrahamlabhms.github.io`.
4. Load the live page afterwards and confirm the change.

Publishing changes the public site, so tell James what will change before pushing to `main`.

## Rules

- Publications: treat preprints and papers alike; thumbnails use the lab-approved figure with its caption and license; never alter a scientific figure.
- Research illustrations are AI-generated conceptual schematics. Sources and generation notes live under `references/source-assets/research/`; the active set is `active-asset-manifest.json`. Do not commit unused drafts.
- Public images must be metadata-free and referenced somewhere; the validators check this.
- Keep private material (contact details, rosters, unpublished data) out of the repository.
- Numbered copies such as `photo 2.jpg` are iCloud conflict junk from the old location; never commit them. The checkout moved to `~/Developer/GitHub` on 2026-11-09.

## Local state (2026-11-09)

- Linked worktrees: `../abrahamlabhms.github.io-research-preview` (branch `preview/research-illustrations-a2`) and `../abrahamlabhms.github.io-publication-feedback` (branch `draft/publication-feedback-2026-10-12`). Both are local-only branches from Codex's work; keep or discard only with James.
- `output/` holds review artifacts and is mostly gitignored. Anything worth keeping belongs in HMS Lab Ops under Abraham Lab / Lab Website Demo / Reviews.
- Open items from the 2026-10-29 review: Dan Olal's lab dates (James will supply), Jonathan's Mass General Brigham title (an offline request), and the cryo-EM calendar (not a website task).
