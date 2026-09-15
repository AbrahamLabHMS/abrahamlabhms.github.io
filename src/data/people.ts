import type { PeopleData } from "./types";

export const peopleData: PeopleData = {
  currentMembers: [
    {
      name: "Jonathan Abraham, MD, PhD",
      title: "Professor of Microbiology, Harvard Medical School",
      group: "Leadership",
      order: 1
    },
    {
      name: "Pan Yang, Ph.D.",
      title: "Instructor of Microbiology",
      labStart: "2019-07",
      group: "Postdoctoral Fellows & Instructors",
      order: 2
    },
    {
      name: "Wanyu Li, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2023-07",
      group: "Postdoctoral Fellows & Instructors",
      order: 3
    },
    {
      name: "Side Hu, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2022-10",
      group: "Postdoctoral Fellows & Instructors",
      order: 4
    },
    {
      name: "Chenggong Ji, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2024-09",
      group: "Postdoctoral Fellows & Instructors",
      order: 5
    },
    {
      name: "Zishuo Yu, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2022-11",
      group: "Postdoctoral Fellows & Instructors",
      order: 6
    },
    {
      name: "Cristina Gutierrez-Vargas, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2020-04",
      group: "Postdoctoral Fellows & Instructors",
      order: 7
    },
    {
      name: "Biswajit Das, Ph.D.",
      title: "Postdoctoral Fellow",
      group: "Postdoctoral Fellows & Instructors",
      order: 8
    },
    {
      name: "Judy Huang, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2025-08",
      group: "Postdoctoral Fellows & Instructors",
      order: 9
    },
    {
      name: "Colin Mann, Ph.D.",
      title: "Postdoctoral Fellow",
      labStart: "2023-07",
      group: "Postdoctoral Fellows & Instructors",
      order: 10
    },
    {
      name: "Jesse Plung",
      title: "Graduate Student",
      programTags: ["Virology"],
      labStart: "2024-07",
      group: "Graduate Students",
      order: 11
    },
    {
      name: "Jessica Oros",
      title: "Graduate Student",
      programTags: ["Virology"],
      labStart: "2024-04",
      group: "Graduate Students",
      order: 12
    },
    {
      name: "Rick Li",
      title: "Graduate Student",
      programTags: ["MD-PhD / Biological and Biomedical Sciences"],
      labStart: "2025-09",
      group: "Graduate Students",
      order: 13
    },
    {
      name: "Laurentia Vianney Tjang",
      title: "Graduate Student",
      programTags: ["Virology"],
      labStart: "2024-07",
      group: "Graduate Students",
      order: 14
    },
    {
      name: "Corazón Núñez",
      title: "Graduate Student",
      programTags: ["Virology"],
      labStart: "2024-07",
      group: "Graduate Students",
      order: 15
    },
    {
      name: "Alex Liu",
      title: "Graduate Student",
      programTags: ["Virology"],
      labStart: "2026-07",
      group: "Graduate Students",
      order: 16
    },
    {
      name: "Kevin Gong",
      title: "Graduate Student",
      programTags: ["Virology"],
      labStart: "2026-07",
      group: "Graduate Students",
      order: 17
    },
    {
      name: "Jayda Gilliard",
      title: "Research Technician",
      labStart: "2026-08",
      group: "Research Staff",
      order: 18
    },
    {
      name: "James Spencer",
      title: "Lab Manager",
      labStart: "2025-08",
      group: "Operations & Strategy",
      order: 19
    }
  ],
  seasonalMembers: [],
  alumni: [
    {
      label: "Postdoctoral and Research Fellows",
      entries: [
        { name: "Dan Olal, Ph.D.", labStart: "2019-02" },
        {
          name: "Poorna Goswami, Ph.D.",
          destination: "Adjunct Faculty, Lasell University",
          destinationSource: "https://www.lasell.edu/staff-directory.html?alpha=G",
          labStart: "2024-04"
        },
        {
          name: "Gábor Oroszlán, Ph.D.",
          destination: "VRG Therapeutics",
          destinationSource: "https://www.vrgtherapeutics.com/our-team"
        },
        {
          name: "Chieyu Lin, Ph.D.",
          destination: "Next position: Beam Therapeutics"
        },
        {
          name: "Sundaresh Shankar, Ph.D.",
          destination: "Next position: Broad Institute of MIT and Harvard"
        },
        {
          name: "Keshalini Sabaratnam, Ph.D.",
          destination: "Senior Consultant, International Market Access Consulting (IMAC)",
          destinationSource: "https://www.imarketaccess.com/team.html"
        },
        {
          name: "Xiaoyi Fan, Ph.D.",
          destination: "Next position: Merck",
          labStart: "2022-08", labEnd: "2026-06"
        }
      ]
    },
    {
      label: "Graduate Students",
      entries: [
        {
          name: "Sarah Clark-Drake",
          destination: "Arcellx"
        },
        {
          name: "Lars Clark",
          destination: "Vertex Pharmaceuticals"
        },
        {
          name: "Katherine Nabel Smith",
          destination: "Dermatology Resident, University of Pennsylvania",
          destinationSource: "https://dermatology.upenn.edu/residents/current-residents/katherine-nabel-smith/"
        },
        {
          name: "Haley Varnum, Ph.D.",
          destination: "Medical Student, Harvard Medical School",
          destinationSource: "https://www.med.harvard.edu/md_phd/students/2020.html",
          labStart: "2023-09", labEnd: "2026-07"
        }
      ]
    },
    {
      label: "Research Assistant and Lab Manager",
      entries: [{ name: "Vesna Brusic", labStart: "2019-10", labEnd: "2025-11" }]
    },
    {
      label: "Research Technicians",
      entries: [
        {
          name: "Adrian Coscia",
          destination: "Harvard/MIT MD-PhD Program",
          destinationSource: "https://www.med.harvard.edu/md_phd/students/2020.html"
        },
        {
          name: "Taleen Dilanyan",
          destination: "PhD in Chemistry, Caltech (2024)",
          destinationSource: "https://thesis.caltech.edu/16280/"
        }
      ]
    },
    {
      label: "Summer Students",
      entries: [
        { name: "Arya Akbarshahi", summers: [2025] },
        { name: "Linzy Malcolm" },
        { name: "Cecilia \"Cici\" Bradley", labStart: "2026-06", labEnd: "2026-07", summers: [2025, 2026] },
        { name: "Louella \"Ella\" Seo", labStart: "2026-06", labEnd: "2026-08", summers: [2026] },
        { name: "Zaila Avant-garde", labStart: "2026-06", labEnd: "2026-08", summers: [2026] }
      ]
    }
  ]
};
