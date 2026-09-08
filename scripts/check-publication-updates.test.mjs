import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareBibliography,
  collectPublicationReport,
  renderMarkdown,
  reportExitCode,
  writePublicationReport
} from "./check-publication-updates.mjs";
import { acceptedSourceVariations } from "./lib/publication-metadata-variations.mjs";

const now = new Date("2026-09-05T12:00:00.000Z");
const journal = { title: "Existing journal fixture", authors: "Example A, Abraham J", journal: "Nature", doi: "10.1000/journal", pmid: "1", articleType: "Research article" };
const preprint = { title: "Existing preprint fixture", authors: journal.authors, journal: "bioRxiv", doi: "10.1101/2026.01.01.123456", articleType: "Preprint",
  link: "https://www.biorxiv.org/content/10.1101/2026.01.01.123456v1" };
const candidateDoi = "10.1101/2026.02.01.123456";

function discoveryRecord(doi, extra = {}) {
  return { source: "PPR", doi, bookOrReportDetails: { publisher: "bioRxiv" }, ...extra };
}

function bioRxivRecord(doi, extra = {}) {
  return {
    doi,
    title: doi === preprint.doi ? preprint.title : "Candidate fixture",
    authors: "Example, A.; Abraham, J.",
    version: "1",
    published: "NA",
    author_corresponding: "Jonathan Abraham",
    author_corresponding_institution: "Harvard Medical School",
    ...extra
  };
}

function pubmedRecord(extra = {}) {
  return { title: journal.title, authors: [{ name: "Example A" }, { name: "Abraham J" }], fulljournalname: journal.journal,
    source: journal.journal, pubtype: ["Journal Article"], articleids: [{ idtype: "doi", value: journal.doi }], ...extra };
}

function crossrefRecord(doi, extra = {}) {
  const isPreprint = /10\.(?:1101|64898)\//.test(doi);
  return { message: { DOI: doi, title: [doi === preprint.doi ? preprint.title : doi === journal.doi ? journal.title : "Candidate fixture"],
    author: [{ given: "Alice", family: "Example" }, { given: "Jonathan", family: "Abraham" }],
    type: isPreprint ? "posted-content" : "journal-article", "container-title": isPreprint ? [] : ["Nature"],
    institution: isPreprint ? [{ name: "bioRxiv" }] : [], ...extra } };
}

function fixtureFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(input);
    calls.push(url);
    let payload;
    if (url.hostname === "eutils.ncbi.nlm.nih.gov" && url.pathname.endsWith("esearch.fcgi")) {
      payload = overrides.pubmedSearch ?? { esearchresult: { count: "0", idlist: [] } };
    } else if (url.hostname === "eutils.ncbi.nlm.nih.gov" && url.pathname.endsWith("esummary.fcgi")) {
      payload = overrides.pubmedSummary ?? {
        result: { "1": pubmedRecord() }
      };
    } else if (url.hostname === "www.ebi.ac.uk") {
      payload = overrides.discovery ?? { hitCount: 0, resultList: { result: [] } };
    } else if (url.hostname === "api.biorxiv.org") {
      const doi = url.pathname.replace("/details/biorxiv/", "").replace("/na/json", "");
      payload = overrides.details ?? { messages: [{ status: "ok" }], collection: [bioRxivRecord(doi)] };
    } else if (url.hostname === "api.crossref.org") {
      const doi = url.pathname.replace("/works/", "");
      payload = overrides.crossref ?? crossrefRecord(doi);
    } else {
      throw new Error(`Unexpected fixture URL: ${url}`);
    }
    if (typeof payload === "function") payload = await payload(url);
    return payload instanceof Response ? payload : Response.json(payload);
  };
  return { calls, fetchImpl };
}

async function check(overrides = {}, publications = [journal, preprint]) {
  const fixture = fixtureFetch(overrides);
  const report = await collectPublicationReport({ publications, fetchImpl: fixture.fetchImpl, now });
  return { report, calls: fixture.calls };
}

