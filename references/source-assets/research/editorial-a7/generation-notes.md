# Distinct gray subunits, October 30, 2026

James requested three distinguishable shades of gray for the viral protein in the entry and antibody illustrations. These are conceptual schematics, not experimental figures or molecular models.

- Method: built-in image generation, targeted edits of the existing PNGs.
- Entry input: `../editorial-a3/entry.png`.
- Antibody input: `../editorial-a6/antibody.png`.
- Entry output: `exec-a429694d-c3de-4362-9552-9a2a768b80cb.png`, preserved here as `entry.png`.
- Antibody output: `exec-eb0a1854-2880-4c00-a702-a5620789dcac.png`, preserved here as `antibody.png`.
- Both sources are 1536 x 1024 pixels. Earlier revisions remain unchanged.
- Palette: charcoal left/back, light silver center/front, medium graphite right/back. All three remain part of the gray viral-protein color family.
- Visual review: three distinct gray values, unchanged composition, cyan receptor and gold antibody. The antibody arm-tip contact and free stem remain in place.
- Web assets: `public/assets/images/research/{entry,antibody}-editorial-a7-{960,1536}.webp`.
- Regenerate with `node scripts/optimize-research-assets.mjs --illustrations-only`.

## Entry edit prompt

Use case: precise-object-edit. Edit this existing generic conceptual educational illustration ONLY to distinguish the three gray subunits of the viral surface protein. Keep the original 1536x1024 landscape composition. Assign three clearly distinguishable but restrained neutral gray base shades: left/back subunit dark charcoal (approximately #414448); center/front ribbon-like subunit light silver gray (approximately #A0A3A5); right/back subunit medium graphite gray (approximately #74787C). Preserve realistic soft highlights and shading within each subunit, but make their underlying gray tones distinguishable at small website display sizes. Exactly three subunits, no new boundaries or added lobes. Change ONLY the shades of these existing three protein subunits. Preserve their silhouettes, position, overlaps, membrane attachment, texture, and all geometry. Keep cyan receptor, both membranes, background, lighting, camera, spacing, aspect ratio and composition unchanged. No changes to receptor shape/color. No labels, arrows, recolored membranes, cropping or other alterations. This is a schematic, not experimental data or a molecular model.

## Antibody edit prompt

Use case: precise-object-edit. Edit this existing generic conceptual educational illustration ONLY to distinguish the three gray subunits of the viral surface protein. Keep the original 1536x1024 landscape composition. Assign three clearly distinguishable but restrained neutral gray base shades: left/back subunit dark charcoal (approximately #414448); center/front ribbon-like subunit light silver gray (approximately #A0A3A5); right/back subunit that the gold antibody touches medium graphite gray (approximately #74787C). Preserve soft highlights and shading within each subunit, but their underlying gray tones must remain distinguishable at small website sizes. Exactly three existing subunits, no new boundaries or added lobes. Change ONLY the shades of those existing three protein subunits. Preserve silhouettes, position, overlaps, membrane attachment, texture, and ALL geometry. Absolutely preserve the gold antibody exactly: its Y shape, arm and stem lengths, orientation, existing arm-tip contact with the rightmost protein subunit, and separated free stem. Do not move or resize the antibody, its contact or the cyan receptor. Both membranes, background, lighting, camera, spacing, aspect ratio and composition unchanged. No labels, arrows, extra elements, cropping, recolored membranes, or other alterations. This is a schematic, not experimental data or a molecular model.
