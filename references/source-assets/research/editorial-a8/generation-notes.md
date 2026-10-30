# Membrane detail restoration, October 30, 2026

James noticed that repeated edits had softened the membrane details in the antibody illustration. The original a2 source has cleaner round heads and paired tails. This revision uses that source as a visual reference while retaining the corrected a7 protein and antibody.

- Tool: built-in image generation, reference-guided compositing edit.
- Edit target: `../editorial-a7/antibody.png`.
- Membrane reference only: `../editorial-a2/antibody.png`.
- Output: `exec-a253bf71-2ffa-40c5-9f59-b0697542d583.png`, preserved here as `antibody.png` (1536 x 1024).
- Reviewed changes: sharper, more regular membrane detail. Three distinct protein grays and the corrected antibody arm-tip contact remain.
- This is a conceptual schematic, not a molecular model. No experimental figure was modified.
- Active web assets: `public/assets/images/research/antibody-editorial-a8-{960,1536}.webp`.
- Entry remains on revision a7. Replication remains on a2. Jesse's publication figure remains on hold.

## Edit prompt

Use case: compositing. Image 1 is the EDIT TARGET and defines the approved composition. Image 2 is a REFERENCE ONLY for the crisp original membrane detail. Restore the two gray membrane strips in Image 1 to the clean high-definition quality of Image 2. Match their same placement, curvature, thickness and border. Both the lower cell membrane and upper cropped membrane need clean individual round pale-gray heads and clearly resolved paired slender tails pointing into the membrane, with smooth deliberate edges and subtle consistent relief shading. The lower membrane has become waxy, melted and irregular in Image 1: restore it faithfully from Image 2, including at the receptor base. No extra rows, double outlines, fuzzy beads, fused shapes or random texture. CRITICAL: retain all objects between the membranes from Image 1 EXACTLY. Keep its three protein subunits in distinct charcoal / light silver / medium gray. Keep the compact gold Y antibody shape, stem length, orientation and single arm-tip protein contact from Image 1, NOT the older antibody from Image 2. Keep the cyan receptor from Image 1 unchanged. Do not import the old protein or antibody from Image 2. Retain white background, framing and 1536x1024 landscape composition. This is a generic conceptual diagram, not a molecular model. No words, labels, arrows, added objects, changed geometry, crop, or global relighting. Edit only the two membrane strips to restore their original crispness.