test("a complete check with no changes succeeds", async () => {
  const { report } = await check();
  assert.equal(report.status, "complete");
  assert.equal(report.generatedAt, now.toISOString());
  assert.equal(reportExitCode(report), 0);
  assert.deepEqual(report.sourceErrors, []);
  assert.match(renderMarkdown(report), /No publication changes require review\./);
});

test("an unavailable required source fails but does not stop independent checks", async () => {
  const { report, calls } = await check({ pubmedSearch: () => new Response("Unavailable", { status: 503 }) });
  assert.equal(report.status, "incomplete");
  assert.equal(reportExitCode(report), 1);
  assert.match(report.sourceErrors[0], /PubMed check failed: 503/);
  assert.ok(calls.some((url) => url.hostname === "www.ebi.ac.uk"));
  assert.ok(calls.some((url) => url.hostname === "api.biorxiv.org"));
  assert.ok(calls.some((url) => url.pathname.endsWith("esummary.fcgi")));
  const markdown = renderMarkdown(report);
  assert.match(markdown, /Status: INCOMPLETE/);
  assert.match(markdown, /Do not advance the publication review date/);
  assert.doesNotMatch(markdown, /No publication changes require review/);
});

test("a transport failure in preprint discovery produces an incomplete result", async () => {
  const { report } = await check({ discovery: () => { throw new Error("Offline fixture"); } });
  assert.equal(report.status, "incomplete");
  assert.equal(reportExitCode(report), 1);
  assert.match(report.sourceErrors.join("\n"), /bioRxiv discovery failed: Offline fixture/);
});

test("an API error delivered with HTTP 200 is not an empty successful search", async () => {
  for (const overrides of [
    { pubmedSearch: { error: "Source error" } },
    { discovery: { error: "Source error" } },
    { details: { messages: [{ status: "no posts found" }], collection: [] } }
  ]) {
    const { report } = await check(overrides);
    assert.equal(report.status, "incomplete");
    assert.equal(reportExitCode(report), 1);
    assert.doesNotMatch(renderMarkdown(report), /No publication changes require review/);
  }
});

test("invalid JSON is a source failure", async () => {
  const { report } = await check({ discovery: () => new Response("not-json") });
  assert.equal(report.status, "incomplete");
  assert.equal(reportExitCode(report), 1);
});

test("truncated search responses cannot be reported as complete", async () => {
  for (const overrides of [
    { pubmedSearch: { esearchresult: { count: "101", idlist: ["1"] } } },
    { discovery: { hitCount: 101, resultList: { result: [] } } }
  ]) {
    const { report } = await check(overrides);
    assert.equal(report.status, "incomplete");
    assert.match(report.sourceErrors.join("\n"), /the search is incomplete/);
  }
});

test("missing requested PubMed records fail discovery and metadata checks", async () => {
  const { report } = await check({
    pubmedSearch: { esearchresult: { count: "1", idlist: ["1"] } },
    pubmedSummary: { result: {} }
  });
  assert.equal(report.status, "incomplete");
  assert.equal(report.sourceErrors.length, 2);
  assert.equal(reportExitCode(report), 1);
});

test("a partial report retains candidates from a source that completed", async () => {
  const { report } = await check({
    pubmedSearch: () => { throw new Error("Offline fixture"); },
    discovery: { hitCount: 1, resultList: { result: [discoveryRecord(candidateDoi)] } }
  });
  assert.equal(report.status, "incomplete");
  assert.equal(report.candidates[0].doi, candidateDoi);
  assert.match(renderMarkdown(report), /Candidate fixture/);
});

test("a missing PubMed candidate does not discard other returned records", async () => {
  const { report } = await check({
    pubmedSearch: { esearchresult: { count: "2", idlist: ["2", "3"] } },
    pubmedSummary: { result: {
      "2": { title: "Journal candidate fixture", articleids: [{ idtype: "doi", value: "10.1000/new" }] }
    } }
  }, []);
  assert.equal(report.status, "incomplete");
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].pmid, "2");
  assert.equal(reportExitCode(report), 1);
});

