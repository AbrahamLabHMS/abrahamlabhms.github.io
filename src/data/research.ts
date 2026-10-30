export const researchEntities = {
  viralProtein: { label: "Viral surface protein", color: "#4b5156" },
  receptor: { label: "Cell receptor", color: "#168d9b" },
  antibody: { label: "Antibody", color: "#c49339" },
  polymerase: { label: "Polymerase", color: "#4e6faa" },
  template: { label: "Template strand", color: "#a8b0b7" },
  newStrand: { label: "New strand", color: "#6b884b" }
} as const;

export const researchIntro = {
  title: "How viruses infect cells",
  description: "We study how viruses enter cells, how antibodies block infection, and how viral genomes are copied.",
  paragraphs: [
    "A virus must bind to a cell and then enter the cell to copy its genome. We study the proteins that carry out these steps, and how antibodies and antiviral drugs can block them.",
    "By connecting molecular structures with experiments, we work to explain how infection happens and where it can be stopped."
  ]
};

export const researchTopics = [
  {
    id: "viral-entry",
    label: "Viral entry",
    question: "What lets a virus enter a cell?",
    paragraphs: [
      "Viral surface proteins bind to molecules on host cells called receptors. These interactions help determine which cells and species a virus can infect. Binding is only one step: the virus must also deliver its genetic material into the cell.",
      "We identify receptors and examine how viral proteins recognize them. Our work on encephalitic alphaviruses shows that related viruses can bind the same receptor in different ways."
    ],
    relevance: "Understanding mechanisms of virus receptor recognition helps explain the host ranges of viruses and can point to ways of blocking infection at its first steps.",
    methods: "Genetic screens, cryo-electron microscopy, and biochemical, biophysical, and infectivity assays.",
    image: "/assets/images/research/entry-editorial-a7-1536.webp",
    imageSmall: "/assets/images/research/entry-editorial-a7-960.webp",
    imageEntities: ["viralProtein", "receptor"] as const,
    imageAlt: "A viral surface glycoprotein trimer, shown in three distinct shades of gray, approaches a cyan cell receptor between two membranes.",
    caption: "A viral surface protein approaches a cell receptor.",
    papers: [
      { doi: "10.1038/s41467-024-50887-9", finding: "Eastern equine encephalitis virus and Semliki Forest virus engage VLDLR through different binding modes." },
      { doi: "10.1016/j.cell.2025.03.029", finding: "Western equine encephalitis virus strains differ in how they recognize host receptors." }
    ]
  },
  {
    id: "antibody-neutralization",
    label: "Antibody neutralization",
    question: "How can antibodies stop infection?",
    paragraphs: [
      "Antibodies bind specific sites on viral proteins. Neutralizing antibodies can prevent entry by blocking receptor binding or the protein shape changes needed for membrane fusion in enveloped viruses.",
      "We study where these antibodies bind, why some recognize more than one virus, and how changes in viral proteins can reduce the activity of antibodies. Our arenavirus studies identified antibodies that block receptor binding and neutralize both Junin and Machupo viruses."
    ],
    relevance: "These findings can guide antibody-based approaches to prevention and treatment, while helping explain why some antibodies lose activity as viruses change.",
    methods: "Antibody isolation, binding and neutralization assays, and cryo-electron microscopy and X-ray crystallography.",
    image: "/assets/images/research/antibody-editorial-a8-1536.webp",
    imageSmall: "/assets/images/research/antibody-editorial-a8-960.webp",
    imageEntities: ["viralProtein", "antibody", "receptor"] as const,
    imageAlt: "One arm tip of the gold Y-shaped antibody touches the three-subunit viral protein, shown in distinct gray shades. Its stem points away, clear of the protein and cyan receptor.",
    caption: "An antibody binds a viral surface protein through the tip of one arm. This binding can interfere with viral entry.",
    papers: [
      { doi: "10.1038/s41467-018-04271-z", finding: "Antibodies from a vaccine recipient blocked receptor binding and neutralized two New World arenaviruses." },
      { doi: "10.1126/science.abl6251", finding: "Studies of the SARS-CoV-2 receptor-binding domain explain how viral protein changes can reduce antibody neutralization." }
    ]
  },
  {
    id: "genome-replication",
    label: "Genome replication",
    question: "How do viruses copy their genomes?",
    paragraphs: [
      "Polymerases are enzymes that make new strands of genetic material using an existing strand as a template. Different viruses use different copying machinery. We study RNA replication in Nipah virus and DNA replication in herpesviruses and poxviruses.",
      "We examine how these proteins assemble and work together. Our studies also show how antiviral drugs interfere with replication, including how helicase-primase inhibitors stop an essential part of the herpesvirus DNA-copying machinery."
    ],
    relevance: "Knowing how viral replication proteins work helps explain drug action and resistance for existing inhibitors and provides a basis for developing new antivirals.",
    methods: "Cryo-electron microscopy, protein biochemistry, and single-molecule measurements (in collaboration).",
    image: "/assets/images/research/replication-editorial-a2-1536.webp",
    imageSmall: "/assets/images/research/replication-editorial-a2-960.webp",
    imageEntities: ["polymerase", "template", "newStrand"] as const,
    imageAlt: "A silver-gray template strand passes through a blue polymerase. A green complementary strand begins inside and pairs with the template as it emerges.",
    caption: "A polymerase uses a template strand to build a complementary strand. The drawing shows the copying principle, not a specific viral complex.",
    papers: [
      { doi: "10.1038/s41586-026-10937-2", finding: "The monkeypox virus study shows how helicase and polymerase activities are coordinated during DNA replication." },
      { doi: "10.1016/j.cell.2025.11.041", finding: "The HSV-1 study shows how inhibitors block helicase-primase and how the replication fork complex assembles." },
      { doi: "10.1016/j.cell.2024.12.021", finding: "The Nipah virus study defines the structure and function of the polymerase complex that makes viral RNA." }
    ]
  }
];
