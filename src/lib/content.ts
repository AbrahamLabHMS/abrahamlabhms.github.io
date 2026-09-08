import type { Person, Publication } from "../data/types";
import { CURRENT_TEAM_GROUPS } from "../data/types.ts";

export function withBase(path = "/") {
  if (/^(https?:|mailto:|tel:)/.test(path)) {
    return path;
  }

  const base = import.meta.env.BASE_URL || "/";
  const normalized = path === "/" ? "" : path.replace(/^\/+/, "");
  return `${base}${normalized}`;
}

export function featuredOnly(items: Publication[]) {
  return [...items]
    .filter((item) => Boolean(item.featured))
    .sort(comparePublicationDates);
}

export function publicationAnchor(item: Publication) {
  const identifier = item.doi?.toLowerCase() ?? item.pmid;
  if (!identifier) throw new Error(`Publication needs a stable identifier: ${item.title}`);
  return `paper-${identifier}`;
}

export function homepagePublication(items: Publication[], overrideDoi?: string) {
  if (overrideDoi) {
    const selected = items.find((item) => item.doi === overrideDoi);
    if (!selected) throw new Error(`Homepage publication DOI is not in the verified record: ${overrideDoi}`);
    return selected;
  }

  // Imagery and curation flags must not silently pin an older article.
  return [...items]
    .filter((item) => item.articleType === "Research article" && item.correspondingAuthor && item.publishedAt)
    .sort(comparePublicationDates)[0];
}

export function recentPublicationLabel(item: Publication) {
  return item.articleType === "Preprint" ? "Recent preprint" : "Recent paper";
}

export function homepageProofOnly(items: Publication[]) {
  return [...items]
    .filter((item) => Boolean(item.homepageProof))
    .sort(comparePublicationDates);
}

export function limitItems<T>(items: T[], count: number) {
  return items.slice(0, count);
}

export function groupPublicationsByYear(items: Publication[]) {
  const grouped = new Map<number, Publication[]>();

  for (const item of [...items].sort(comparePublicationDates)) {
    if (!grouped.has(item.year)) {
      grouped.set(item.year, []);
    }
    grouped.get(item.year)?.push(item);
  }

  return [...grouped.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, entries]) => ({ year, entries }));
}

export function groupPeople(items: Person[]) {
  const grouped = new Map<Person["group"], Person[]>();

  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    if (!CURRENT_TEAM_GROUPS.includes(item.group)) {
      throw new Error(`Unknown team group for ${item.name}: ${item.group}`);
    }
    if (!grouped.has(item.group)) {
      grouped.set(item.group, []);
    }
    grouped.get(item.group)?.push(item);
  }

  return CURRENT_TEAM_GROUPS.map((label) => ({
    label,
    entries: grouped.get(label) ?? []
  })).filter((group) => group.entries.length > 0);
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function comparePublicationDates(a: Publication, b: Publication) {
  const left = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(`${a.year}-01-01`).getTime();
  const right = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(`${b.year}-01-01`).getTime();
  return right - left;
}