test("one failed preprint candidate does not discard another verified candidate", async () => {
  const failingDoi = "10.1101/2026.03.01.123456";
  const { report } = await check({
    discovery: { hitCount: 2, resultList: { result: [discoveryRecord(failingDoi), discoveryRecord(candidateDoi)] } },
    details: (url) => {
      if (url.pathname.includes(failingDoi)) throw new Error("Offline fixture");
      const doi = url.pathname.includes(candidateDoi) ? candidateDoi : preprint.doi;
      return { collection: [bioRxivRecord(doi)] };
    }
  });
  assert.equal(report.status, "incomplete");
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].doi, candidateDoi);
});

test("publication-status checks keep successful results after a per-record failure", async () => {
  const otherPreprint = { ...preprint, doi: candidateDoi };
  const { report } = await check({
    details: (url) => {
      if (url.pathname.includes(preprint.doi)) throw new Error("Offline fixture");
      return { collection: [bioRxivRecord(candidateDoi, { published: "10.1000/published" })] };
    }
  }, [preprint, otherPreprint]);
  assert.equal(report.status, "incomplete");
  assert.equal(report.publishedPreprints.length, 1);
  assert.equal(report.publishedPreprints[0].publishedDoi, "10.1000/published");
});

test("publication status uses the newest returned version", async () => {
  const { report } = await check({ details: {
    collection: [
      bioRxivRecord(preprint.doi),
      bioRxivRecord(preprint.doi, { version: "2", published: "https://doi.org/10.1000/published" })
    ]
  } });
  assert.equal(report.status, "complete");
  assert.equal(report.publishedPreprints[0].publishedDoi, "10.1000/published");
  assert.equal(reportExitCode(report), 0);
});

test("missing or malformed publication status is not treated as unpublished", async () => {
  for (const published of [undefined, "", "unavailable"]) {
    const { report } = await check({ details: { collection: [bioRxivRecord(preprint.doi, { published })] } });
    assert.equal(report.status, "incomplete");
    assert.equal(reportExitCode(report), 1);
  }
});

test("candidates require human review but do not make a completed source check fail", async () => {
  const { report } = await check({ discovery: { hitCount: 1, resultList: { result: [discoveryRecord(candidateDoi)] } } });
  assert.equal(report.status, "complete");
  assert.equal(reportExitCode(report), 0);
  assert.equal(report.candidates.length, 1);
  assert.doesNotMatch(renderMarkdown(report), /No publication changes require review/);
});

test("Europe PMC medRxiv metadata excludes both shared DOI prefixes before bioRxiv requests", async () => {
  const records = [
    "10.64898/2026.07.27.26350454",
    "10.64898/2026.04.26.26351792",
    "10.64898/2026.01.12.26343538",
    "10.1101/2025.05.23.25328255"
  ].map((doi) => discoveryRecord(doi, { bookOrReportDetails: { publisher: "medRxiv" } }));
  const { report, calls } = await check({ discovery: { hitCount: records.length, resultList: { result: records } } }, []);
  assert.equal(report.status, "complete");
  assert.equal(reportExitCode(report), 0);
  assert.deepEqual(report.sourceErrors, []);
  assert.deepEqual(report.candidates, []);
  assert.equal(calls.filter((url) => url.hostname === "api.biorxiv.org").length, 0);
});

test("other explicitly recognized Europe PMC providers are excluded", async () => {
  const records = ["Research Square", "PsyArXiv", "Authorea Preprints", "F1000Res", "Preprints.org", " MEDRXIV "]
    .map((publisher, index) => discoveryRecord(`10.1000/provider-${index}`, { bookOrReportDetails: { publisher } }));
  const { report, calls } = await check({ discovery: { hitCount: records.length, resultList: { result: records } } }, []);
  assert.equal(report.status, "complete");
  assert.deepEqual(report.sourceErrors, []);
  assert.deepEqual(report.candidates, []);
  assert.equal(calls.filter((url) => url.hostname === "api.biorxiv.org").length, 0);
});

