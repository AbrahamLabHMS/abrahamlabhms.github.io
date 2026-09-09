# Research explainer source and visual review

## Scope

Restore `/research/` as an explainer, rather than a legacy handoff. Keep the three useful subjects from the former page, but distinguish entry from attachment, antibody binding from neutralization, and RNA copying from DNA replication. The Publications page remains a citation ledger. No personnel, appointments, biological protocols, or publication metadata change in this pass.

The former research page informed the subject order, not the scientific claims below: https://abrahamlab.med.harvard.edu/research/. The new page links to journal articles, not back to that retiring site.

## Claim sources

All linked evidence is already in the verified lab publication record and is a journal research article, not a preprint. The independent read-only scientific audit checked entry, antibody, and replication wording and the distinctions below.

- Viral entry: Yang et al., Nature Communications (2024), https://www.nature.com/articles/s41467-024-50887-9. EEEV and SFV recognize VLDLR through different binding modes. The caption does not suggest that attachment alone causes entry.
- Receptor recognition differences: Fan et al., Cell (2025), DOI 10.1016/j.cell.2025.03.029, https://pubmed.ncbi.nlm.nih.gov/40187345/. Differences among WEEV strains support the host-receptor discussion; no disease-severity prediction is made.
- Antibody neutralization: Clark et al., Nature Communications (2018), https://www.nature.com/articles/s41467-018-04271-z. Antibodies from a vaccine recipient neutralized Junin and Machupo viruses and blocked receptor binding. They are not described as antibodies from recovered patients or as universal receptor mimics.
- Antibody escape: Nabel et al., Science (2022), https://pmc.ncbi.nlm.nih.gov/articles/PMC9127715/. The high-level summary concerns reduced antibody neutralization, not loss of all immunity or present-day clinical protection.
- Genome replication: Yu et al., Nature (2026), https://www.nature.com/articles/s41586-026-10937-2. The abstract supports coordinated helicase and polymerase action in the monkeypox virus replisome. No unpublished structures or new drug-efficacy claims are added.
- HSV-1 inhibition: Yu et al., Cell (2026), https://pmc.ncbi.nlm.nih.gov/articles/PMC13082216/. The drugs discussed act on helicase-primase; the text does not misidentify them as polymerase inhibitors.
- Nipah polymerase: Hu et al., Cell (2025), https://pubmed.ncbi.nlm.nih.gov/39837328/. Supports the lab's work on viral RNA synthesis and the RNA/DNA distinction. The general copying diagram is not labeled as this specific complex.
- Program context: HHMI Jonathan Abraham profile, https://www.hhmi.org/scientists/jonathan-abraham.

## Illustration provenance and limits

Three new conceptual illustrations were created with the built-in image-generation tool, then resized/compressed with Sharp. Original generated PNGs are retained under `references/source-assets/research/`; public WebP derivatives are 960 and 1536 pixels wide. The public captions say "Conceptual schematic, not to scale" and each has equivalent alt text. These are explanatory drawings, not publication figures, micrographs, measured structures, or predictions.

The palette uses pale titanium, neutral silver/graphite, and restrained teal. No crop hides part of a diagram. Drawings stay on their original light scientific-figure background in both system themes rather than being color-inverted.

### Prompt set

All prompts specified landscape 1536x1024, generous whitespace, precise scientific editorial linework, subtle volume, no letters/numbers/labels, no logo or watermark, and no experimental/atomic detail. Labels and accessible descriptions are authored in HTML.

1. **Viral entry:** A generic enveloped particle above a host-cell membrane, with a simple viral surface projection facing a complementary receptor whose stem crosses the membrane. Entire virion outside the cell. No fusion, internalization, infection-success arrow, or named-virus structure. The particle and receptor are conceptual shapes rather than a particular viral protein complex.
2. **Antibody neutralization:** Match the first image's style. One distinctly Y-shaped antibody binds a viral projection through an arm tip. It obstructs access by a nearby cell receptor without touching the receptor or crossing the membrane. No universal claim that every antibody works this way. The viral protein and receptor remain separated.
3. **Polymerase copying:** An intentionally abstract three-lobed enzyme with a channel. One dark template strand enters; a complementary teal strand begins inside the enzyme and emerges beside the template. No inhibitor, sequence, direction labels, bases, or specific complex. The first generated draft incorrectly showed two input strands; it was rejected and corrected through an image edit to leave one input template and a paired output.

Each source was visually inspected. The surface shapes and the polymerase drawing are deliberately generic; the accompanying articles provide the actual structural evidence.

## Favicon

The new `AL` monogram is an original vector mark, not a redraw of an institutional seal or a claim of a formal lab logo approval. Carbon (#17211f), off-white (#f5f7f6), and teal (#78c8cb) follow the existing site palette. The vector source generates a 32px PNG and a 180px touch icon. Existing favicon.svg paths remain compatible copies; HTML uses the new filenames to avoid the previous favicon cache.

## Release checks

Research data validation enforces three distinct topics, existing local images, concise prose checks, and references to verified journal research articles. Built-page checks enforce an indexable canonical Research page, seven resolved article links, responsive image dimensions, attribution as schematics, Research navigation, and all favicon formats. Publication checks now reject the removed print button and checked-date label. Browser print styling remains usable without a custom page control. Research participates in the full screenshot matrix, accessibility review, 200% text enlargement, and text-spacing checks.
