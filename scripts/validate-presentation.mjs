import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { elements, attribute } from "./lib/build-targets.mjs";
import { publications } from "../src/data/publications.ts";
import { peopleData } from "../src/data/people.ts";
import { homepagePublication, publicationAnchor } from "../src/lib/content.ts";

const page = async (route) => elements(await readFile(new URL(`../_site/${route}`, import.meta.url), "utf8"));
const hasClass = (node, name) => (attribute(node, "class") || "").split(/\s+/).includes(name);
const text = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join("");
const descendants = (node) => [node, ...(node.childNodes || []).flatMap(descendants)];

const home = await page("index.html");
const features = home.filter((node) => hasClass(node, "publication-feature__body"));
assert.equal(features.length, 1, "Home must contain one recent-paper feature");
const feature = descendants(features[0]);
const recent = homepagePublication(publications);
assert.equal(text(feature.find((node) => node.tagName === "h2")), recent.title);
assert.equal(feature.filter((node) => node.tagName === "p").length, recent.significanceLine || recent.summary ? 1 : 0);
assert.ok(!home.some((node) => node.tagName === "iframe" || hasClass(node, "map-widget")), "Maps belong on Contact only");

const record = await page("publications/index.html");
const rows = record.filter((node) => hasClass(node, "publication-row"));
assert.equal(rows.length, publications.length);
assert.equal(new Set(rows.map((row) => attribute(row, "id"))).size, rows.length);
for (const publication of publications) {
  const row = rows.find((node) => attribute(node, "id") === publicationAnchor(publication));
  assert.ok(row, `Missing publication anchor: ${publication.doi}`);
  const links = descendants(row).filter((node) => node.tagName === "a").map((node) => attribute(node, "href"));
  assert.ok(links.includes(publication.link));
  if (publication.pmcid) assert.equal(links.filter((href) => href.includes(`/articles/${publication.pmcid}/`)).length, 1);
}

const team = await page("team/index.html");
const teamRows = team.filter((node) => hasClass(node, "team-row"));
assert.equal(teamRows.length, peopleData.currentMembers.length + peopleData.seasonalMembers.length);
for (const row of teamRows) {
  assert.equal(row.childNodes.filter((node) => node.tagName === "div").length, 3, "Roster rows have identity, appointment, and dates");
  assert.ok(!descendants(row).some((node) => node.tagName === "img"));
}
for (const node of team.filter((node) => node.tagName === "time")) {
  assert.match(attribute(node, "datetime") || "", /^\d{4}-(0[1-9]|1[0-2])$/);
}

for (const route of ["index.html", "publications/index.html", "team/index.html", "contact/index.html"]) {
  const nodes = await page(route);
  const footer = descendants(nodes.find((node) => node.tagName === "footer"));
  assert.ok(!footer.some((node) => (attribute(node, "href") || "").startsWith("mailto:")));
  const footerNavs = footer.filter((node) => node.tagName === "nav");
  assert.equal(footerNavs.length, 2);
  assert.ok(footerNavs.every((node) => attribute(node, "aria-labelledby")));
}

console.log(`Presentation checks passed: one homepage feature, ${rows.length} citations, ${teamRows.length} roster rows, valid dates and footer navigation.`);