test("identified bioRxiv records with either DOI prefix are verified through bioRxiv", async () => {
  const dois = [candidateDoi, "10.64898/2026.08.22.744730"];
  const records = dois.map((doi) => discoveryRecord(doi, { bookOrReportDetails: { publisher: " BIORXIV " } }));
  const { report, calls } = await check({ discovery: { hitCount: records.length, resultList: { result: records } } }, []);
  assert.equal(report.status, "complete");
  assert.equal(reportExitCode(report), 0);
  assert.deepEqual(report.sourceErrors, []);
  assert.deepEqual(report.candidates.map((item) => item.doi), dois);
  assert.ok(report.candidates.every((item) => item.source === "bioRxiv" && item.title === "Candidate fixture"));
  assert.deepEqual(calls.filter((url) => url.hostname === "api.biorxiv.org").map((url) => url.pathname),
    dois.map((doi) => `/details/biorxiv/${doi}/na/json`));
  assert.equal(calls.find((url) => url.hostname === "www.ebi.ac.uk").searchParams.get("resultType"), "core");
});

test("provider identification does not replace bioRxiv record and corresponding-author verification", async () => {
  for (const details of [
    { messages: [{ status: "no posts found" }], collection: [] },
    { collection: [bioRxivRecord("10.1000/wrong")] },
    { collection: [bioRxivRecord(candidateDoi, { author_corresponding: undefined })] },
    { collection: [bioRxivRecord(candidateDoi, { author_corresponding_institution: undefined })] }
  ]) {
    const { report } = await check({
      discovery: { hitCount: 1, resultList: { result: [discoveryRecord(candidateDoi)] } }, details
    }, []);
    assert.equal(report.status, "incomplete");
    assert.equal(reportExitCode(report), 1);
    assert.equal(report.candidates.length, 0);
    assert.match(report.sourceErrors[0], /bioRxiv candidate check failed/);
  }
});

test("malformed or unknown preprint metadata fails honestly without discarding verified candidates", async () => {
  const invalidRecords = [
    null,
    {},
    discoveryRecord(candidateDoi, { source: undefined }),
    discoveryRecord(candidateDoi, { source: "MED" }),
    discoveryRecord(undefined),
    discoveryRecord(""),
    discoveryRecord(123),
    discoveryRecord("not-a-doi"),
    discoveryRecord(candidateDoi, { bookOrReportDetails: undefined }),
    ...[undefined, "", " ", 123, [], "unknown", "Unrecognized server", "bioRxiv / medRxiv"]
      .map((publisher) => discoveryRecord(candidateDoi, { bookOrReportDetails: { publisher } })),
    discoveryRecord("10.1000/no-prefix-fallback", { bookOrReportDetails: undefined }),
    discoveryRecord(undefined, { bookOrReportDetails: { publisher: "medRxiv" } })
  ];
  for (const record of invalidRecords) {
    const { report, calls } = await check({
      discovery: { hitCount: 2, resultList: { result: [record, discoveryRecord(candidateDoi)] } }
    }, []);
    assert.equal(report.status, "incomplete", JSON.stringify(record));
    assert.equal(reportExitCode(report), 1);
    assert.equal(report.sourceErrors.length, 1);
    assert.match(report.sourceErrors[0], /Europe PMC preprint metadata check failed/);
    assert.deepEqual(report.candidates.map((item) => item.doi), [candidateDoi]);
    assert.equal(calls.filter((url) => url.hostname === "api.biorxiv.org").length, 1);
    const markdown = renderMarkdown(report);
    assert.match(markdown, /Status: INCOMPLETE/);
    assert.match(markdown, /Do not advance the publication review date/);
    assert.doesNotMatch(markdown, /No publication changes require review/);
  }
});

