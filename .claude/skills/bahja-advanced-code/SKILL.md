---
name: bahja-advanced-code
description: Design, write, upgrade and test "كود متقدّم" (advanced HTML/CSS/JS code) for Bahja / Bahga invitations — intro screens (كود الافتتاحية), custom sections (hero, ayah/verse, countdown, timeline, location, RSVP, agenda), and text overlays on top of section or intro videos. Use this skill whenever the user pastes a style/script snippet from the invitation editor, asks for a new section or intro "بكود متقدّم", says a design looks "simple" and wants it "احترافي / فخم / بروفيشنال", reports that a code box looks broken in the live preview, or asks to make an invitation code faster — even if they never say the word "skill" or "advanced code".
---

# Bahja advanced code

Bahja is a wedding/engagement invitation builder (React viewer + editor, Django on PythonAnywhere). Inside the editor, the user pastes a self-contained snippet — `<style>` + HTML + `<script>` — into a «كود متقدّم» box. That snippet is the deliverable. It must look high-end, survive the app's mounting rules, stay light enough not to stutter a phone, and arrive complete so the user can paste it as-is.

The user speaks Egyptian Arabic. Reply in Egyptian Arabic; the text inside invitations is usually English unless they ask otherwise.

## Workflow

1. **Identify where the code will live**, because each place mounts it differently and that decides the root element's CSS:
   - **Intro** (`settings.intro_code`, inside `.lb-intro .lb-intro-extra`): a full-screen cover, `position: fixed; inset: 0` works here.
   - **Section box** (`props.code`, inside `.lb-extra-html`): in-flow, `contain: layout` — `position: fixed` gets trapped.
   - **Over a video** (`.lb-video-wrap > .lb-video-code > .lb-extra-html`): needs a root sized to the video by script.

   Read `references/runtime.md` before writing anything. It covers the mounting rules, the `root` variable, `window.__lbIntro.open()`, the `lb:intro-open` event, how the intro "cover" is detected, and the editor's `data-move` handling.
2. **Start from the closest existing snippet** in `docs/snippets/`. `references/examples.md` says which one fits which job. Reusing a tested skeleton avoids re-learning the mounting bugs.
3. **Design it properly.** Read `references/design-language.md`. "احترافي" means restraint, a coherent palette, hairline gold detail, real typographic hierarchy, and choreographed motion. It does not mean more effects.
4. **Respect the performance rules** in `references/performance.md`. They were measured on the live preview, not guessed, and violating them is what made earlier intros freeze on phones.
5. **Test it for real** with the bundled harness (see "Testing" below). Look at the screenshots yourself and fix what looks off before handing over.
6. **Deliver**:
   - Save the snippet to `docs/snippets/<kind>-<event>-<names>.html`. When upgrading an existing one, use a new name such as `…-luxe.html` so the old version stays.
   - Send the file and a couple of stage screenshots with `SendUserFile`.
   - Print the **complete** code in one fenced block in chat. No diffs and no "rest unchanged": the user pastes it straight into the editor. The printed code must be byte-identical to what you tested.
   - Say plainly what was not tested (for example "ما اتجرّبش جوه المحرر نفسه").

## Hard-won rules (short version — details in references)

- **Fonts already on the page:** Amiri, Aref Ruqaa, Cairo, Cormorant Garamond, Gelasio, Great Vibes, Marcellus, Montserrat, Playfair Display, Reem Kufi, Tajawal. `<link>` and `@import` inside a snippet are stripped or ignored. Any other font has to be uploaded on the fonts page. If you use one, download the OFL file from `google/fonts` on GitHub, send it with `SendUserFile`, tell the user to upload it with the **exact** family name used in the CSS, and always add a fallback.
- **Scope every class** with a short unique prefix (`.bw-`, `.tl-`, `.gl-`…). The snippet shares the page with the template and other snippets.
- **Script context:** `root` is the invitation/intro element. Query through `root.querySelector('.prefix')` and guard against a missing root or a double run (`data-ready`).
- **Intro must end:** call `window.__lbIntro.open()` when the animation finishes. Also listen for `lb:intro-open` on `document` (opened from outside: countdown, skip) and stop the rAF loops when it arrives.
- **Don't animate `translate`** (the property) on elements the editor can move. The editor uses `translate: var(--dx) var(--dy)` on `[data-move^="ce-"]`. Animate `transform` instead.
- **Old drag offsets:** when the user replaces a snippet, offsets saved for the old `ce-N` elements may land on different elements. Tell them to reset anything that looks shifted.
- **Section/overlay animations start only after the intro opens** (on `lb:intro-open`, with a 500 ms poll on `.lb-intro.is-open` as a fallback). Starting earlier competes with the intro video.
- **Don't `seek` a video before `play()`.** iOS 26 Safari never finishes that seek and the intro looks frozen.

## Testing

The bundled scripts reproduce the app's containers closely enough to catch layout and timing bugs:

```bash
python .claude/skills/bahja-advanced-code/scripts/build_harness.py <snippet.html> <out_dir> --mode intro|section|video
cd <out_dir> && python -m http.server 8765        # run in background
cd frontend && node ../.claude/skills/bahja-advanced-code/scripts/shots.mjs http://localhost:8765/ <shots_dir> --click --times 500,1300,2600,4000,6000
```

- `shots.mjs` has to run from `frontend/`, where Playwright is installed.
- It screenshots mobile (390×844 @2x), desktop (1440×860) and landscape (844×390) by default. It prints page errors, and for intros it also prints whether `__lbIntro.open()` was called.
- Read the PNGs and check: nothing clipped, text readable over its background, the card fits on mobile, the button isn't covered by the frame in landscape, and the end state opens the invitation.
- Screenshot timing drifts later than the nominal times (each capture takes time), so judge each stage by what it shows.
- Stop the http server when done.

The harness can't reproduce everything: the editor's drag handles, the real template CSS, music, the real intro video, or iOS Safari quirks. Name those as untested. For iPhone-only issues, use the live page with `?debug=1`.

## Reference files

- `references/runtime.md` — how each code box is mounted and what the runtime expects (read first)
- `references/performance.md` — measured do/don't list for animations over video and scrolling
- `references/design-language.md` — the luxury look: palette, ornaments, typography, motion choreography, upgrade checklist
- `references/examples.md` — which existing snippet to start from for each kind of request
