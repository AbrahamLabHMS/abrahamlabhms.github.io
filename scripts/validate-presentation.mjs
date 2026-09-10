import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { elements, attribute } from "./lib/build-targets.mjs";
import { publications } from "../src/data/publications.ts";
import { peopleData } from "../src/data/people.ts";
import { siteData } from "../src/data/site.ts";
import { researchEntities, researchTopics, researchIntro } from "../src/data/research.ts";
import { homepagePublication, publicationAnchor } from "../src/lib/content.ts";

const page = async (route) => elements(await readFile(new URL(`../_site/${route}`, import.meta.url), "utf8"));
const hasClass = (node, name) => (attribute(node, "class") || "").split(/\s+/).includes(name);
const text = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join("");
const descendants = (node) => [node, ...(node.childNodes || []).flatMap(descendants)];

const home = await page("index.html");
const hero = siteData.heroFigures[0];
const heroMedia = home.find((node) => hasClass(node, "dossier-hero__media"));
assert.ok(heroMedia, "Home must render its campus photograph");
assert.equal(attribute(heroMedia, "width"), String(hero.imageWidth));
assert.equal(attribute(heroMedia, "height"), String(hero.imageHeight));
assert.equal(attribute(heroMedia, "alt"), hero.alt);
const photoCredit = home.find((node) => node.tagName === "details" && hasClass(node, "dossier-hero__source"));
assert.ok(photoCredit, "Photo credit must use a native disclosure that works without JavaScript");
assert.equal(attribute(photoCredit, "open"), undefined, "Photo credit should be collapsed by default");
assert.equal(text(photoCredit.childNodes.find((node) => node.tagName === "summary")), "Photo credit");
assert.ok(text(photoCredit).includes(hero.figureCredit) && text(photoCredit).includes(hero.note));
for (const href of [hero.visualSource, hero.licenseUrl]) {
  assert.ok(descendants(photoCredit).some((node) => node.tagName === "a" && attribute(node, "href") === href), "Hero must link its image source and license inside the disclosure");
}
const features = home.filter((node) => hasClass(node, "publication-feature__body"));
assert.equal(features.length, 1, "Home must contain one recent-paper feature");
const feature = descendants(features[0]);
const recent = homepagePublication(publications);
assert.equal(text(feature.find((node) => node.tagName === "h2")), recent.title);
assert.equal(feature.filter((node) => node.tagName === "p").length, recent.significanceLine || recent.summary ? 1 : 0);
assert.ok(!home.some((node) => node.tagName === "iframe" || hasClass(node, "map-widget")), "Maps belong on Contact only");

const record = await page("publications/index.html");
assert.ok(!record.some((node) => hasClass(node, "publication-print") || hasClass(node, "publication-status")), "Publications must not show print controls or a checked timestamp");
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

const research = await page("research/index.html");
assert.equal(text(research.find((node) => node.tagName === "h1")), researchIntro.title);
assert.ok(!research.some((node) => node.tagName === "meta" && attribute(node, "name") === "robots" && (attribute(node, "content") || "").includes("noindex")));
assert.ok(attribute(research.find((node) => node.tagName === "link" && attribute(node, "rel") === "canonical"), "href").endsWith("/research/"));
assert.equal(research.filter((node) => hasClass(node, "research-chapter")).length, 3);
for (const topic of researchTopics) {
  const section = research.find((node) => attribute(node, "id") === topic.id);
  const nodes = descendants(section);
  const image = nodes.find((node) => node.tagName === "img");
  assert.equal(attribute(image, "width"), "1536");
  assert.equal(attribute(image, "height"), "1024");
  assert.equal(attribute(image, "alt"), topic.imageAlt);
  assert.ok(attribute(image, "src").endsWith(topic.image));
  const key = nodes.find((node) => hasClass(node, "research-figure__key"));
  assert.ok(key, "Research figures need a visible labeled key");
  const keyItems = key.childNodes.filter((node) => node.tagName === "li");
  assert.deepEqual(keyItems.map((node) => attribute(node, "data-entity")), [...topic.imageEntities]);
  for (const item of keyItems) {
    const entity = researchEntities[attribute(item, "data-entity")];
    assert.equal(text(item).trim(), entity.label);
    const swatch = item.childNodes.find((node) => node.tagName === "i");
    assert.equal(attribute(swatch, "aria-hidden"), "true");
    assert.ok(attribute(swatch, "style").includes(entity.color));
  }
  assert.ok(text(section).includes("Conceptual schematic, not to scale"));
  for (const reference of topic.papers) {
    const paper = publications.find((item) => item.doi === reference.doi);
    assert.ok(nodes.some((node) => node.tagName === "a" && attribute(node, "href") === paper.link && text(node).includes(paper.title)));
  }
}
const primaryNav = home.find((node) => node.tagName === "nav" && attribute(node, "aria-label") === "Primary");
assert.ok(descendants(primaryNav).some((node) => node.tagName === "a" && text(node) === "Research"));
for (const route of ["index.html", "research/index.html", "publications/index.html", "team/index.html", "contact/index.html"]) {
  const nodes = await page(route);
  for (const [rel, file] of [["icon", "abraham-lab-mark.svg"], ["icon", "abraham-lab-icon-32.png"], ["apple-touch-icon", "abraham-lab-touch-180.png"]]) {
    assert.ok(nodes.some((node) => node.tagName === "link" && attribute(node, "rel") === rel && (attribute(node, "href") || "").endsWith(file)), `Missing ${file} on ${route}`);
  }
}

const team = await page("team/index.html");
const teamRows = team.filter((node) => hasClass(node, "team-row"));
assert.equal(teamRows.length, peopleData.currentMembers.length + peopleData.seasonalMembers.length);
for (const row of teamRows) {
  assert.equal(row.childNodes.filter((node) => node.tagName === "div").length, 3, "Roster rows have identity, appointment, and dates");
  assert.ok(!descendants(row).some((node) => node.tagName === "img"));
}
for (const node of team.filter((node) => node.tagName === "time")) {
  assert.match(attribute(node, "datetime") || "", /^\d{4}(?:-(0[1-9]|1[0-2]))?$/);
}
for (const person of peopleData.alumni.flatMap((group) => group.entries).filter((entry) => entry.summers?.length)) {
  const row = team.find((node) => node.tagName === "li" && node.childNodes.some((child) => child.tagName === "span" && text(child) === person.name));
  assert.ok(row, `Missing summer student: ${person.name}`);
  const dates = descendants(row).filter((node) => node.tagName === "time");
  assert.deepEqual(dates.map(text), person.summers.map((year) => `Summer ${year}`));
  assert.deepEqual(dates.map((node) => attribute(node, "datetime")), person.summers.map(String));
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