test("known local bioRxiv DOIs are not fetched again by discovery", async () => {
  const { report, calls } = await check({ discovery: {
    hitCount: 1, resultList: { result: [discoveryRecord(preprint.doi)] }
  } });
  assert.equal(report.status, "complete");
  assert.equal(report.candidates.length, 0);
  // The existing publication-status check still makes its one required request.
  assert.equal(calls.filter((url) => url.hostname === "api.biorxiv.org").length, 1);
});

test("metadata problems remain distinct from unavailable sources and fail validation", async () => {
  const { report } = await check({}, [{ ...journal, doi: "10.1000/wrong" }]);
  assert.equal(report.status, "complete");
  assert.equal(report.sourceErrors.length, 0);
  assert.match(report.remoteMetadataIssues[0], /DOI mismatch/);
  assert.equal(reportExitCode(report), 1);
  const local = await check({}, [{ ...journal, doi: undefined }]);
  assert.match(local.report.localIssues[0], /Missing DOI/);
  assert.equal(reportExitCode(local.report), 1);
});

test("partial JSON, Markdown and workflow summary are saved before failure is returned", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "abraham-publication-check-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { report } = await check({ discovery: () => { throw new Error("Offline fixture"); } });
  const summaryPath = path.join(directory, "summary.md");
  await writePublicationReport(report, { outputDir: directory, summaryPath });
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, "report.json"), "utf8")), report);
  const markdown = await fs.readFile(path.join(directory, "report.md"), "utf8");
  assert.match(markdown, /Status: INCOMPLETE/);
  assert.equal(await fs.readFile(summaryPath, "utf8"), markdown);
  assert.equal(reportExitCode(report), 1);
});

test("unchanged-title journal DOI is a possible version even when bioRxiv still reports NA", async () => {
  const doi = "10.1000/successor";
  const { report } = await check({
    pubmedSearch: { esearchresult: { count: "1", idlist: ["2"] } },
    pubmedSummary: { result: { "1": pubmedRecord(), "2": pubmedRecord({ title: `${preprint.title}.`, articleids: [{ idtype: "doi", value: doi }] }) } },
    crossref: (url) => crossrefRecord(url.pathname.replace("/works/", ""), url.pathname.includes("successor") ? { title: [preprint.title] } : {})
  });
  assert.equal(report.status, "complete");
  assert.equal(reportExitCode(report), 0);
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].kind, "possible-journal-version");
  assert.deepEqual(report.candidates[0].relatedLocalDois, [preprint.doi]);
  assert.equal(report.candidates[0].crossref.status, "journal");
  assert.equal(report.publishedPreprints.length, 0);
  assert.match(renderMarkdown(report), /Title similarity alone is not confirmation/);
});

test("same title alone never proves identity or suppresses a different DOI", async () => {
  const { report } = await check({
    discovery: { hitCount: 1, resultList: { result: [discoveryRecord(candidateDoi)] } },
    details: (url) => ({ collection: [bioRxivRecord(url.pathname.includes(candidateDoi) ? candidateDoi : preprint.doi, { title: preprint.title })] }),
    crossref: (url) => crossrefRecord(url.pathname.replace("/works/", ""), url.pathname.includes(candidateDoi) ? { title: [preprint.title] } : {})
  });
  assert.equal(report.candidates[0].kind, "possible-version");
  assert.equal(report.candidates[0].publicationStatus, "preprint");
});

test("matching identifiers do not hide title, author or journal mismatches", async () => {
  for (const [field, change, message] of [
    ["title", "A meaningfully different title", /Title mismatch/],
    ["authors", [{ name: "Abraham J" }, { name: "Example A" }], /Author list mismatch/],
    ["fulljournalname", "Another Journal", /Journal mismatch/]
  ]) {
    const { report } = await check({ pubmedSummary: { result: { "1": pubmedRecord({ [field]: change, ...(field === "fulljournalname" ? { source: change } : {}) }) } } });
    assert.equal(report.status, "complete");
    assert.match(report.remoteMetadataIssues.join("\n"), message);
    assert.equal(reportExitCode(report), 1);
  }
});

