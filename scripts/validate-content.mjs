import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { alumniSourceError } from "./lib/alumni-sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const canonical = {
  department: "Department of Microbiology, Blavatnik Institute, Harvard Medical School",
  building: "Veritas Science Center (VSC)",
  address: "77 Avenue Louis Pasteur",
  city: "Boston, MA 02115"
};

const dataFiles = {
  site: path.join(repoRoot, "src", "data", "site.ts"),
  publications: path.join(repoRoot, "src", "data", "publications.ts"),
  jonathan: path.join(repoRoot, "src", "data", "jonathan.ts"),
  news: path.join(repoRoot, "src", "data", "news.ts"),
  people: path.join(repoRoot, "src", "data", "people.ts"),
  research: path.join(repoRoot, "src", "data", "research.ts")
};

const scannedTextFiles = [
  path.join(repoRoot, "src", "data", "site.ts"),
  path.join(repoRoot, "src", "data", "publications.ts"),
  path.join(repoRoot, "src", "data", "jonathan.ts"),
  path.join(repoRoot, "src", "data", "news.ts"),
  path.join(repoRoot, "src", "data", "people.ts"),
  path.join(repoRoot, "src", "pages", "index.astro"),
  path.join(repoRoot, "src", "pages", "publications", "index.astro"),
  path.join(repoRoot, "src", "pages", "jonathan-abraham", "index.astro"),
  path.join(repoRoot, "src", "pages", "team", "index.astro"),
  path.join(repoRoot, "src", "pages", "people", "index.astro"),
  path.join(repoRoot, "src", "pages", "news", "index.astro"),
  path.join(repoRoot, "src", "pages", "research", "index.astro"),
  path.join(repoRoot, "src", "pages", "contact", "index.astro")
];

const discouragedPlainLanguagePatterns = [
  /\bvia\b/i,
  /\butili[sz](?:e|es|ed|ing|ation|ations)\b/i,
  /\bleverag(?:e|es|ed|ing)\b/i,
  /\bfacilitat(?:e|es|ed|ing)\b/i
];

const allowedPersonProgramTags = new Set([
  "Virology",
  "MD-PhD / Biophysics",
  "MD-PhD / Biological and Biomedical Sciences"
]);

const expectedProgramTagsByPerson = new Map([
  ["Jesse Plung", ["Virology"]],
  ["Jessica Oros", ["Virology"]],
  ["Rick Li", ["MD-PhD / Biological and Biomedical Sciences"]],
  ["Laurentia Vianney Tjang", ["Virology"]],
  ["Corazón Núñez", ["Virology"]],
  ["Alex Liu", ["Virology"]],
  ["Kevin Gong", ["Virology"]]
]);

const expectedCorrespondingDois = new Set([
  "10.1038/s41586-026-10937-2",
  "10.64898/2026.08.22.744730",
  "10.64898/2026.07.28.741352",
  "10.64898/2026.07.28.741058",
  "10.1016/j.cell.2025.11.041",
  "10.1038/s41564-025-02085-6",
  "10.1016/j.cell.2025.03.029",
  "10.1016/j.cell.2024.12.021",
  "10.1016/j.cell.2024.07.048",
  "10.1038/s41467-024-50887-9",
  "10.1038/s41586-024-07740-2",
  "10.1056/NEJMe2205563",
  "10.1016/j.cell.2022.02.002",
  "10.1038/s41586-021-04326-0",
  "10.1126/science.abl6251",
  "10.1016/j.cell.2021.03.027",
  "10.1073/pnas.2021569118",
  "10.1038/s41577-020-0365-7",
  "10.1038/s41467-018-04271-z",
  "10.1016/j.chom.2015.11.005"
]);

const expectedPmcidsByDoi = new Map([
  ["10.64898/2026.07.28.741352", "PMC13484082"],
  ["10.64898/2026.07.28.741058", "PMC13483993"],
  ["10.1016/j.cell.2025.11.041", "PMC13082216"],
  ["10.1038/s41564-025-02085-6", "PMC12408356"],
  ["10.1016/j.cell.2025.03.029", "PMC12406711"],
  ["10.1016/j.cell.2024.12.021", "PMC11813165"],
  ["10.1016/j.cell.2024.07.048", "PMC11787825"],
  ["10.1038/s41467-024-50887-9", "PMC11297306"],
  ["10.1038/s41586-024-07740-2", "PMC11324528"],
  ["10.1056/NEJMe2205563", "PMC9202318"],
  ["10.1016/j.cell.2022.02.002", "PMC8978092"],
  ["10.1038/s41586-021-04326-0", "PMC8808280"],
  ["10.1126/science.abl6251", "PMC9127715"],
  ["10.1016/j.cell.2021.03.027", "PMC7962548"],
  ["10.1073/pnas.2021569118", "PMC8092486"],
  ["10.1038/s41577-020-0365-7", "PMC7290146"],
  ["10.1038/s41467-018-04271-z", "PMC5951886"],
  ["10.1016/j.chom.2015.11.005", "PMC4685251"]
]);

