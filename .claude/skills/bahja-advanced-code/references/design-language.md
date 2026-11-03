# Design language — making it look high-end

When the user says a design is "سيمبل" and wants it "احترافي بدرجة عالية", what they are reacting to is usually flatness: one background color, one font weight, generic shapes, and motion that just fades. The fix is depth, material and craft, not more stuff. Aim for a printed luxury stationery feel: letterpress card, foil, wax, velvet.

## Contents
1. Palette
2. Surfaces and materials
3. Ornament
4. Typography
5. Motion choreography
6. Upgrade checklist

## 1. Palette

Pick three roles and stick to them:
- **Ground**: the dominant color, usually deep. Examples: burgundy `#5c0f26` with a lighter center `#6e1430` and near-black edges `#1f030b`; emerald, navy, or ivory for light themes.
- **Paper**: warm ivory, never pure white. Examples: `#fffaf4`, `#f8efe8`, and pocket shades `#f3e8e2` / `#eee1db`.
- **Accent metal**: champagne gold, in two strengths.
  - Light gold for dark grounds: `#e3c48a`, gradient `#f7e6bd → #d6b06a → #a98140 → #ecd29a`.
  - Ink gold for paper: `#9a7438`, gradient `#c9a15e → #9a7438`.

Use them like this:
- Gold is for hairlines, small ornaments, small-caps labels and one accent glyph (the `&`). It is never for large fills or body text.
- Names go in the ground color, not gold. That keeps the contrast high.
- Define everything as CSS custom properties on the root (`--bw-wine`, `--bw-gold`…) so a recolor is a five-line edit.

## 2. Surfaces and materials

- **Velvet background**: two stacked radial gradients (a lit center and darker edges), plus an SVG data-URI damask or lattice pattern at about 8 % opacity masked to fade at the edges, plus a noise tile (140 px, generated once by canvas, `opacity: .07`), plus a vignette.
- **Paper**: a soft diagonal gradient plus `repeating-linear-gradient` fibers at 1–2 % opacity.
- **Envelope liner**: the reveal moment deserves a pattern. Use the ground color with a gold lattice and an ivory paper rim around it.
- **Wax seal**:
  - an irregular edge (sine-perturbed circle path generated in JS);
  - a radial fill lit from the top-left;
  - a pressed inner disc lit from the opposite side (reads as debossed);
  - a dotted gold ring and a gold monogram with a 1 px dark offset copy for depth;
  - a soft specular ellipse.
- **Shadows**: one soft ambient plus one contact shadow. On "present" moments add a warm glow (`0 0 70px rgba(255,214,180,.3)`). Never use heavy black drop shadows.

## 3. Ornament

- **Frames**: a hairline 1 px border whose straight edges stop short of the corners, plus SVG corner flourishes (`<symbol>` reused via `<use>`, colored through a CSS variable such as `style="stroke:var(--c)"`, so the same symbol renders light gold on the ground and ink gold on paper). Add an optional faint inner rule 7 px in.
- **Dividers**: two short gently curved lines, a small diamond in the center and two dots. Animate their stroke drawing once (`stroke-dasharray`).
- **Gradients on straight SVG lines**: use `gradientUnits="userSpaceOnUse"`. With the default bounding-box units, a perfectly horizontal or vertical line has a zero-height box and **doesn't render**.
- **Restraint**: one ornament family per design. Diamonds and dots repeat at every scale: frame corners, divider, button.

## 4. Typography

Fonts available on the page: Great Vibes, Cormorant Garamond, Marcellus, Playfair Display, Gelasio, Montserrat; Amiri, Aref Ruqaa, Reem Kufi, Cairo, Tajawal for Arabic.

- **Names**: a script face (Great Vibes) at a large size, with line-height about .95 and horizontal padding so the swashes aren't clipped.
- **Labels**: Marcellus in uppercase, small, with `letter-spacing` .38–.55em. Add matching `padding-left` so the text stays optically centered.
- **Secondary lines**: Cormorant Garamond italic, weight 500.
- **Ampersand**: Playfair Display italic, gold.
- **Arabic**: Amiri or Aref Ruqaa for verses and names, Reem Kufi for labels. Never letter-space Arabic, because it breaks the joins.
- **Sizing**: size everything relative to one variable (`--w`, the envelope or card width, or `cqw` over video) so the composition scales as a unit.

## 5. Motion choreography

Professional motion has a sequence, weight and a final hold:

1. **Entrance (0–2 s, before interaction)**: the frame fades in, the label rises and the divider draws, the main object rises with a slight scale, and the call to action comes last. Stagger by 0.3–0.5 s.
2. **Idle invitation**: one subtle loop (a float of 6 px over 6 s, or a seal halo pulsing in opacity). Ambient particles stay sparse: 7–14 petals and 18–40 gold dust motes.
3. **Interaction beat**: press feedback first (scale .93 for 160 ms), then the event: the seal cracks, a gold spark burst plays and a ring shockwave spreads.
4. **Reveal**: one thing moves at a time, with overlaps of about 30 %. Example: flap opens, card rises, envelope drops away, card comes forward.
5. **Climax**: a one-time foil sheen across the card, a petal shower and a warm glow.
6. **Hold, then exit**: keep the final composition still for about 1.5–2 s so it can be read, then fade the whole overlay with a slight scale (1.05) and call `open()` as the fade starts.

Easing: `cubic-bezier(.2,.7,.2,1)` for things settling in, `cubic-bezier(.55,0,.75,.35)` for things falling away. Never use linear. Total length is 5–6 s from click to open. A second click skips ahead.

## 6. Upgrade checklist (turning "simple" into "luxe")

- [ ] The background has depth (light center, dark edge), texture (grain) and a faint pattern.
- [ ] Gold hairline frame with corner ornaments.
- [ ] The main object has material detail: paper fibers, seams, liner, a realistic seal.
- [ ] Clear type hierarchy, with three typefaces at most, each in its role.
- [ ] Every motion has a purpose and the sequence ends on a readable hold.
- [ ] Particles are varied (shaded petals in three tones, glowing dust) and sparse.
- [ ] The button looks engraved (hairline gold border, inner double rule, small diamonds), not like an app pill.
- [ ] It works at 390×844, 1440×860 and 844×390, and in reduced-motion mode.
- [ ] Names and texts are still plain editable text with `EDIT:` markers.