test("normalization ignores harmless typography but retains Greek letters, digits and plus signs", async () => {
  const { report } = await check({ pubmedSummary: { result: { "1": pubmedRecord({ title: "Existing JOURNAL fixture.",
    authors: [{ name: "Example A." }, { name: "Abraham J." }], fulljournalname: "The Nature", source: "The Nature" }) } } });
  assert.equal(reportExitCode(report), 0);
  for (const [local, remote] of [["alpha \u03b1", "alpha \u03b2"], ["Type 1", "Type 2"], ["A+B", "A B"]]) {
    const result = await check({ pubmedSummary: { result: { "1": pubmedRecord({ title: remote }) } },
      crossref: crossrefRecord(journal.doi, { title: [local] }) }, [{ ...journal, title: local }]);
    assert.match(result.report.remoteMetadataIssues.join("\n"), /Title mismatch/);
  }
});

test("PMID plus Journal Article plus Preprint remains a preprint", async () => {
  const indexed = { ...preprint, pmid: "1" };
  const { report } = await check({ pubmedSummary: { result: { "1": pubmedRecord({ title: preprint.title,
    fulljournalname: "bioRxiv : the preprint server for biology", source: "bioRxiv", pubtype: ["Journal Article", "Preprint"],
    articleids: [{ idtype: "doi", value: preprint.doi }] }) } } }, [indexed]);
  assert.equal(reportExitCode(report), 0);
  assert.equal(report.publishedPreprints.length, 0);
});

test("wrong local publication status is flagged independently of identifiers", async () => {
  const { report } = await check({ pubmedSummary: { result: { "1": pubmedRecord({ pubtype: ["Journal Article", "Preprint"] }) } } });
  assert.match(report.remoteMetadataIssues.join("\n"), /Publication status mismatch/);
  assert.equal(reportExitCode(report), 1);
});

test("a newly indexed known DOI is an identifier update, not a duplicate or new work", async () => {
  const { report } = await check({ pubmedSearch: { esearchresult: { count: "1", idlist: ["2"] } },
    pubmedSummary: { result: { "2": pubmedRecord({ title: preprint.title, source: "bioRxiv", pubtype: ["Preprint"],
      articleids: [{ idtype: "doi", value: preprint.doi }] }) } } }, [preprint]);
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].kind, "identifier-update");
  assert.equal(report.candidates[0].pmid, "2");
});

test("cross-source candidates deduplicate by DOI while retaining source and PMID evidence", async () => {
  const { report } = await check({ pubmedSearch: { esearchresult: { count: "1", idlist: ["2"] } },
    pubmedSummary: { result: { "2": pubmedRecord({ title: "Candidate fixture", pubtype: ["Preprint"],
      articleids: [{ idtype: "doi", value: candidateDoi }] }) } },
    discovery: { hitCount: 2, resultList: { result: [discoveryRecord(candidateDoi), discoveryRecord(candidateDoi)] } }
  }, []);
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].pmid, "2");
  assert.deepEqual(report.candidates[0].sources, ["PubMed", "bioRxiv"]);
  assert.equal(reportExitCode(report), 0);
});

test("pinned preprint metadata is compared to v1 while v2 is a distinct review item", async () => {
  const { report } = await check({ details: { collection: [bioRxivRecord(preprint.doi),
    bioRxivRecord(preprint.doi, { version: "2", title: "Revised fixture title", authors: "Another, A.; Abraham, J." })] } }, [preprint]);
  assert.equal(reportExitCode(report), 0);
  assert.equal(report.versionUpdates.length, 1);
  assert.equal(report.versionUpdates[0].latestVersion, 2);
  assert.equal(report.publishedPreprints.length, 0);
  assert.match(renderMarkdown(report), /This is not a journal transition/);
});