// Bibliographic review completed 2026-09-07; see references/content-source-brief.md.
const reviewedPublicationFields = new Map([
  ["10.1038/s41586-026-10937-2", {
    title: "Structure and operating principles of a monkeypox virus replisome",
    authors: "Yu Z, Sathyanarayana P, Tan JMJ, Hu S, Fan X, Gao A, Kranzusch PJ, Loparo JJ, Abraham J",
    journal: "Nature", year: 2026, publishedAt: "2026-09-02", pmid: "42686903", articleType: "Research article",
    correspondenceSource: "https://www.nature.com/articles/s41586-026-10937-2#author-information"
  }],
  ["10.64898/2026.08.22.744730", { articleType: "Preprint", journal: "bioRxiv", publishedAt: "2026-08-24" }],
  ["10.64898/2026.07.28.741352", { articleType: "Preprint", journal: "bioRxiv", publishedAt: "2026-07-29", pmid: "42620031" }],
  ["10.64898/2026.07.28.741058", { articleType: "Preprint", journal: "bioRxiv", publishedAt: "2026-07-28", pmid: "42619960" }],
  ["10.1016/j.cell.2025.11.041", { authors: "Yu Z, Sathyanarayana P, Liu C, Tan JMJ, Yang P, Das B, Hu S, Fan X, Ji C, Weller SK, Shekhar M, Coen DM, Kranzusch PJ, Loparo JJ, Abraham J" }],
  ["10.1016/j.cell.2024.07.048", { authors: "Shankar S, Pan J, Yang P, Bian Y, Oroszlán G, Yu Z, Mukherjee P, Filman DJ, Hogle JM, Shekhar M, Coen DM, Abraham J" }],
  ["10.1038/s41586-024-07740-2", { authors: "Li W, Plante JA, Lin C, Basu H, Plung JS, Fan X, Boeckers JM, Oros J, Buck TK, Anekal PV, Hanson WA, Varnum H, Wells A, Mann CJ, Tjang LV, Yang P, Reyna RA, Mitchell BM, Shinde DP, Walker JL, Choi SY, Brusic V, Montero Llopis P, Weaver SC, Umemori H, Chiu IM, Plante KS, Abraham J" }],
  ["10.1038/s41586-021-04326-0", { authors: "Clark LE, Clark SA, Lin C, Liu J, Coscia A, Nabel KG, Yang P, Neel DV, Lee H, Brusic V, Stryapunina I, Plante KS, Ahmed AA, Catteruccia F, Young-Pearse TL, Chiu IM, Montero Llopis P, Weaver SC, Abraham J" }],
  ["10.1126/science.abl6251", { authors: "Nabel KG, Clark SA, Shankar S, Pan J, Clark LE, Yang P, Coscia A, McKay LGA, Varnum HH, Brusic V, Tolan NV, Zhou G, Desjardins M, Turbett SE, Kanjilal S, Sherman AC, Dighe A, LaRocque RC, Ryan ET, Tylek C, Cohen-Solal JF, Darcy AT, Tavella D, Clabbers A, Fan Y, Griffiths A, Correia IR, Seagal J, Baden LR, Charles RC, Abraham J" }],
  ["10.1073/pnas.2021569118", { authors: "Sahtoe DD, Coscia A, Mustafaoglu N, Miller LM, Olal D, Vulovic I, Yu TY, Goreshnik I, Lin YR, Clark L, Busch F, Stewart L, Wysocki VH, Ingber DE, Abraham J, Baker D" }]
]);

function transpileTsModule(source, filePath) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: filePath,
    reportDiagnostics: false
  });

  const module = { exports: {} };
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", result.outputText);
  fn(module.exports, require, module, filePath, path.dirname(filePath));
  return module.exports;
}

