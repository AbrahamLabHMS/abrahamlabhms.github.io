# Antibody proportion refinement, October 30, 2026

Unpublished local draft. James approved the proposed small proportion adjustment and caption revision following review of antibody structure. Jesse's publication figure remains on hold.

- Tool: built-in image generation, two targeted image edits.
- Initial input: `../editorial-a5/antibody.png`, preserved unchanged.
- Intermediate output: `exec-bb3fba70-e10d-48e2-889f-d84c74a153ee.png` in the tool's generated-images folder.
- Final output: `exec-9d570a6f-3b04-469f-8120-f310c5300ab2.png`, copied here as `antibody.png` (1536 x 1024).
- Visual assessment: fuller arms, less exaggerated stem, one arm tip touching the protein, fork and stem free, three viral-protein subunits visible. This is still a conceptual schematic, not a validated molecular model or an exact dimensional representation.
- Caption no longer claims that this particular drawing demonstrates receptor obstruction. The not-to-scale label remains.
- Derivatives: `public/assets/images/research/antibody-editorial-a6-{960,1536}.webp`.
- Regenerate: `node scripts/optimize-research-assets.mjs --illustrations-only`.

## First edit prompt

Use case: precise-object-edit. Make a small refinement to ONLY the gold antibody in this existing 3:2 landscape conceptual educational illustration. It is a schematic, not experimental data or a molecular model. Current issue: the gold stem is too long and its two arms look like tiny prongs. Rebalance to a compact, recognizable IgG-like Y: give BOTH arms more substantial length and modest rounded body, shorten the free stem noticeably, and allow a gentle flexible bend at the fork. Arms and stem should be comparable in visual length, with each arm slightly shorter than the stem, not dramatically shorter. Keep the left arm TIP at the existing contact point on the outer edge of the rightmost charcoal protein subunit. Move the fork a little down-right as needed to lengthen this contact arm, while shortening the free stem from its distant end. The other arm points upper-right and remains free; the stem points down-right and stays clear of the viral protein, cyan receptor and membranes. Binding must be ONLY at the tip of one of the two branched arms, NEVER at the stem or fork. No third arm or extra antibody. Preserve the three distinct charcoal viral subunits and all their shading, gray membranes, cyan receptor, pale background, camera, scale, muted-gold color and restrained paper-cut 3D style. Keep all non-gold objects unchanged. No text, arrows, labels, atomic detail, new entities or cropping.

## Final edit prompt

Use case: precise-object-edit. Final tiny proportion refinement to this conceptual illustration. Keep both gold upper arms, the fork, and their current contact with the three-subunit charcoal protein EXACTLY as shown. Extend ONLY the free bottom-right gold stem by about one third of its current length, following its existing down-right direction and keeping its width and rounded end. This makes the unbranched stem modestly longer than either arm without making a long thin handle. At this 1536x1024 composition its rounded bottom tip should end roughly at x1040, y550, rather than around x1005, y500. Keep a broad pale gap between that end and the cyan receptor and membrane. Do not move the fork, change the arms or their protein contact, merge the three charcoal subunits, or alter any other object, background, color, texture, camera or framing. No text, labels or added objects. Generic schematic, not a molecular model.
