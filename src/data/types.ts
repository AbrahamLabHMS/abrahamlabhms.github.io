export type NavItem = {
  label: string;
  href: string;
};

export type ThemeSettings = {
  defaultMode: "system";
};

export type HeroFigure = {
  kind?: "photograph" | "figure";
  label: string;
  title: string;
  image: string;
  imageVariants?: Array<{
    path: string;
    width: number;
  }>;
  imageWidth?: number;
  imageHeight?: number;
  alt: string;
  note?: string;
  href?: string;
  imagePosition?: string;
  imageCrop?: { x: number; y: number; width: number; height: number };
  figureCredit?: string;
  figureNumber?: string;
  license?: string;
  licenseUrl?: string;
  visualSource?: string;
};

export type Affiliation = {
  name: string;
  shortName?: string;
  href: string;
  logo: string;
  logoWidth: number;
  logoHeight: number;
  alt: string;
  note?: string;
};

export type ContactData = {
  lab: string;
  department: string;
  institutionDisplayLines?: string[];
  addressLines: string[];
  email: string;
  managerEmail: string;
  mapDisplayName: string;
  mapUrl: string;
  mapEmbedUrl: string;
  mapBuilding: string;
};

export type SiteData = {
  name: string;
  fullName: string;
  shortInstitution: string;
  description: string;
  url: string;
  theme: ThemeSettings;
  heroTitle: string;
  heroDeck: string;
  heroFigures: HeroFigure[];
  publicationRecord: {
    checkedAt: string;
    sources: string[];
    homepageDoi?: string;
  };
  shareImages: {
    science: {
      image: string;
      alt: string;
      width: number;
      height: number;
    };
    film: {
      image: string;
      alt: string;
      width: number;
      height: number;
    };
  };
  institutionLabel: string;
  institutionTitle: string;
  institutionSummary: string;
  tagline: string;
  nav: NavItem[];
  affiliations: Affiliation[];
  trainingPrograms: Record<
    "Virology" | "MD-PhD / Biophysics" | "MD-PhD / Biological and Biomedical Sciences",
    string
  >;
  graduatePrograms: NavItem[];
  contact: ContactData;
  social: {
    x: string;
    bluesky?: string;
  };
};

export type Publication = {
  year: number;
  title: string;
  citation: string;
  link: string;
  authors?: string;
  journal?: string;
  publishedAt?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  featured?: boolean;
  leadFeature?: boolean;
  homepageProof?: boolean;
  foundational?: boolean;
  system?: string;
  methodCluster?: string;
  significanceLine?: string;
  openAccess?: boolean;
  coverageLinks?: string[];
  structures?: {
    pdb?: string[];
    emdb?: string[];
  };
  resourceLinks?: Array<{
    label: string;
    href: string;
    kind: "data" | "code" | "protocol" | "supplement";
  }>;
  summary?: string;
  image?: string;
  imagePosition?: string;
  imageAlt?: string;
  visualReuseStatus?: "open-access" | "lab-approved" | "link-only";
  articleType: "Research article" | "Preprint" | "Commentary";
  correspondingAuthor: true;
  correspondenceSource: string;
  figureCredit?: string;
  figureNumber?: string;
  license?: string;
  visualSource?: string;
};

export type NewsItem = {
  date: string;
  category: string;
  source: string;
  title: string;
  summary: string;
  link: string;
  linkLabel?: string;
  homepageEligible?: boolean;
  milestoneTier?: "major" | "secondary";
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
};

export const CURRENT_TEAM_GROUPS = [
  "Leadership",
  "Postdoctoral Fellows & Instructors",
  "Graduate Students",
  "Research Staff",
  "Operations & Strategy"
] as const;

export type Person = {
  name: string;
  title: string;
  note?: string;
  roleSummary?: string;
  programTags?: Array<"Virology" | "MD-PhD / Biophysics" | "MD-PhD / Biological and Biomedical Sciences">;
  fellowships?: string[];
  labStart?: string;
  labEnd?: string;
  group: (typeof CURRENT_TEAM_GROUPS)[number];
  order: number;
};

export type SeasonalMember = {
  name: string;
  title: string;
  program?: string;
  labStart?: string;
  labEnd?: string;
  summers?: number[];
};

export type AlumniEntry = {
  name: string;
  destination?: string;
  destinationSource?: string;
  labStart?: string;
  labEnd?: string;
  summers?: number[];
};

export type AlumniGroup = {
  label: string;
  entries: AlumniEntry[];
};

export type PeopleData = {
  currentMembers: Person[];
  seasonalMembers: SeasonalMember[];
  alumni: AlumniGroup[];
};

export type JonathanProfile = {
  name: string;
  title: string;
  secondaryTitle: string;
  clinicalTitle: string;
  pubmedUrl: string;
  overview: string;
  biography: string[];
  appointments: Array<{
    label: string;
    title: string;
  }>;
  distinctions: string[];
  focusAreas: string[];
  representativeWork: string[];
  profileLinks: Array<{
    label: string;
    href: string;
  }>;
};
