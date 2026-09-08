const names = (value) => value.split(", ");
const nature2024Authors = names("Li W, Plante JA, Lin C, Basu H, Plung JS, Fan X, Boeckers JM, Oros J, Buck TK, Anekal PV, Hanson WA, Varnum H, Wells A, Mann CJ, Tjang LV, Yang P, Reyna RA, Mitchell BM, Shinde DP, Walker JL, Choi SY, Brusic V, Montero Llopis P, Weaver SC, Umemori H, Chiu IM, Plante KS, Abraham J");
const nature2022Authors = names("Clark LE, Clark SA, Lin C, Liu J, Coscia A, Nabel KG, Yang P, Neel DV, Lee H, Brusic V, Stryapunina I, Plante KS, Ahmed AA, Catteruccia F, Young-Pearse TL, Chiu IM, Montero Llopis P, Weaver SC, Abraham J");
const lachesinAuthors = names("Plung JS, Mameli E, Li W, de Bruin ACM, Plante JA, Fan X, Das B, Willett BC, Hu Y, Hajovsky EM, Varnum H, Anekal PV, Sun X, Thornburg K, Brusic V, Hammond CE, Montero Llopis P, Viswanatha R, Shaw WR, Catteruccia F, Weaver SC, Plante KS, Gerold G, Perrimon N, Abraham J");

// Fixed, reviewed snapshots, not transformations of current or newly fetched authors.
// Every rule must match the DOI, named source, field and entire ordered value pair.
export const acceptedSourceVariations = [
  {
    id: "nature-2024-montero-llopis-index-parsing",
    doi: "10.1038/s41586-024-07740-2",
    sources: ["PubMed", "Crossref"],
    field: "authors",
    local: nature2024Authors,
    remote: nature2024Authors.map((name) => name === "Montero Llopis P" ? "Llopis PM" : name),
    reviewedAt: "2026-09-07",
    sourceVersion: "PMC11324528.1",
    evidence: ["https://pmc.ncbi.nlm.nih.gov/articles/PMC11324528/", "https://www.biorxiv.org/content/early/2026/07/28/2026.07.28.741058.source.xml"],
    reason: "The journal front matter names Paula Montero Llopis. Preserve the compound surname used explicitly in her other cited front matter; the two indexes parse Montero as a given name."
  },
  {
    id: "nature-2022-montero-llopis-index-parsing",
    doi: "10.1038/s41586-021-04326-0",
    sources: ["PubMed", "Crossref"],
    field: "authors",
    local: nature2022Authors,
    remote: nature2022Authors.map((name) => name === "Montero Llopis P" ? "Llopis PM" : name),
    reviewedAt: "2026-09-07",
    sourceVersion: "PMC8808280.1",
    evidence: ["https://pmc.ncbi.nlm.nih.gov/articles/PMC8808280/", "https://www.biorxiv.org/content/early/2026/07/28/2026.07.28.741058.source.xml"],
    reason: "The journal front matter names Paula Montero Llopis. Preserve her compound surname; only the exact reviewed index parsing is accepted. Lin C and Coscia A follow this article's front-matter names ChieYu Lin and Adrian Coscia."
  },
  {
    id: "pnas-2021-formal-journal-title",
    doi: "10.1073/pnas.2021569118",
    sources: ["PubMed"],
    field: "journal",
    local: ["Proceedings of the National Academy of Sciences"],
    remote: ["Proceedings of the National Academy of Sciences of the United States of America", "Proc Natl Acad Sci U S A"],
    reviewedAt: "2026-09-07",
    sourceVersion: "PMC8092486.1",
    evidence: ["https://pmc.ncbi.nlm.nih.gov/articles/PMC8092486/", "https://api.crossref.org/works/10.1073/pnas.2021569118"],
    reason: "PMC and PubMed use the expanded formal journal title; Crossref uses the shorter title retained in the citation. These exact names describe the same journal and DOI."
  },
  {
    id: "lachesin-v1-stale-biorxiv-author-string",
    doi: "10.64898/2026.07.28.741058",
    sources: ["bioRxiv v1"],
    field: "authors",
    local: lachesinAuthors,
    remote: lachesinAuthors.filter((name) => name !== "Gerold G"),
    reviewedAt: "2026-09-07",
    sourceVersion: "bioRxiv public v1; XML article-version 1.1",
    evidence: ["https://www.biorxiv.org/content/early/2026/07/28/2026.07.28.741058.source.xml", "https://www.biorxiv.org/content/10.64898/2026.07.28.741058v1.full.pdf"],
    reason: "Both version-specific author front matters include Gisa Gerold before Norbert Perrimon, agreeing with PubMed and Crossref. Only this exact stale bioRxiv v1 API list is accepted; the local citation must retain Gerold."
  }
];
