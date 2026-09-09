# Administrative Review: September 9, 2026

Scope: HHMI capitalization, alumni destinations, membership dates, and the campus hero. James asked to defer biological context and scientific copy changes. Publication records, paper summaries, and scientific prose are unchanged.

## User-confirmed dates

James initially confirmed July 2024 starts for Jessica Oros, Corazón Núñez, and Laurentia Vianney Tjang on September 9, 2026. He subsequently corrected Jessica Oros's start to April 2024. Corazón and Laurentia remain July 2024.

Cecilia "Cici" Bradley, Louella "Ella" Seo, and Zaila Avant-garde display `Summer 2026`. Their previously recorded months remain in the data. No summer year is inferred for Arya Akbarshahi or Linzy Malcolm; those dates still need confirmation. The `summers` field can represent separately confirmed summers without implying continuous employment between them.

## Alumni sources and limits

The [existing lab roster](https://abrahamlab.med.harvard.edu/people/) was reviewed alongside the sources below. Employer or institutional directories support current affiliations where available. Entries described only as a next position retain that label. No unsupported job titles or employment dates were added.

| Person | Website wording | Evidence and decision |
| --- | --- | --- |
| Dan Olal | No destination | No confidently matched destination found. |
| Poorna Goswami | Adjunct Faculty, Lasell University | [Lasell directory](https://www.lasell.edu/staff-directory.html?alpha=G) lists name and title. |
| Gábor Oroszlán | VRG Therapeutics | [VRG team](https://www.vrgtherapeutics.com/our-team) confirms spelling and affiliation; [appointment announcement](https://www.vrgtherapeutics.com/news-articles/new-member-to-the-team-gabor-oroszlan-phd) connects him to Harvard. Corrected `Gabor Oroszán`. Job title omitted because the directory and a 2026 conference biography differ. |
| Chieyu Lin | Next position: Beam Therapeutics | Lab roster establishes the next position, not continued employment. |
| Sundaresh Shankar | Next position: Broad Institute of MIT and Harvard | Lab roster establishes the next position, not continued employment. |
| Keshalini Sabaratnam | Senior Consultant, International Market Access Consulting (IMAC) | [IMAC team](https://www.imarketaccess.com/team.html) and [biography](https://www.imarketaccess.com/Keshalini-Sabaratnam.html) identify her. The previous lab roster's Kinapse destination is historical. |
| Xiaoyi Fan | Next position: Merck | Lab roster establishes the destination. Specific Merck entity and job title not independently verified. |
| Sarah Clark-Drake | Arcellx | Retained lab-roster destination; [2026 author address](https://www.nature.com/articles/s41598-025-33040-4#author-information) corroborates Arcellx for Sarah A. Clark. |
| Lars Clark | Vertex Pharmaceuticals | Lab roster says "now" at Vertex; [2024 company presentation](https://affiniatx.com/wp-content/uploads/Affinia-Cao-Cardiac-Gene-Therapy-ASGCT-2024-Presentation.pdf#page=17) supplies historical corroboration. No specific title added. |
| Katherine Nabel Smith | Dermatology Resident, University of Pennsylvania | [Penn resident directory](https://dermatology.upenn.edu/residents/current-residents/katherine-nabel-smith/) identifies current residency. Omit year number and unconfirmed concurrent appointments. |
| Haley Varnum | Medical Student, Harvard Medical School | Updated lab roster plus [Harvard/MIT MD-PhD cohort](https://www.med.harvard.edu/md_phd/students/2020.html). |
| Vesna Brusic | No destination | A [BU staff listing](https://www.bu.edu/amyloid/about-us/personnel/research-faculty-students-and-staff/) matches the name, but continuity and chronology were not established. Do not publish it as a confirmed move. |
| Adrian Coscia | Harvard/MIT MD-PhD Program | [Program roster](https://www.med.harvard.edu/md_phd/students/2020.html) and [June 2026 defense listing](https://cellbio.hms.harvard.edu/previous-dissertation-seminars). Do not imply that he is still in the thesis phase. |
| Taleen Dilanyan | PhD in Chemistry, Caltech (2024) | [Caltech dissertation record](https://thesis.caltech.edu/16280/) verifies the completed degree, not a current employer. |

Destination text links to the supporting public source. Sources are retained with each entry so later changes can be checked. An institutional listing can lag; this is a dated review, not a promise of ongoing employment verification.

## Campus photograph

- Subject: Gordon Hall and the Harvard Medical School Quadrangle. This is campus context, not a photograph of the lab's VSC building.
- [Original source and rights declaration](https://commons.wikimedia.org/wiki/File:Hms.jpg).
- [Original JPEG](https://upload.wikimedia.org/wikipedia/commons/c/c2/Hms.jpg), 3906 x 2602 pixels, photographer SA (Wikimedia Commons user Drsamir).
- The photographer explicitly released the work into the public domain worldwide, with an unrestricted-use fallback. Do not describe it as CC0 or as an official HMS photograph.
- Display credit: `SA / Wikimedia Commons`, with the rights/source link.
- Original is retained in `references/source-assets/hms-gordon-hall.jpg`.
- Regenerate the full-frame 960, 1600, and 2400 pixel WebP derivatives with `node scripts/optimize-campus-image.mjs`. Only resizing/compression is applied. CSS controls responsive framing and text contrast.
- The former figure remains available in publication/share assets; no scientific images or claims were modified in this administrative pass.

## Verification

- Content validation, static build, generated-page checks, and Astro diagnostics passed.
- 97 regression tests: 95 passed, 2 existing browser-fixture skips, no failures.
- Local screenshot review: 112 captures across seven routes, eight widths (320 through 1440), and light/dark modes.
- Local Chromium quality review: 204 compatibility checks and 42 automated WCAG 2.1 AA scans, no reported failures. This is not a claim of complete WCAG certification.
- Read back the confirmed graduate start dates from the rendered Team page. Checked campus framing on phone, tablet, and desktop, and reviewed the expanded alumni register.
- GitHub's existing deployment workflow remains responsible for the full Chromium/Firefox/WebKit release gate.
