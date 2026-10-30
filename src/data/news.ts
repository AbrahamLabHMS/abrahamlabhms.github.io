import type { NewsItem } from "./types";

const newsItemsList: NewsItem[] = [
  {
    date: "2026-09-09",
    category: "Institutional coverage",
    source: "Harvard Medical School",
    title: "Scientists Reveal How the Monkeypox Virus Replicates",
    summary: "HMS reports on Zishuo Yu and colleagues' study of the machinery that copies the monkeypox virus genome.",
    link: "https://hms.harvard.edu/news/scientists-reveal-how-monkeypox-virus-replicates",
    linkLabel: "Read the HMS story",
    homepageEligible: true,
    milestoneTier: "major"
  },
  {
    date: "2026-03-03",
    category: "Institutional coverage",
    source: "HMS Office for Graduate Education",
    title: "Inside the Labs of HMS: Preventing the Next Pandemic",
    summary: "An HMS film follows the Abraham Lab as its members study how viruses infect cells.",
    link: "https://www.youtube.com/shorts/GFM3KLZCDps",
    linkLabel: "Watch the HMS film",
    image: "/assets/images/editorial/inside-labs-hms-film-still.webp",
    imageAlt: "Three stills from the HMS film show gloved hands using laboratory equipment, a molecular model on a monitor, and a sample tube.",
    imageCredit: "Harvard Medical School",
    homepageEligible: true,
    milestoneTier: "major"
  },
  {
    date: "2026-01-08",
    category: "Institutional coverage",
    source: "Harvard Medical School",
    title: "Researchers now understand how a new class of antivirals works",
    summary: "HMS reports on work showing how helicase-primase inhibitors disable a herpesvirus enzyme complex.",
    link: "https://hms.harvard.edu/news/researchers-now-understand-how-new-class-antivirals-works",
    linkLabel: "Read the HMS story",
    homepageEligible: true,
    milestoneTier: "major"
  }
];

export const newsItems = newsItemsList.sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);