test("unavailable cited versions and malformed version numbers fail honestly", async () => {
  for (const versions of [["2"], ["1", "1"], ["0"], [undefined], ["not-a-version"]]) {
    const { report } = await check({ details: { collection: versions.map((version) => bioRxivRecord(preprint.doi, { version })) } }, [preprint]);
    assert.equal(report.status, "incomplete");
    assert.equal(reportExitCode(report), 1);
  }
});

test("Crossref author conflicts remain visible, and missing fields are incomplete checks", async () => {
  const conflict = await check({ crossref: crossrefRecord(journal.doi, { author: [{ given: "Jonathan", family: "Abraham" }] }) }, [journal]);
  assert.match(conflict.report.remoteMetadataIssues.join("\n"), /Author list mismatch/);
  for (const change of [{ author: [] }, { title: [] }, { "container-title": [] }, { type: "unknown" }, { DOI: "10.1000/wrong" }]) {
    const { report } = await check({ crossref: crossrefRecord(journal.doi, change) }, [journal]);
    assert.equal(report.status, "incomplete");
    assert.match(report.sourceErrors.join("\n"), /Crossref/);
  }
});

test("a stale bioRxiv author string is reported rather than silently merged with Crossref", async () => {
  const { report } = await check({ details: { collection: [bioRxivRecord(preprint.doi, { authors: "Abraham, J." })] } }, [preprint]);
  assert.equal(report.status, "complete");
  assert.equal(report.remoteMetadataIssues.length, 1);
  assert.match(report.remoteMetadataIssues[0], /bioRxiv v1.*do not merge author lists/);
});

test("Crossref version relations detect journal successors and deduplicate provider relations", async () => {
  const publishedDoi = "10.1000/successor";
  for (const published of ["NA", publishedDoi]) {
    const { report } = await check({ details: { collection: [bioRxivRecord(preprint.doi, { published })] },
      crossref: (url) => crossrefRecord(url.pathname.replace("/works/", ""), url.pathname.includes(preprint.doi)
        ? { relation: { "is-preprint-of": [{ "id-type": "doi", id: publishedDoi }] } } : {}) }, [preprint]);
    assert.equal(report.status, "complete");
    assert.equal(report.publishedPreprints.length, 1);
    assert.equal(report.publishedPreprints[0].crossref.status, "journal");
    assert.ok(report.publishedPreprints[0].sources.includes("Crossref"));
  }
});

test("a published DOI that still resolves to posted content is not accepted as a journal transition", async () => {
  const { report } = await check({ details: { collection: [bioRxivRecord(preprint.doi, { published: candidateDoi })] } }, [preprint]);
  assert.match(report.remoteMetadataIssues.join("\n"), /does not target a journal record/);
  assert.equal(reportExitCode(report), 1);
});

test("online and issue dates remain separate and are never used to rewrite local data", async () => {
  const publications = [{ ...journal, publishedAt: "2026-08-01" }];
  const before = structuredClone(publications);
  const { report } = await check({ crossref: crossrefRecord(journal.doi, {
    "published-online": { "date-parts": [[2026, 8, 1]] }, "published-print": { "date-parts": [[2026, 9]] }
  }) }, publications);
  assert.deepEqual(report.remoteDates, [{ doi: journal.doi, onlineDate: "2026-08-01", issueDate: "2026-09", postedDate: null }]);
  assert.deepEqual(publications, before);
});

