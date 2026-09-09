import type { JonathanProfile } from "./types";

export const jonathanProfile = {
  name: "Jonathan Abraham, MD, PhD",
  title: "Professor of Microbiology, Harvard Medical School",
  secondaryTitle: "Investigator, Howard Hughes Medical Institute",
  clinicalTitle: "Associate Physician, Division of Infectious Diseases, Brigham and Women's Hospital",
  pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/?term=Abraham+Jonathan%5BFull+Author+Name%5D&sort=date",
  overview:
    "Jonathan Abraham studies the molecular mechanisms of viral infection in medically important viruses.",
  biography: [
    "Jonathan Abraham started the laboratory at Harvard Medical School in 2017.",
    "His group uses structural biology and virology to study viral entry and antibody recognition. It also studies replication complexes and antiviral mechanisms.",
    "He earned a bachelor's degree in biochemical sciences from Harvard College and a PhD in biophysics from Harvard University. He earned an MD from Harvard Medical School through the Harvard-MIT MD-PhD Program.",
    "He trained in internal medicine at Brigham and Women's Hospital. He completed infectious diseases training through the combined Brigham and Women's Hospital and Massachusetts General Hospital program."
  ],
  appointments: [
    {
      label: "Academic appointment",
      title: "Professor of Microbiology, Harvard Medical School"
    },
    {
      label: "Research appointment",
      title: "Investigator, Howard Hughes Medical Institute"
    },
    {
      label: "Clinical appointment",
      title: "Associate Physician, Division of Infectious Diseases, Brigham and Women's Hospital"
    }
  ],
  distinctions: [
    "Burroughs Wellcome Career Award for Medical Scientists",
    "NIH Director's Early Independence Award"
  ],
  focusAreas: [
    "Host receptor recognition in medically important viruses",
    "Antibody neutralization and escape",
    "Replication-complex organization and antiviral mechanism"
  ],
  representativeWork: [
    "Mechanisms of HSV-1 helicase-primase inhibition and replication fork complex assembly",
    "Molecular organization of the New World arenavirus spike glycoprotein complex",
    "Molecular basis for shifted receptor recognition by an encephalitic arbovirus"
  ],
  profileLinks: [
    {
      label: "HHMI Investigator profile",
      href: "https://www.hhmi.org/scientists/jonathan-abraham"
    },
    {
      label: "HMS Microbiology faculty",
      href: "https://micro.hms.harvard.edu/faculty"
    },
    {
      label: "Brigham clinical profile",
      href: "https://physiciandirectory.brighamandwomens.org/details/13685/jonathan-abraham-infectious_disease-boston"
    },
    {
      label: "ORCID record",
      href: "https://orcid.org/0000-0002-7937-3920"
    },
    {
      label: "Inside the Labs of HMS",
      href: "https://www.youtube.com/shorts/GFM3KLZCDps"
    }
  ]
} satisfies JonathanProfile;
