import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { acceptedSourceVariations } from "./lib/publication-metadata-variations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const userAgent = "AbrahamLabWebsite/1.0 (mailto:james_spencer@hms.harvard.edu)";

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

async function loadPublications() {
  const filePath = path.join(repoRoot, "src", "data", "publications.ts");
  const source = await fs.readFile(filePath, "utf8");
  return transpileTsModule(source, filePath).publications;
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": userAgent },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

function normalizeDoi(value) {
  return String(value || "").trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/<\/?(?:i|b|em|strong|sub|sup)>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[.,:;!?()[\]{}"'\u2018\u2019\u201c\u201d\u2010-\u2015-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthor(value) {
  return String(value).normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function localAuthors(publication) {
  return String(publication.authors || "").split(/,\s*/).filter(Boolean);
}

function normalizeJournal(value) {
  return normalizeTitle(value).replace(/^the /, "");
}

export function compareBibliography(publication, remote, source, acceptedVariations = []) {
  const issues = [];
  const label = `${source} DOI ${publication.doi || "missing"}`;
  const acceptReviewedVariation = (field, localValue, remoteValue, normalize) => {
    const sameValues = (left, right) => JSON.stringify(left.map(normalize)) === JSON.stringify(right.map(normalize));
    const rule = acceptedSourceVariations.find((item) => item.doi === normalizeDoi(publication.doi) && item.sources.includes(source) &&
      item.field === field && sameValues(item.local, localValue) && sameValues(item.remote, remoteValue));
    if (!rule) return false;
    acceptedVariations.push({ id: rule.id, doi: rule.doi, source, field, reviewedAt: rule.reviewedAt,
      sourceVersion: rule.sourceVersion, evidence: rule.evidence, reason: rule.reason });
    return true;
  };
  if (normalizeTitle(remote.title) !== normalizeTitle(publication.title)) {
    issues.push(`Title mismatch for ${label}: local ${publication.title}; source ${remote.title}`);
  }
  const authors = localAuthors(publication);
  if (authors.map(normalizeAuthor).join(";") !== remote.authors.map(normalizeAuthor).join(";") &&
    !acceptReviewedVariation("authors", authors, remote.authors, normalizeAuthor)) {
    issues.push(`Author list mismatch for ${label}: local ${authors.join(", ")}; source ${remote.authors.join(", ")}. Check version-specific front matter; do not merge author lists.`);
  }
  if (!remote.journals.some((journal) => normalizeJournal(journal) === normalizeJournal(publication.journal)) &&
    !acceptReviewedVariation("journal", [publication.journal], remote.journals, normalizeJournal)) {
    issues.push(`Journal mismatch for ${label}: local ${publication.journal}; source ${remote.journals.join(" / ")}`);
  }
  const localStatus = publication.articleType === "Preprint" ? "preprint" : "journal";
  if (remote.status !== "unknown" && remote.status !== localStatus) {
    issues.push(`Publication status mismatch for ${label}: local ${localStatus}; source ${remote.status}. Human verification required.`);
  }
  return issues;
}

function pubmedStatus(record) {
  // PubMed preprints can also carry "Journal Article". A PMID is not peer review.
  if (record.pubtype?.includes("Preprint") || /^(bio|med)rxiv$/i.test(record.source || "")) return "preprint";
  return record.pubtype?.includes("Journal Article") || record.pubtype?.some((type) => ["Editorial", "Comment", "Review"].includes(type))
    ? "journal" : "unknown";
}

function versionCandidate(publications, title, status) {
  const related = publications.filter((item) => normalizeTitle(item.title) === normalizeTitle(title));
  return {
    kind: related.length ? (status === "journal" && related.some((item) => item.articleType === "Preprint")
      ? "possible-journal-version" : "possible-version") : "new-work",
    relatedLocalDois: related.map((item) => normalizeDoi(item.doi)).filter(Boolean),
    publicationStatus: status
  };
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function requireCompleteSearch(records, count, source) {
  if (!Array.isArray(records) || count === undefined || count === null || count === "" || !Number.isInteger(Number(count)) || Number(count) < 0) {
    throw new Error(`${source} returned an invalid search response`);
  }
  if (Number(count) !== records.length) {
    throw new Error(`${source} returned ${records.length} of ${count} records; the search is incomplete`);
  }
  return records;
}

function requirePubMedRecord(summary, pmid) {
  const record = summary?.result?.[pmid];
  if (!record || record.error || typeof record.title !== "string" || !Array.isArray(record.articleids)) {
    throw new Error(`PubMed did not return complete metadata for PMID ${pmid}`);
  }
  return record;
}

function requireEuropePmcPreprint(record) {
  if (!record || record.source !== "PPR" || typeof record.doi !== "string" || !/^10\.\d{4,9}\/\S+$/.test(normalizeDoi(record.doi))) {
    throw new Error("Europe PMC returned invalid preprint source or DOI metadata");
  }
  // Core metadata names the server; bioRxiv and medRxiv share DOI prefixes.
  const publisher = record.bookOrReportDetails?.publisher;
  if (typeof publisher !== "string" || !publisher.trim()) {
    throw new Error("Europe PMC returned missing or malformed preprint provider metadata");
  }
  const provider = publisher.trim().toLowerCase();
  const knownNonBioRxivProviders = ["medrxiv", "research square", "psyarxiv", "authorea preprints", "f1000res", "preprints.org"];
  if (provider !== "biorxiv" && !knownNonBioRxivProviders.includes(provider)) {
    throw new Error(`Europe PMC returned an unknown preprint provider: ${publisher}`);
  }
  return { doi: normalizeDoi(record.doi), provider };
}

function requireBioRxivRecord(details, doi) {
  const records = details?.collection;
  if (!Array.isArray(records) || !records.length || details.messages?.some((item) => item.status !== "ok")) {
    throw new Error(`bioRxiv did not return metadata for DOI ${doi}`);
  }
  if (records.some((item) => normalizeDoi(item.doi) !== normalizeDoi(doi) || typeof item.title !== "string" || !item.title.trim() ||
    !/^[1-9]\d*$/.test(String(item.version))) || new Set(records.map((item) => Number(item.version))).size !== records.length) {
    throw new Error(`bioRxiv returned invalid metadata for DOI ${doi}`);
  }
  return [...records].sort((left, right) => Number(right.version) - Number(left.version))[0];
}

async function findPubMedCandidates(publications, localDois, localPmids, fromDate, toDate, getJson, sourceErrors) {
  const affiliation = '("Harvard Medical School"[Affiliation] OR "Howard Hughes Medical Institute"[Affiliation] OR "Brigham and Women\'s Hospital"[Affiliation])';
  const term = `Abraham Jonathan[Full Author Name] AND ${affiliation} AND ("${fromDate.replaceAll("-", "/")}"[Date - Publication] : "${toDate.replaceAll("-", "/")}"[Date - Publication])`;
  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  searchUrl.search = new URLSearchParams({ db: "pubmed", term, retmode: "json", retmax: "100", sort: "pub date" });
  const search = await getJson(searchUrl);
  const ids = requireCompleteSearch(search.esearchresult?.idlist, search.esearchresult?.count, "PubMed");
  if (!ids.length) return [];

  const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summaryUrl.search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" });
  const summary = await getJson(summaryUrl);

  return ids.flatMap((pmid) => {
    let record;
    try {
      record = requirePubMedRecord(summary, pmid);
    } catch (error) {
      sourceErrors.push(`PubMed candidate check failed: ${error.message}`);
      return [];
    }
    const doi = normalizeDoi(record.articleids?.find((item) => item.idtype === "doi")?.value);
    if (localPmids.has(String(pmid))) return [];
    const knownDoi = doi && localDois.has(doi);
    return [{
      source: "PubMed",
      title: record.title || "Untitled record",
      ...versionCandidate(publications, record.title, pubmedStatus(record)),
      ...(knownDoi ? { kind: "identifier-update", relatedLocalDois: [doi] } : {}),
      date: record.pubdate || "",
      onlineDate: record.epubdate || null,
      journal: record.fulljournalname || record.source || null,
      doi: doi || null,
      pmid: String(pmid),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    }];
  });
}

async function findBioRxivCandidates(publications, localDois, fromDate, toDate, getJson, sourceErrors) {
  const query = `SRC:PPR AND AUTH:"Abraham J" AND FIRST_PDATE:[${fromDate} TO ${toDate}]`;
  const searchUrl = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  searchUrl.search = new URLSearchParams({ query, format: "json", pageSize: "100", resultType: "core" });
  const search = await getJson(searchUrl);
  const possible = requireCompleteSearch(search.resultList?.result, search.hitCount, "Europe PMC preprint discovery");

  const candidates = [];
  for (const record of possible) {
    let doi;
    let provider;
    try {
      ({ doi, provider } = requireEuropePmcPreprint(record));
    } catch (error) {
      const id = typeof record?.id === "string" ? record.id : "unknown ID";
      const label = typeof record?.doi === "string" && record.doi ? record.doi : id;
      sourceErrors.push(`Europe PMC preprint metadata check failed for ${label}: ${error.message}`);
      continue;
    }
    if (provider !== "biorxiv" || localDois.has(doi)) continue;
    let item;
    try {
      const details = await getJson(`https://api.biorxiv.org/details/biorxiv/${doi}/na/json`);
      item = requireBioRxivRecord(details, doi);
      if (typeof item.author_corresponding !== "string" || typeof item.author_corresponding_institution !== "string") {
        throw new Error(`bioRxiv returned no corresponding-author metadata for DOI ${doi}`);
      }
    } catch (error) {
      sourceErrors.push(`bioRxiv candidate check failed for ${doi}: ${error.message}`);
      continue;
    }
    const corresponding = String(item?.author_corresponding || "").toLowerCase();
    const institution = String(item?.author_corresponding_institution || "").toLowerCase();
    if (!corresponding.includes("jonathan abraham") || !institution.includes("harvard")) continue;
    candidates.push({
      source: "bioRxiv",
      title: item.title || record.title || "Untitled record",
      ...versionCandidate(publications, item.title, "preprint"),
      date: item.date || record.firstPublicationDate || "",
      version: Number(item.version),
      doi,
      pmid: null,
      url: `https://www.biorxiv.org/content/${doi}v${item.version}`
    });
  }
  return candidates;
}

async function verifyPubMedMetadata(publications, getJson, sourceErrors, acceptedVariations) {
  const withPmids = publications.filter((item) => item.pmid);
  if (!withPmids.length) return [];
  const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summaryUrl.search = new URLSearchParams({
    db: "pubmed",
    id: withPmids.map((item) => item.pmid).join(","),
    retmode: "json"
  });
  const summary = await getJson(summaryUrl);
  const issues = [];

  for (const publication of withPmids) {
    let record;
    try {
      record = requirePubMedRecord(summary, publication.pmid);
    } catch (error) {
      sourceErrors.push(`PubMed metadata comparison failed: ${error.message}`);
      continue;
    }
    const remoteDoi = normalizeDoi(record.articleids?.find((item) => item.idtype === "doi")?.value);
    const remotePmcid = String(record.articleids?.find((item) => item.idtype === "pmc")?.value || "");
    if (remoteDoi && remoteDoi !== normalizeDoi(publication.doi)) {
      issues.push(`DOI mismatch for PMID ${publication.pmid}: local ${publication.doi || "missing"}; PubMed ${remoteDoi}`);
    }
    if (remotePmcid && remotePmcid !== String(publication.pmcid || "")) {
      issues.push(`PMCID mismatch for PMID ${publication.pmid}: local ${publication.pmcid || "missing"}; PubMed ${remotePmcid}`);
    }
    if (!record.authors?.length || record.authors.some((author) => typeof author.name !== "string" || !author.name.trim()) ||
      !(record.fulljournalname || record.source) || !record.pubtype?.length) {
      sourceErrors.push(`PubMed metadata comparison failed: incomplete title/author/journal/status metadata for PMID ${publication.pmid}`);
      continue;
    }
    issues.push(...compareBibliography(publication, {
      title: record.title,
      authors: record.authors.map((author) => author.name),
      journals: [record.fulljournalname, record.source].filter(Boolean),
      status: pubmedStatus(record)
    }, "PubMed", acceptedVariations));
  }
  return issues;
}

function crossrefDate(value) {
  const parts = value?.["date-parts"]?.[0];
  return Array.isArray(parts) && parts.length ? parts.map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("-") : null;
}

function requireCrossrefRecord(data, doi) {
  const record = data?.message;
  if (normalizeDoi(record?.DOI) !== normalizeDoi(doi) || !record?.title?.[0]?.trim() ||
    !record.author?.length || record.author.some((author) => !(author.family || author.name)) ||
    !["journal-article", "posted-content"].includes(record.type)) {
    throw new Error(`Crossref returned incomplete bibliographic metadata for DOI ${doi}`);
  }
  const journals = record.type === "posted-content" ? record.institution?.map((item) => item.name) : record["container-title"];
  if (!journals?.length || journals.some((journal) => typeof journal !== "string" || !journal.trim())) {
    throw new Error(`Crossref returned no journal/provider for DOI ${doi}`);
  }
  return {
    title: record.title[0],
    authors: record.author.map((author) => author.name || `${author.family} ${String(author.given || "").split(/[\s.-]+/).filter(Boolean).map((part) => part[0]).join("")}`),
    journals,
    status: record.type === "posted-content" ? "preprint" : "journal",
    onlineDate: crossrefDate(record["published-online"]),
    issueDate: crossrefDate(record["published-print"]),
    postedDate: crossrefDate(record.posted),
    relations: record.relation || {}
  };
}

async function verifyCrossrefMetadata(publications, candidates, publishedPreprints, getJson, sourceErrors, issues, acceptedVariations) {
  const dates = [];
  const dois = new Set([...publications.map((item) => item.doi), ...candidates.map((item) => item.doi),
    ...publishedPreprints.map((item) => item.publishedDoi)].filter(Boolean).map(normalizeDoi));
  for (const doi of dois) {
    try {
      const remote = requireCrossrefRecord(await getJson(`https://api.crossref.org/works/${doi}`), doi);
      dates.push({ doi, onlineDate: remote.onlineDate, issueDate: remote.issueDate, postedDate: remote.postedDate });
      for (const publication of publications.filter((item) => normalizeDoi(item.doi) === doi)) {
        issues.push(...compareBibliography(publication, remote, "Crossref", acceptedVariations));
        if (publication.articleType === "Preprint") {
          for (const relation of remote.relations["is-preprint-of"] || []) {
            const publishedDoi = normalizeDoi(relation.id);
            if (relation["id-type"] !== "doi" || !/^10\.\d{4,9}\/\S+$/.test(publishedDoi) || publishedDoi === doi) {
              throw new Error(`Crossref returned an invalid journal-version relation for ${doi}`);
            }
            const existing = publishedPreprints.find((item) => normalizeDoi(item.preprintDoi) === doi && item.publishedDoi === publishedDoi);
            if (existing) existing.sources = [...new Set([...existing.sources, "Crossref"])];
            else publishedPreprints.push({ title: publication.title, preprintDoi: doi, publishedDoi, sources: ["Crossref"] });
            dois.add(publishedDoi);
          }
        }
      }
      for (const candidate of candidates.filter((item) => normalizeDoi(item.doi) === doi)) {
        candidate.crossref = remote;
        if (normalizeTitle(candidate.title) !== normalizeTitle(remote.title)) {
          issues.push(`Candidate title mismatch for DOI ${doi}: ${candidate.source} ${candidate.title}; Crossref ${remote.title}`);
        }
        if (candidate.publicationStatus !== "unknown" && candidate.publicationStatus !== remote.status) {
          issues.push(`Candidate publication status disagreement for DOI ${doi}: ${candidate.source} ${candidate.publicationStatus}; Crossref ${remote.status}`);
        }
        // This is an evidence label, not approval to replace the local entry.
        if (candidate.publicationStatus === "unknown") Object.assign(candidate, versionCandidate(publications, candidate.title, remote.status));
      }
      for (const transition of publishedPreprints.filter((item) => item.publishedDoi === doi)) {
        transition.crossref = remote;
        if (remote.status !== "journal") issues.push(`Published-version relation does not target a journal record: ${transition.preprintDoi} -> ${doi}`);
      }
    } catch (error) {
      sourceErrors.push(`Crossref metadata comparison failed for ${doi}: ${error.message}`);
    }
  }
  return dates;
}

async function findPublishedPreprints(publications, getJson, sourceErrors, issues, versionUpdates, acceptedVariations) {
  const updates = [];
  for (const publication of publications.filter((item) => item.articleType === "Preprint" && item.doi)) {
    try {
      const details = await getJson(`https://api.biorxiv.org/details/biorxiv/${publication.doi}/na/json`);
      const item = requireBioRxivRecord(details, publication.doi);
      const pinnedVersion = Number(publication.link?.match(/v(\d+)(?:[./?#]|$)/)?.[1]) || null;
      const cited = pinnedVersion ? details.collection.find((record) => Number(record.version) === pinnedVersion) : item;
      if (!cited) throw new Error(`bioRxiv did not return cited version ${pinnedVersion} for ${publication.doi}`);
      if (pinnedVersion && Number(item.version) > pinnedVersion) {
        versionUpdates.push({ title: publication.title, doi: publication.doi, localVersion: pinnedVersion,
          latestVersion: Number(item.version), date: item.date || null,
          url: `https://www.biorxiv.org/content/${publication.doi}v${item.version}` });
      }
      if (typeof cited.authors !== "string" || !cited.authors.trim()) throw new Error(`bioRxiv returned no authors for ${publication.doi}`);
      issues.push(...compareBibliography(publication, { title: cited.title, authors: cited.authors.split(/;\s*/).filter(Boolean),
        journals: ["bioRxiv"], status: "preprint" }, `bioRxiv v${cited.version}`, acceptedVariations));
      if (typeof item.published !== "string" || !item.published.trim()) {
        throw new Error(`bioRxiv returned no publication status for DOI ${publication.doi}`);
      }
      const publishedDoi = normalizeDoi(item.published);
      if (publishedDoi !== "na") {
        if (!/^10\.\d{4,9}\/\S+$/.test(publishedDoi)) throw new Error(`bioRxiv returned an invalid published DOI for ${publication.doi}`);
        updates.push({ title: publication.title, preprintDoi: publication.doi, publishedDoi, version: Number(item.version), sources: ["bioRxiv"] });
      }
    } catch (error) {
      sourceErrors.push(`bioRxiv publication-status check failed for ${publication.doi}: ${error.message}`);
    }
  }
  return updates;
}

export function renderMarkdown(report) {
  const plain = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replace(/[\r\n]+/g, " ").replace(/([\\`*_[\]])/g, "\\$1").replaceAll("@", "&#64;");
  const lines = [
    "# Abraham Lab publication check",
    "",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status === "incomplete" ? "INCOMPLETE" : "Complete"}`,
    "",
    `Local records: ${report.localRecordCount}`,
    `Candidates for review: ${report.candidates.length}`,
    `Preprints with a published DOI: ${report.publishedPreprints.length}`,
    `Newer preprint versions: ${report.versionUpdates.length}`,
    `Local metadata issues: ${report.localIssues.length}`,
    `Remote metadata differences: ${report.remoteMetadataIssues.length}`,
    `Previously reviewed source variations: ${(report.acceptedMetadataVariations || []).length}`,
    "",
    "The report is read-only. Human approval is required for every citation, status, authorship and summary change. Confirm corresponding-author eligibility and version-specific publisher front matter before changing the site. A PMID does not establish peer review. Never advance the publication review date from an automated run."
  ];

  if (report.status === "incomplete") {
    lines.push("", "**This check is incomplete. Results below are partial; additional changes may remain undetected. Do not advance the publication review date.**");
  }

  if (report.candidates.length) {
    lines.push("", "## Candidate records");
    for (const item of report.candidates) {
      const ids = [item.doi && `DOI ${item.doi}`, item.pmid && `PMID ${item.pmid}`].filter(Boolean).join("; ");
      lines.push(`- ${plain(item.title)} - ${plain(item.source)}; ${plain(item.kind)}; status evidence: ${plain(item.publicationStatus)}${item.date ? `; ${plain(item.date)}` : ""}${ids ? `; ${plain(ids)}` : ""}`);
      if (item.relatedLocalDois.length) lines.push(`  Possible same work, separate version: ${item.relatedLocalDois.map(plain).join(", ")}. Title similarity alone is not confirmation.`);
      if (item.crossref) lines.push(`  Crossref: ${plain(item.crossref.journals.join(" / "))}; online ${plain(item.crossref.onlineDate || "unassigned")}; issue ${plain(item.crossref.issueDate || "unassigned")}.`);
    }
  }

  if (report.publishedPreprints.length) {
    lines.push("", "## Preprints with published versions");
    for (const item of report.publishedPreprints) {
      lines.push(`- ${plain(item.title)} - ${plain(item.preprintDoi)} -> ${plain(item.publishedDoi)} (review publisher record before replacement)`);
    }
  }

  if (report.versionUpdates.length) {
    lines.push("", "## Newer preprint versions");
    for (const item of report.versionUpdates) lines.push(`- ${plain(item.title)} - ${plain(item.doi)}: cited v${item.localVersion}; newest v${item.latestVersion}. This is not a journal transition.`);
  }

  if (report.localIssues.length) {
    lines.push("", "## Local metadata issues", ...report.localIssues.map((item) => `- ${plain(item)}`));
  }

  if (report.remoteMetadataIssues.length) {
    lines.push("", "## Remote metadata differences", ...report.remoteMetadataIssues.map((item) => `- ${plain(item)}`));
  }

  if (report.acceptedMetadataVariations?.length) {
    lines.push("", "## Accepted source-specific variations");
    for (const item of report.acceptedMetadataVariations) {
      lines.push(`- ${plain(item.source)}; DOI ${plain(item.doi)}; ${plain(item.field)}; reviewed ${plain(item.reviewedAt)} against ${plain(item.sourceVersion)}. ${plain(item.reason)}`);
      lines.push(`  Evidence: ${item.evidence.map(plain).join("; ")}`);
    }
  }

  if (report.sourceErrors.length) {
    lines.push("", "## Failed source checks", ...report.sourceErrors.map((item) => `- ${plain(item)}`));
  }

  if (report.status === "complete" && !report.candidates.length && !report.publishedPreprints.length && !report.versionUpdates.length && !report.localIssues.length && !report.remoteMetadataIssues.length) {
    lines.push("", "No publication changes require review.");
  }

  return `${lines.join("\n")}\n`;
}

export async function collectPublicationReport({ publications, fetchImpl = globalThis.fetch, now = new Date() }) {
  const cache = new Map();
  const getJson = (url) => {
    const key = String(url);
    if (!cache.has(key)) cache.set(key, fetchJson(url, fetchImpl));
    return cache.get(key);
  };
  const localDois = new Set(publications.map((item) => normalizeDoi(item.doi)).filter(Boolean));
  const localPmids = new Set(publications.map((item) => String(item.pmid || "")).filter(Boolean));
  const localIssues = [];
  const sourceErrors = [];

  for (const publication of publications) {
    if (!publication.doi) localIssues.push(`Missing DOI: ${publication.title}`);
    for (const field of ["title", "authors", "journal"]) {
      if (typeof publication[field] !== "string" || !publication[field].trim()) localIssues.push(`Missing ${field}: ${publication.doi || publication.title}`);
    }
    if (publication.articleType !== "Preprint" && !publication.pmid) {
      localIssues.push(`Missing PMID: ${publication.title}`);
    }
  }

  const from = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  const fromDate = isoDate(from);
  const toDate = isoDate(to);

  let pubmedCandidates = [];
  let biorxivCandidates = [];
  let publishedPreprints = [];
  let remoteMetadataIssues = [];
  const versionUpdates = [];
  const acceptedMetadataVariations = [];
  try {
    pubmedCandidates = await findPubMedCandidates(publications, localDois, localPmids, fromDate, toDate, getJson, sourceErrors);
  } catch (error) {
    sourceErrors.push(`PubMed check failed: ${error.message}`);
  }
  try {
    biorxivCandidates = await findBioRxivCandidates(publications, localDois, fromDate, toDate, getJson, sourceErrors);
  } catch (error) {
    sourceErrors.push(`bioRxiv discovery failed: ${error.message}`);
  }
  try {
    publishedPreprints = await findPublishedPreprints(publications, getJson, sourceErrors, remoteMetadataIssues, versionUpdates, acceptedMetadataVariations);
  } catch (error) {
    sourceErrors.push(`bioRxiv publication-status check failed: ${error.message}`);
  }
  try {
    remoteMetadataIssues.push(...await verifyPubMedMetadata(publications, getJson, sourceErrors, acceptedMetadataVariations));
  } catch (error) {
    sourceErrors.push(`PubMed metadata comparison failed: ${error.message}`);
  }

  const candidateMap = new Map();
  for (const item of [...pubmedCandidates, ...biorxivCandidates]) {
    const key = item.doi ? `doi:${item.doi}` : `pmid:${item.pmid}`;
    const previous = candidateMap.get(key);
    if (previous) {
      previous.sources = [...new Set([...previous.sources, item.source])];
      previous.pmid ||= item.pmid;
      if (previous.publicationStatus !== "unknown" && item.publicationStatus !== "unknown" && previous.publicationStatus !== item.publicationStatus) {
        remoteMetadataIssues.push(`Candidate publication status disagreement for ${key}: ${previous.source} ${previous.publicationStatus}; ${item.source} ${item.publicationStatus}`);
      }
    } else candidateMap.set(key, { ...item, sources: [item.source] });
  }
  const candidates = [...candidateMap.values()].sort((left, right) => (Date.parse(right.date) || 0) - (Date.parse(left.date) || 0));
  const remoteDates = await verifyCrossrefMetadata(publications, candidates, publishedPreprints, getJson, sourceErrors, remoteMetadataIssues, acceptedMetadataVariations);

  return {
    status: sourceErrors.length ? "incomplete" : "complete",
    generatedAt: now.toISOString(),
    queryWindow: { from: fromDate, to: toDate },
    localRecordCount: publications.length,
    candidates,
    publishedPreprints,
    versionUpdates,
    remoteDates,
    acceptedMetadataVariations,
    localIssues,
    remoteMetadataIssues,
    sourceErrors
  };
}

export function reportExitCode(report) {
  return report.sourceErrors.length || report.localIssues.length || report.remoteMetadataIssues.length ? 1 : 0;
}

export async function writePublicationReport(report, {
  outputDir = path.join(repoRoot, "output", "publication-check"),
  summaryPath = process.env.GITHUB_STEP_SUMMARY
} = {}) {
  const markdown = renderMarkdown(report);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "report.md"), markdown);
  await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (summaryPath) await fs.appendFile(summaryPath, markdown);
  return markdown;
}

async function main() {
  const report = await collectPublicationReport({ publications: await loadPublications() });
  const markdown = await writePublicationReport(report);
  process.stdout.write(markdown);
  const annotation = (value) => String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  for (const item of [...report.candidates, ...report.publishedPreprints, ...report.versionUpdates]) {
    console.log(`::warning title=Publication review::${annotation(item.title)}`);
  }
  for (const item of [...report.localIssues, ...report.remoteMetadataIssues, ...report.sourceErrors]) {
    console.error(`::error title=Publication check::${annotation(item)}`);
  }
  process.exitCode = reportExitCode(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