test("untrusted remote Markdown cannot inject mentions or managed issue markers", async () => {
  const { report } = await check({ pubmedSummary: { result: { "1": pubmedRecord({ title: "@all <!-- publication-check:end --> [click](https://example.com)" }) } } });
  const markdown = renderMarkdown(report);
  assert.doesNotMatch(markdown, /@all|<!-- publication-check:end -->|\[click\]\(/);
  assert.match(markdown, /&#64;all/);
});

function variationFixture(rule) {
  const publication = { doi: rule.doi, title: "Reviewed bibliography fixture", authors: rule.field === "authors" ? rule.local.join(", ") : "Example A",
    journal: rule.field === "journal" ? rule.local[0] : "Nature", articleType: "Research article" };
  const remote = { title: publication.title, authors: rule.field === "authors" ? [...rule.remote] : ["Example A"],
    journals: rule.field === "journal" ? [...rule.remote] : [publication.journal], status: "journal" };
  return { publication, remote };
}

test("only complete reviewed DOI/source/value pairs accept an indexed name or journal variant", () => {
  for (const rule of acceptedSourceVariations) {
    for (const source of rule.sources) {
      const { publication, remote } = variationFixture(rule);
      const accepted = [];
      assert.deepEqual(compareBibliography(publication, remote, source, accepted), []);
      assert.equal(accepted.length, 1);
      assert.equal(accepted[0].id, rule.id);
      assert.equal(accepted[0].reviewedAt, "2026-09-07");
      assert.ok(accepted[0].evidence.every((url) => url.startsWith("https://")));
      assert.ok(accepted[0].sourceVersion);
    }
  }
});

test("reviewed author variations never hide an added, missing, reordered or misspelled author", () => {
  for (const rule of acceptedSourceVariations.filter((item) => item.field === "authors")) {
    const { publication, remote } = variationFixture(rule);
    const mutations = [
      [...remote.authors, "Unexpected U"], remote.authors.slice(1),
      [remote.authors[1], remote.authors[0], ...remote.authors.slice(2)],
      ["Misspelled M", ...remote.authors.slice(1)]
    ];
    for (const authors of mutations) {
      const accepted = [];
      assert.match(compareBibliography(publication, { ...remote, authors }, rule.sources[0], accepted).join("\n"), /Author list mismatch/);
      assert.deepEqual(accepted, []);
    }
    const changedLocal = { ...publication, authors: `${publication.authors}, New N` };
    assert.match(compareBibliography(changedLocal, remote, rule.sources[0]).join("\n"), /Author list mismatch/);
  }
});

test("exceptions do not apply to another DOI, another index, or a new preprint version", () => {
  for (const rule of acceptedSourceVariations) {
    const { publication, remote } = variationFixture(rule);
    assert.ok(compareBibliography({ ...publication, doi: "10.1000/unreviewed" }, remote, rule.sources[0]).length);
    assert.ok(compareBibliography(publication, remote, "Unreviewed source").length);
  }
  const rule = acceptedSourceVariations.find((item) => item.id === "lachesin-v1-stale-biorxiv-author-string");
  const { publication, remote } = variationFixture(rule);
  assert.match(compareBibliography(publication, remote, "bioRxiv v2").join("\n"), /Author list mismatch/);
});

test("an accepted author variant cannot hide a title, journal or status change", () => {
  const rule = acceptedSourceVariations[0];
  const { publication, remote } = variationFixture(rule);
  const accepted = [];
  const issues = compareBibliography(publication, { ...remote, title: "Different title", journals: ["Different journal"], status: "preprint" }, "PubMed", accepted);
  assert.equal(accepted.length, 1);
  assert.match(issues.join("\n"), /Title mismatch/);
  assert.match(issues.join("\n"), /Journal mismatch/);
  assert.match(issues.join("\n"), /Publication status mismatch/);
});

test("the reviewed PNAS journal alias cannot hide a different journal list", () => {
  const rule = acceptedSourceVariations.find((item) => item.field === "journal");
  const { publication, remote } = variationFixture(rule);
  assert.match(compareBibliography(publication, { ...remote, journals: [...remote.journals, "Unrelated journal"] }, "PubMed").join("\n"), /Journal mismatch/);
});