async function loadTsExport(filePath, exportName) {
  const source = await fs.readFile(filePath, "utf8");
  const loaded = transpileTsModule(source, filePath);
  if (!(exportName in loaded)) {
    throw new Error(`Missing export "${exportName}" in ${path.relative(repoRoot, filePath)}`);
  }
  return loaded[exportName];
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function publicAssetPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  const publicRoot = path.join(repoRoot, "public");
  const candidate = path.resolve(publicRoot, value.replace(/^\/+/, ""));
  const relative = path.relative(publicRoot, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? candidate : null;
}

async function localAssetExists(value) {
  const candidate = publicAssetPath(value);
  if (!candidate) return false;

  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

function compareDatesDesc(left, right) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function validateLabDates(entry, label, fail) {
  const pattern = /^\d{4}-(0[1-9]|1[0-2])$/;

  for (const field of ["labStart", "labEnd"]) {
    const value = entry?.[field];
    if (value !== undefined && (typeof value !== "string" || !pattern.test(value))) {
      fail(`${label}.${field} must use YYYY-MM format.`);
    }
  }

  if (entry?.labStart && entry?.labEnd && entry.labEnd < entry.labStart) {
    fail(`${label}.labEnd cannot be earlier than labStart.`);
  }

  if (entry?.summers !== undefined) {
    const years = entry.summers;
    if (!Array.isArray(years) || !years.length ||
        years.some((year) => !Number.isInteger(year) || year < 1900 || year > 2100) ||
        new Set(years).size !== years.length) {
      fail(`${label}.summers must contain unique four-digit years.`);
    } else if (years.some((year, index) => index > 0 && year < years[index - 1])) {
      fail(`${label}.summers must be in chronological order.`);
    }
  }
}

function sentenceWordCount(sentence) {
  return (sentence.match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;
}

function splitSentences(text) {
  return normalize(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function addRhythmWarnings(label, value, note) {
  if (typeof value !== "string") {
    return;
  }

  const normalized = normalize(value);
  if (!normalized) {
    return;
  }

  const sentences = splitSentences(normalized);
  if (!sentences.length) {
    return;
  }

  for (const sentence of sentences) {
    const words = sentenceWordCount(sentence);
    const commas = (sentence.match(/,/g) || []).length;

    if (words > 28) {
      note(`Rhythm review: ${label} has a sentence with ${words} words. "${sentence}"`);
    }

    if (commas > 2) {
      note(`Rhythm review: ${label} has a sentence with ${commas} commas. "${sentence}"`);
    }
  }
}

function collectStrings(value, bucket = [], seen = new Set()) {
  if (value === null || value === undefined) {
    return bucket;
  }

  if (typeof value === "string") {
    bucket.push(value);
    return bucket;
  }

  if (typeof value !== "object") {
    return bucket;
  }

  if (seen.has(value)) {
    return bucket;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, bucket, seen);
    }
    return bucket;
  }

  for (const entry of Object.values(value)) {
    collectStrings(entry, bucket, seen);
  }

  return bucket;
}

async function main() {
  const errors = [];
  const warn = [];

  const siteData = await loadTsExport(dataFiles.site, "siteData");
  const publications = await loadTsExport(dataFiles.publications, "publications");
  const jonathanProfile = await loadTsExport(dataFiles.jonathan, "jonathanProfile");
  const newsItems = await loadTsExport(dataFiles.news, "newsItems");
  const peopleData = await loadTsExport(dataFiles.people, "peopleData");
  const researchTopics = await loadTsExport(dataFiles.research, "researchTopics");
  const researchIntro = await loadTsExport(dataFiles.research, "researchIntro");
  const currentTeamGroups = new Set(await loadTsExport(path.join(repoRoot, "src", "data", "types.ts"), "CURRENT_TEAM_GROUPS"));

  const fail = (message) => errors.push(message);
  const note = (message) => warn.push(message);

  if (researchTopics.length !== 3 || new Set(researchTopics.map((topic) => topic.id)).size !== 3) {
    fail("Research must have three distinct explanatory topics.");
  }
  addRhythmWarnings("researchIntro.description", researchIntro.description, note);
  researchIntro.paragraphs.forEach((paragraph) => addRhythmWarnings("researchIntro.paragraphs", paragraph, note));
  for (const topic of researchTopics) {
    for (const image of [topic.image, topic.imageSmall]) {
      if (!await localAssetExists(image)) fail(`Research topic ${topic.id} has a missing image: ${image}`);
    }
    for (const field of ["question", "imageAlt", "caption", "relevance", "methods"]) {
      if (!normalize(topic[field])) fail(`Research topic ${topic.id} needs ${field}.`);
      addRhythmWarnings(`research.${topic.id}.${field}`, topic[field], note);
    }
    topic.paragraphs.forEach((paragraph) => addRhythmWarnings(`research.${topic.id}.paragraphs`, paragraph, note));
    if (!topic.papers.length) fail(`Research topic ${topic.id} needs published evidence.`);
    for (const reference of topic.papers) {
      const paper = publications.find((item) => item.doi === reference.doi);
      if (!paper || paper.articleType !== "Research article" || !paper.correspondingAuthor) {
        fail(`Research reference ${reference.doi} must match a verified journal research article in the record.`);
      }
      if (!normalize(reference.finding)) fail(`Research reference ${reference.doi} needs a finding.`);
      addRhythmWarnings(`research.${topic.id}.finding`, reference.finding, note);
    }
  }

  const required = [
    {
      condition: siteData.contact?.department === canonical.department,
      message: `siteData.contact.department must be exactly "${canonical.department}".`
    },
    {
      condition: siteData.institutionTitle === canonical.department,
      message: `siteData.institutionTitle must be exactly "${canonical.department}".`
    },
    {
      condition: Array.isArray(siteData.contact?.addressLines) && siteData.contact.addressLines.includes(canonical.building),
      message: `siteData.contact.addressLines must include "${canonical.building}".`
    },
    {
      condition: Array.isArray(siteData.contact?.addressLines) && siteData.contact.addressLines.includes(canonical.address),
      message: `siteData.contact.addressLines must include "${canonical.address}".`
    },
    {
      condition: Array.isArray(siteData.contact?.addressLines) && siteData.contact.addressLines.includes(canonical.city),
      message: `siteData.contact.addressLines must include "${canonical.city}".`
    },
    {
      condition: siteData.contact?.mapBuilding === canonical.building,
      message: `siteData.contact.mapBuilding must be "${canonical.building}".`
    },
    {
      condition: siteData.contact?.mapDisplayName === "Harvard Medical School",
      message: 'siteData.contact.mapDisplayName must be "Harvard Medical School".'
    },
    {
      condition: typeof jonathanProfile.title === "string" && jonathanProfile.title.includes("Harvard Medical School"),
      message: 'jonathanProfile.title must reference Harvard Medical School.'
    },
    {
      condition: jonathanProfile.title === "Professor of Microbiology, Harvard Medical School",
      message: 'jonathanProfile.title must be "Professor of Microbiology, Harvard Medical School".'
    },
    {
      condition: jonathanProfile.secondaryTitle === "Investigator, Howard Hughes Medical Institute",
      message: 'jonathanProfile.secondaryTitle must be "Investigator, Howard Hughes Medical Institute".'
    },
    {
      condition:
        jonathanProfile.clinicalTitle ===
        "Associate Physician, Division of Infectious Diseases, Brigham and Women's Hospital",
      message: "jonathanProfile.clinicalTitle must contain Jonathan Abraham's verified clinical appointment."
    },
    {
      condition: /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\?term=/.test(jonathanProfile.pubmedUrl || ""),
      message: "jonathanProfile.pubmedUrl must be an official PubMed author-search URL."
    },
    {
      condition: siteData.trainingPrograms?.Virology === "https://virologyphd.hms.harvard.edu/",
      message: "Virology must link to the official Harvard program."
    },
    {
      condition: /^\d{4}-\d{2}-\d{2}$/.test(siteData.publicationRecord?.checkedAt || ""),
      message: "siteData.publicationRecord.checkedAt must use YYYY-MM-DD format."
    },
    {
      condition:
        Array.isArray(siteData.publicationRecord?.sources) &&
        siteData.publicationRecord.sources.includes("PubMed") &&
        siteData.publicationRecord.sources.includes("bioRxiv"),
      message: "siteData.publicationRecord.sources must include PubMed and bioRxiv."
    },
    {
      condition: siteData.trainingPrograms?.["MD-PhD / Biophysics"] === "https://biophysics.fas.harvard.edu/",
      message: "Biophysics must link to the official Harvard program."
    },
    {
      condition:
        siteData.trainingPrograms?.["MD-PhD / Biological and Biomedical Sciences"] ===
        "https://bbsphd.hms.harvard.edu/",
      message: "Biological and Biomedical Sciences must link to the official Harvard program."
    },
    {
      condition: jonathanProfile.profileLinks?.some(
        (item) => item.href === "https://orcid.org/0000-0002-7937-3920"
      ),
      message: "Jonathan's verified ORCID record must be present."
    },
    {
      condition: jonathanProfile.profileLinks?.some(
        (item) => item.href.includes("physiciandirectory.brighamandwomens.org/details/13685/")
      ),
      message: "Jonathan's official Brigham clinical profile must be present."
    }
  ];

  for (const entry of required) {
    if (!entry.condition) {
      fail(entry.message);
    }
  }

  const expectedGraduatePrograms = [
    { label: "Virology", href: "https://virologyphd.hms.harvard.edu/" },
    { label: "Biophysics", href: "https://biophysics.fas.harvard.edu/" },
    { label: "Biological and Biomedical Sciences", href: "https://bbsphd.hms.harvard.edu/" }
  ];
  if (JSON.stringify(siteData.graduatePrograms) !== JSON.stringify(expectedGraduatePrograms)) {
    fail("Contact graduate programs must use general program names and official URLs, not individual MD-PhD labels.");
  }

  const homepageDoi = siteData.publicationRecord?.homepageDoi;
  if (homepageDoi !== undefined) {
    const chosen = publications.find((item) => item.doi === homepageDoi);
    if (!chosen || !chosen.publishedAt || !chosen.journal) {
      fail("Homepage publication override must name a verified record with a date and journal or preprint server.");
    }
  } else if (!publications.some((item) => item.articleType === "Research article" && item.publishedAt)) {
    fail("Homepage needs a dated research article, or an explicit publication override.");
  }

  const publicationTitles = new Map();
  const pdbIds = new Set();
  const emdbIds = new Set();
  for (const publication of publications) {
    const title = normalize(publication.title);
    if (!title) {
      fail("Every publication needs a non-empty title.");
      continue;
    }

    if (publicationTitles.has(title)) {
      fail(`Duplicate publication title detected: "${title}".`);
    } else {
      publicationTitles.set(title, publication);
    }

    if (publication.doi && !/^10\.\d{4,9}\/\S+$/i.test(publication.doi)) {
      fail(`Invalid DOI format for "${title}": ${publication.doi}`);
    }

    if (publication.pmid && !/^\d+$/.test(String(publication.pmid))) {
      fail(`Invalid PMID format for "${title}": ${publication.pmid}`);
    }

    if (publication.pmcid && !/^PMC\d+$/.test(String(publication.pmcid))) {
      fail(`Invalid PMCID format for "${title}": ${publication.pmcid}`);
    }

    if ((publication.doi || publication.pmid) && !publication.link) {
      fail(`Publication "${title}" has a DOI/PMID but no outbound link.`);
    }

    if (publication.correspondingAuthor !== true || !normalize(publication.correspondenceSource)) {
      fail(`Publication "${title}" needs verified corresponding-author source data.`);
    }

    if (!new Set(["Research article", "Preprint", "Commentary"]).has(publication.articleType)) {
      fail(`Publication "${title}" has an unsupported articleType.`);
    }

    if (publication.articleType === "Preprint" && publication.openAccess !== true) {
      fail(`Preprint "${title}" must be marked open access.`);
    }

    for (const id of publication.structures?.pdb || []) {
      if (!/^[0-9][A-Z0-9]{3}$/.test(id)) {
        fail(`Publication "${title}" has invalid PDB accession "${id}".`);
      }
      if (pdbIds.has(id)) {
        fail(`PDB accession "${id}" appears on more than one publication.`);
      }
      pdbIds.add(id);
    }

    for (const id of publication.structures?.emdb || []) {
      if (!/^EMD-\d+$/.test(id)) {
        fail(`Publication "${title}" has invalid EMDB accession "${id}".`);
      }
      if (emdbIds.has(id)) {
        fail(`EMDB accession "${id}" appears on more than one publication.`);
      }
      emdbIds.add(id);
    }

    for (const resource of publication.resourceLinks || []) {
      if (!normalize(resource.label) || !/^https:\/\//.test(resource.href || "")) {
        fail(`Publication "${title}" has an invalid resource link.`);
      }
      if (!["data", "code", "protocol", "supplement"].includes(resource.kind)) {
        fail(`Publication "${title}" has unsupported resource kind "${resource.kind}".`);
      }
    }

    for (const coverageLink of publication.coverageLinks || []) {
      if (!/^https:\/\//.test(coverageLink)) {
        fail(`Publication "${title}" has an invalid coverage link.`);
      }
    }

    if (publication.visualReuseStatus === "link-only" || publication.image && !["open-access", "lab-approved"].includes(publication.visualReuseStatus)) {
      fail(`Publication "${title}" cannot reuse an image without open-access or lab approval.`);
    }

    if (publication.image) {
      if (!(await localAssetExists(publication.image))) {
        fail(`Publication "${title}" references a missing image: ${publication.image}`);
      }
      for (const field of ["imageAlt", "figureCredit", "figureNumber", "license", "visualSource"]) {
        if (!normalize(publication[field])) {
          fail(`Publication "${title}" image needs ${field}.`);
        }
      }
    }

    if (publication.homepageProof && !publication.publishedAt) {
      fail(`Homepage proof publication "${title}" needs a publishedAt date.`);
    }

    if (publication.homepageProof && publication.image && !publication.imageAlt) {
      fail(`Homepage proof publication "${title}" needs imageAlt.`);
    }

    if (publication.homepageProof && publication.image && !(await localAssetExists(publication.image))) {
      fail(`Homepage proof publication "${title}" references a missing image: ${publication.image}`);
    }
  }

  const sortedPublications = [...publications].sort((left, right) =>
    compareDatesDesc(left.publishedAt || `${left.year}-01-01`, right.publishedAt || `${right.year}-01-01`)
  );
  const homepageProofPublications = publications.filter((publication) => publication.homepageProof);
  const leadFeaturePublications = publications.filter((publication) => publication.leadFeature);

  if (homepageProofPublications.length !== 3) {
    fail(`Expected exactly 3 homepageProof publications, found ${homepageProofPublications.length}.`);
  }

  if (leadFeaturePublications.length !== 1) {
    fail(`Expected exactly 1 leadFeature publication, found ${leadFeaturePublications.length}.`);
  }

  if (publications.length !== expectedCorrespondingDois.size) {
    fail(`Expected ${expectedCorrespondingDois.size} corresponding-author records, found ${publications.length}.`);
  }

  const publicationDois = new Set(publications.map((publication) => publication.doi));
  for (const doi of expectedCorrespondingDois) {
    if (!publicationDois.has(doi)) {
      fail(`Missing verified corresponding-author record for DOI ${doi}.`);
    }
  }

  for (const doi of publicationDois) {
    if (!expectedCorrespondingDois.has(doi)) {
      fail(`Unverified or out-of-scope publication DOI in record: ${doi}.`);
    }
  }

  for (const [doi, pmcid] of expectedPmcidsByDoi) {
    const publication = publications.find((item) => item.doi === doi);
    if (publication?.pmcid !== pmcid) {
      fail(`Publication DOI ${doi} must use verified PMCID ${pmcid}.`);
    }
  }

  for (const [doi, expected] of reviewedPublicationFields) {
    const publication = publications.find((item) => item.doi === doi);
    for (const [field, value] of Object.entries(expected)) {
      if (publication?.[field] !== value) fail(`Publication DOI ${doi} must retain reviewed ${field}: ${value}. Reconcile primary metadata before changing this guard.`);
    }
    if (publication && !publication.citation.startsWith(`${publication.authors}. `)) {
      fail(`Publication DOI ${doi} has inconsistent authors and citation text.`);
    }
  }
  const lachesin = publications.find((item) => item.doi === "10.64898/2026.07.28.741058");
  if (!lachesin?.authors.includes("Plante KS, Gerold G, Perrimon N, Abraham J")) {
    fail("The Lachesin v1 citation must retain Gisa Gerold in the order verified in XML/PDF front matter, not the stale bioRxiv summary API.");
  }

  const topThree = sortedPublications.slice(0, 3);
  const topThreeTitles = new Set(topThree.map((publication) => normalize(publication.title)));
  for (const publication of homepageProofPublications) {
    if (!topThreeTitles.has(normalize(publication.title))) {
      fail(`Homepage proof publication "${publication.title}" is not among the 3 most recent publications.`);
    }
  }

  for (const publication of topThree) {
    if (!publication.homepageProof) {
      fail(`One of the 3 most recent publications is missing homepageProof: "${publication.title}".`);
    }
  }

  if (leadFeaturePublications[0]) {
    const leadFeature = leadFeaturePublications[0];
    const newestPublication = sortedPublications[0];
    if (normalize(leadFeature.title) !== normalize(newestPublication.title)) {
      fail(
        `leadFeature should point at the newest publication. Expected "${newestPublication.title}", got "${leadFeature.title}".`
      );
    }
    if (!leadFeature.homepageProof) {
      fail(`leadFeature publication "${leadFeature.title}" must also be marked homepageProof.`);
    }
  }

  const publicationTitleSet = new Set(publications.map((publication) => normalize(publication.title)));

  for (const title of jonathanProfile.representativeWork || []) {
    if (!publicationTitleSet.has(normalize(title))) {
      fail(`Jonathan representative work "${title}" does not match any publication title.`);
    }
  }

  for (const person of peopleData.currentMembers || []) {
    validateLabDates(person, `Current member "${person.name}"`, fail);

    if (!currentTeamGroups.has(person.group)) {
      fail(`Current member "${person.name}" has unsupported group "${person.group}"; the directory must not omit them.`);
    }

    if (person.labEnd) {
      fail(`Current member "${person.name}" cannot have a labEnd date.`);
    }

    if (person.name === "Jonathan Abraham, MD, PhD" && person.title !== "Professor of Microbiology, Harvard Medical School") {
      fail('Jonathan Abraham must be listed as "Professor of Microbiology, Harvard Medical School" in peopleData.');
    }

    if ("expertiseTags" in person) {
      fail(`Person "${person.name}" uses obsolete expertiseTags. Use verified programTags only.`);
    }

    const memberPhotoFields = ["image", "imageAlt", "imagePosition", "portraitStatus"];
    for (const field of memberPhotoFields) {
      if (field in person) {
        fail(`Current member "${person.name}" uses forbidden photo field "${field}".`);
      }
    }

    if (person.fellowships !== undefined) {
      if (!Array.isArray(person.fellowships) || person.fellowships.some((value) => !normalize(value))) {
        fail(`Person "${person.name}" fellowships must be a list of non-empty verified labels.`);
      }
    }

    const tags = person.programTags || [];
    if (!Array.isArray(tags)) {
      fail(`Person "${person.name}" programTags must be an array.`);
      continue;
    }

    for (const tag of tags) {
      if (!allowedPersonProgramTags.has(tag)) {
        fail(`Person "${person.name}" has unsupported program tag "${tag}".`);
      }
    }

    const expectedTags = expectedProgramTagsByPerson.get(person.name);
    if (expectedTags) {
      if (JSON.stringify(tags) !== JSON.stringify(expectedTags)) {
        fail(`Person "${person.name}" must use programTags ${JSON.stringify(expectedTags)}.`);
      }
    } else if (tags.length) {
      fail(`Person "${person.name}" has programTags but no verified tag assignment.`);
    }
  }

  for (const person of peopleData.seasonalMembers || []) {
    validateLabDates(person, `Seasonal member "${person.name}"`, fail);
  }

  for (const group of peopleData.alumni || []) {
    for (const person of group.entries || []) {
      validateLabDates(person, `Alumnus "${person.name}"`, fail);
      const sourceError = alumniSourceError(person);
      if (sourceError) fail(`Alumnus "${person.name}" ${sourceError}.`);
    }
  }

  for (const field of ["portrait", "portraitAlt", "portraitPosition"]) {
    if (field in jonathanProfile) {
      fail(`jonathanProfile uses forbidden photo field "${field}".`);
    }
  }

  for (const item of newsItems) {
    if (normalize(item.image).startsWith("/assets/images/people/")) {
      fail(`News item "${item.title}" uses a lab-member photo.`);
    }

    if (item.image) {
      if (!(await localAssetExists(item.image))) {
        fail(`News item "${item.title}" references a missing image: ${item.image}`);
      }
      if (!normalize(item.imageAlt)) {
        fail(`News item "${item.title}" image needs imageAlt.`);
      }
      if (!normalize(item.imageCredit)) {
        fail(`News item "${item.title}" image needs imageCredit.`);
      }
    }
  }

  for (const directory of [
    path.join(repoRoot, "public", "assets", "images", "people"),
    path.join(repoRoot, "src", "assets", "images", "people")
  ]) {
    try {
      const entries = await fs.readdir(directory);
      if (entries.length) {
        fail(`Lab-member image directory must be empty: ${path.relative(repoRoot, directory)}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  for (const figure of siteData.heroFigures || []) {
    if (!(await localAssetExists(figure.image))) {
      fail(`Hero figure references a missing image: ${figure.image}`);
    }
    const creditFields = ["alt", "figureCredit", "license", "visualSource"];
    if (figure.kind !== "photograph") creditFields.push("figureNumber");
    for (const field of creditFields) {
      if (!normalize(figure[field])) {
        fail(`Hero figure "${figure.title}" needs ${field}.`);
      }
    }
    for (const variant of figure.imageVariants || []) {
      if (!Number.isInteger(variant.width) || variant.width < 320) {
        fail(`Hero figure "${figure.title}" has an invalid responsive-image width.`);
      }
      if (!(await localAssetExists(variant.path))) {
        fail(`Hero figure "${figure.title}" references a missing responsive image: ${variant.path}`);
      }
    }
  }

  for (const [label, image] of Object.entries(siteData.shareImages || {})) {
    if (!(await localAssetExists(image.image))) {
      fail(`Share image "${label}" references a missing image: ${image.image}`);
    }
    if (!normalize(image.alt) || image.width !== 1200 || image.height !== 630) {
      fail(`Share image "${label}" needs alt text and 1200x630 dimensions.`);
    }
  }

  const publicationCheckedAt = new Date(`${siteData.publicationRecord?.checkedAt || ""}T00:00:00Z`);
  if (!Number.isNaN(publicationCheckedAt.getTime())) {
    const ageInDays = Math.floor((Date.now() - publicationCheckedAt.getTime()) / 86400000);
    if (ageInDays < 0) {
      fail("siteData.publicationRecord.checkedAt cannot be in the future.");
    } else if (ageInDays > 45) {
      note(`Publication record is ${ageInDays} days old. Run npm run check:publications before release.`);
    }
  }

  const sourceFiles = [...scannedTextFiles, ...Object.values(dataFiles)];
  for (const filePath of sourceFiles) {
    const text = await fs.readFile(filePath, "utf8");
    if (/\bNRB\b/.test(text)) {
      fail(`Forbidden legacy label "NRB" found in ${path.relative(repoRoot, filePath)}.`);
    }

    if (/Associate Professor of Microbiology, Harvard Medical School/.test(text)) {
      fail(`Outdated Jonathan title found in ${path.relative(repoRoot, filePath)}.`);
    }

    if (/\bHHMI investigator\b/.test(text)) {
      fail(`Use "HHMI Investigator" capitalization in ${path.relative(repoRoot, filePath)}.`);
    }

    if (/\/assets\/images\/people\//.test(text)) {
      fail(`Lab-member photo reference found in ${path.relative(repoRoot, filePath)}.`);
    }

    for (const pattern of discouragedPlainLanguagePatterns) {
      const match = text.match(pattern);
      if (match) {
        fail(
          `Discouraged wording "${match[0]}" found in ${path.relative(repoRoot, filePath)}. Use plainer language.`
        );
      }
    }
  }

  const siteStrings = collectStrings(siteData);
  const jonathanStrings = collectStrings(jonathanProfile);
  const publicationStrings = collectStrings(publications);
  const newsStrings = collectStrings(newsItems);
  const peopleStrings = collectStrings(peopleData);
  const allStrings = [...siteStrings, ...jonathanStrings, ...publicationStrings, ...newsStrings, ...peopleStrings]
    .map(normalize)
    .filter(Boolean);

  const canonicalMarkers = [
    canonical.department,
    canonical.building,
    canonical.address,
    canonical.city,
    "Harvard Medical School",
    "HHMI Investigator"
  ];

  for (const marker of canonicalMarkers) {
    if (!allStrings.some((value) => value.includes(marker))) {
      note(`Marker not found in loaded content: "${marker}".`);
    }
  }

  addRhythmWarnings("siteData.description", siteData.description, note);
  addRhythmWarnings("siteData.heroTitle", siteData.heroTitle, note);
  addRhythmWarnings("siteData.heroDeck", siteData.heroDeck, note);
  addRhythmWarnings("siteData.institutionSummary", siteData.institutionSummary, note);
  addRhythmWarnings("siteData.tagline", siteData.tagline, note);

  addRhythmWarnings("jonathanProfile.overview", jonathanProfile.overview, note);
  for (const [index, paragraph] of (jonathanProfile.biography || []).entries()) {
    addRhythmWarnings(`jonathanProfile.biography[${index}]`, paragraph, note);
  }
  for (const [index, item] of (jonathanProfile.focusAreas || []).entries()) {
    addRhythmWarnings(`jonathanProfile.focusAreas[${index}]`, item, note);
  }

  for (const [index, publication] of publications.entries()) {
    addRhythmWarnings(`publications[${index}].significanceLine`, publication.significanceLine, note);
    addRhythmWarnings(`publications[${index}].summary`, publication.summary, note);
  }

  for (const [index, item] of newsItems.entries()) {
    addRhythmWarnings(`newsItems[${index}].summary`, item.summary, note);
  }

  for (const [index, person] of peopleData.currentMembers.entries()) {
    addRhythmWarnings(`peopleData.currentMembers[${index}].note`, person.note, note);
    addRhythmWarnings(`peopleData.currentMembers[${index}].roleSummary`, person.roleSummary, note);
  }

  if (errors.length) {
    console.error("Content validation failed:");
    for (const message of errors) {
      console.error(`- ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Content validation passed: ${publications.length} verified corresponding-author records, ${homepageProofPublications.length} homepage proof entries.`);
  if (warn.length) {
    for (const message of warn) {
      console.log(`Warning: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
