import assert from "node:assert/strict";
import test from "node:test";
import { groupPeople, homepagePublication, recentPublicationLabel } from "../src/lib/content.ts";
import { publications } from "../src/data/publications.ts";
import { peopleData } from "../src/data/people.ts";

const article = (doi, publishedAt, articleType = "Research article") => ({
  doi, publishedAt, articleType, year: Number(publishedAt.slice(0, 4)),
  title: doi, citation: doi, link: `https://doi.org/${doi}`,
  correspondingAuthor: true, correspondenceSource: `https://doi.org/${doi}`
});

test("homepage uses the newest research article, independent of hero or curation flags", () => {
  const older = { ...article("10.1234/older", "2025-01-01"), image: "/old.webp", leadFeature: true };
  const newer = article("10.1234/newer", "2026-01-01");
  const preprint = article("10.1234/preprint", "2026-08-01", "Preprint");
  const commentary = article("10.1234/commentary", "2026-08-02", "Commentary");
  assert.equal(homepagePublication([preprint, older, commentary, newer]), newer);
  older.image = "/another.webp";
  assert.equal(homepagePublication([older, newer, preprint]), newer);
  const newest = article("10.1234/next", "2026-09-01");
  assert.equal(homepagePublication([older, newest, newer, preprint]), newest);
});

test("an explicit preprint override retains an explicit preprint label", () => {
  const preprint = article("10.1234/preprint", "2026-08-01", "Preprint");
  const chosen = homepagePublication([article("10.1234/article", "2026-01-01"), preprint], preprint.doi);
  assert.equal(chosen, preprint);
  assert.equal(recentPublicationLabel(chosen), "Recent preprint");
  assert.throws(() => homepagePublication([preprint], "10.1234/missing"), /not in the verified record/);
  assert.equal(homepagePublication([preprint]), undefined);
});

test("the current verified record selects the latest dated journal research article", () => {
  const expected = publications.filter((item) => item.articleType === "Research article" && item.publishedAt)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  assert.equal(homepagePublication(publications), expected);
  assert.equal(recentPublicationLabel(expected), "Recent paper");
});

test("directory groups preserve all current members and reject unknown groups", () => {
  const rendered = groupPeople(peopleData.currentMembers).flatMap((group) => group.entries);
  assert.equal(rendered.length, peopleData.currentMembers.length);
  assert.deepEqual(new Set(rendered), new Set(peopleData.currentMembers));
  assert.throws(() => groupPeople([{ name: "Test entry", title: "Test", group: "Misspelled group", order: 1 }]), /Unknown team group/);
});

test("the three confirmed 2024 graduate starts stay aligned with James's correction", () => {
  for (const [name, start] of [["Jessica Oros", "2024-04"], ["Corazón Núñez", "2024-07"], ["Laurentia Vianney Tjang", "2024-07"]]) {
    assert.equal(peopleData.currentMembers.find((person) => person.name === name)?.labStart, start);
  }
});

test("alumni destinations retain public sources and confirmed summer entries use seasons", () => {
  const alumni = peopleData.alumni.flatMap((group) => group.entries);
  for (const person of alumni.filter((entry) => entry.destination)) {
    assert.equal(new URL(person.destinationSource).protocol, "https:");
  }
  for (const name of ['Cecilia "Cici" Bradley', 'Louella "Ella" Seo', "Zaila Avant-garde"]) {
    assert.deepEqual(alumni.find((person) => person.name === name)?.summers, [2026]);
  }
});
