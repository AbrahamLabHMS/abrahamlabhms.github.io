import type { SiteData } from "./types";

export const siteData = {
  name: "Abraham Lab",
  fullName: "Jonathan Abraham Lab",
  shortInstitution: "Harvard Medical School",
  description:
    "The Abraham Lab studies the mechanisms of viral infection at Harvard Medical School.",
  url: process.env.SITE_URL || "https://abrahamlab.med.harvard.edu",
  theme: {
    defaultMode: "system"
  },
  heroTitle: "Mechanisms of viral infection",
  heroDeck:
    "We study how medically important viruses enter cells, evade neutralizing antibodies, and replicate. We use structural biology and virology to define these steps and how antiviral drugs block them.",
  heroFigures: [
    {
      kind: "photograph",
      label: "Harvard Medical School",
      title: "Gordon Hall, Harvard Medical School",
      image: "/assets/images/campus/gordon-hall-quad-2400.webp",
      imageVariants: [
        { path: "/assets/images/campus/gordon-hall-quad-960.webp", width: 960 },
        { path: "/assets/images/campus/gordon-hall-quad-1600.webp", width: 1600 },
        { path: "/assets/images/campus/gordon-hall-quad-2400.webp", width: 2400 }
      ],
      imageWidth: 2400,
      imageHeight: 1800,
      alt: "Gordon Hall's columned facade across the green lawn and leafy trees of the Harvard Medical School Quadrangle.",
      imagePosition: "50% 44%",
      figureCredit: "EgorovaSvetlana",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      note: "Cropped for display",
      visualSource: "https://commons.wikimedia.org/wiki/File:Gordon_Hall_Harvard_Medical_School_Quadrangle.jpg"
    }
  ],
  publicationRecord: {
    checkedAt: "2026-09-07",
    sources: ["PubMed", "bioRxiv"]
  },
  shareImages: {
    campus: {
      image: "/assets/images/social/abraham-lab-gordon-hall.jpg",
      alt: "Gordon Hall across the Harvard Medical School Quadrangle. Photo: EgorovaSvetlana, CC BY-SA 4.0; cropped.",
      width: 1200,
      height: 630
    },
    science: {
      image: "/assets/images/social/abraham-lab-science.jpg",
      alt: "Cryo-EM structures and biochemical measurements from an Abraham Lab arenavirus study.",
      width: 1200,
      height: 630
    },
    film: {
      image: "/assets/images/social/inside-labs-hms.jpg",
      alt: "Still from the Harvard Medical School film Inside the Labs of HMS.",
      width: 1200,
      height: 630
    }
  },
  institutionLabel: "Affiliation",
  institutionTitle: "Department of Microbiology, Blavatnik Institute, Harvard Medical School",
  institutionSummary:
    "Based in the Department of Microbiology at Harvard Medical School. Jonathan Abraham is an HHMI Investigator.",
  tagline: "Mechanisms of viral entry, antibody recognition, and replication.",
  nav: [
    { label: "Home", href: "/" },
    { label: "Research", href: "/research/" },
    { label: "Publications", href: "/publications/" },
    { label: "Jonathan Abraham", href: "/jonathan-abraham/" },
    { label: "Team", href: "/team/" },
    { label: "Contact", href: "/contact/" }
  ],
  affiliations: [
    {
      name: "Harvard Medical School Department of Microbiology",
      shortName: "HMS Microbiology",
      href: "https://micro.hms.harvard.edu/",
      logo: "/assets/images/brands/hms-microbiology-logo.svg",
      logoWidth: 405,
      logoHeight: 53,
      alt: "Harvard Medical School Department of Microbiology",
      note: "Blavatnik Institute, Harvard Medical School"
    },
    {
      name: "Howard Hughes Medical Institute",
      shortName: "Howard Hughes Medical Institute",
      href: "https://www.hhmi.org/",
      logo: "/assets/images/brands/hhmi-horizontal-signature-color.png",
      logoWidth: 1918,
      logoHeight: 445,
      alt: "Howard Hughes Medical Institute",
      note: "HHMI Investigator"
    }
  ],
  trainingPrograms: {
    Virology: "https://virologyphd.hms.harvard.edu/",
    "MD-PhD / Biophysics": "https://biophysics.fas.harvard.edu/",
    "MD-PhD / Biological and Biomedical Sciences": "https://bbsphd.hms.harvard.edu/"
  },
  graduatePrograms: [
    { label: "Virology", href: "https://virologyphd.hms.harvard.edu/" },
    { label: "Biophysics", href: "https://biophysics.fas.harvard.edu/" },
    { label: "Biological and Biomedical Sciences", href: "https://bbsphd.hms.harvard.edu/" }
  ],
  contact: {
    lab: "Abraham Lab",
    department: "Department of Microbiology, Blavatnik Institute, Harvard Medical School",
    institutionDisplayLines: ["Department of Microbiology", "Blavatnik Institute, Harvard Medical School"],
    addressLines: ["Veritas Science Center (VSC)", "77 Avenue Louis Pasteur", "Boston, MA 02115"],
    email: "jonathan_abraham@hms.harvard.edu",
    managerEmail: "james_spencer@hms.harvard.edu",
    mapDisplayName: "Harvard Medical School",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Veritas+Science+Center%2C+77+Avenue+Louis+Pasteur%2C+Boston%2C+MA+02115",
    mapEmbedUrl:
      "https://maps.google.com/maps?q=42.33825%2C-71.10362&t=m&z=14&ie=UTF8&iwloc=&output=embed",
    mapBuilding: "Veritas Science Center (VSC)"
  },
  social: {
    x: "https://twitter.com/abrahamlabhms"
  }
} satisfies SiteData;
