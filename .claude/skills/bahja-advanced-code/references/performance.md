# Performance rules (measured, not guessed)

These rules come from measuring the live preview (`/templates/template-4/preview/` on PythonAnywhere) in Chrome. Each one fixed a real complaint: a frozen intro video, slow first scroll, or a 30 fps ayah section.

## What was measured

- **Intro video froze halfway.** The cause was the code text under it repainting every frame: infinite animations plus filters. Hiding that code alone let the video play its full 8 s.
- **Ayah section scrolled at about 30 fps.** A `transform: scale` pulse on 13 SVG dots (`transform-box: fill-box`) caused it. Switching the pulse to opacity only brought it back to about 124 fps.
- **First section was heavy on the first pass only.** An autoplaying 4.7 MB palace video was underneath text carrying `blur(34px)` and `drop-shadow`. That is a first-paint cost.

## Rules

Over a playing video (section or intro):
- No `filter: blur()`, no `drop-shadow()`, and no `text-shadow` with blur above about 6 px. A small `0 1px 3px` shadow is fine.
- No infinite animations.
- No `transform: scale` on SVG elements.
- No animated `background-position` on large text.
- The root is transparent with `pointer-events: none`.

Everywhere:
- Animate only `opacity` and `transform`. Keep animations finite where you can. Honor `prefers-reduced-motion` (shorten durations, drop loops).
- Don't start section animations while the intro is still closed. Wait for `lb:intro-open` (plus a 500 ms poll fallback, or start right away when there is no intro).
- Use one `<canvas>` for particles (petals, dust, sparks):
  - cap DPR at 2;
  - pre-render sprites once to offscreen canvases;
  - clamp `dt`;
  - pause when `document.hidden`;
  - stop the rAF loop when nothing is alive;
  - kill it entirely after the intro opens.
- On a full-screen intro (no video under it), a few gentle infinite loops are acceptable: envelope float, seal halo opacity, button sheen. Turn them off with `.is-done * { animation: none !important }` once the intro is gone.
- Static decorative layers are fine: SVG data-URI patterns, a noise tile generated once with `toDataURL`, radial-gradient vignettes. Avoid `mix-blend-mode` on full-screen layers above an animating canvas, because it forces a blend every frame.

## How to measure when someone says "it's slow"

1. Open the live preview in a fresh tab each time (the first pass is always slower).
2. `window.__lbIntro.open()`, wait, then scroll with `scrollTo` from rAF. Record the average frame time and the count of frames above 50 ms.
3. Isolate: inject `style` overrides one at a time (`animation: none`, `filter: none`, `display: none` on one part) and compare. Repeat runs, because numbers wobble when other heavy apps (Google Flow) are running, so trust only big differences.
4. Report the measured cause, not a guess.
