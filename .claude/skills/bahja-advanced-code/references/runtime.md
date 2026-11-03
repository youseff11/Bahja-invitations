# How Bahja mounts advanced code

Source of truth: `frontend/src/features/invite/invite.css`, `frontend/src/features/invite/Intro.tsx`, `frontend/src/features/invite/runtime/intro-code.ts`, `frontend/src/features/invite/runtime/code-roots.ts`. If something here looks stale, check those files.

## Contents
1. The snippet format
2. Intro code (`.lb-intro-extra`)
3. Section code (`.lb-extra-html`)
4. Code over a video (`.lb-video-code`)
5. The editor: `data-move`, text editing, dragging
6. Events and globals

## 1. The snippet format

One string with `<style>…</style>`, HTML, and `<script>…</script>`. The app injects the HTML, then runs the script with a variable `root` in scope (the invitation / intro element). Keep everything self-contained:

- Wrap the script in an IIFE. Find your root with `root.querySelector('.prefix')`. Fall back to `document` when `root` is undefined (`(typeof root !== 'undefined' && root) || document`).
- Guard against double execution: the editor re-renders. Set a `data-ready` attribute on the scope and return early if it's already there.
- Keep a short HTML comment at the top in Egyptian Arabic: what it is, where to paste it, and which lines carry `EDIT:` markers for names and texts. The user edits those lines by hand.
- SVG gradient/symbol ids are page-global. Prefix them too (`bwGold`, `glSeal`).

## 2. Intro code — `settings.intro_code`

Mounted as `.lb-intro > .lb-intro-extra[data-intro-item="code"]`. `.lb-intro-extra` is deliberately `position: static; transform: none` with **no `contain`**, so `position: fixed; inset: 0` really covers the viewport. Full-screen intro designs are expected.

**Cover detection** (`intro-code.ts`): the runtime scans the intro for a "cover" — the first element inside `.lb-intro-extra` that:
- spans at least 90 % of the viewport on both axes, and
- paints something (a background-image, a background-color with alpha above 0.5, an IMG or a VIDEO), and
- isn't fading out.

An element that has `pointer-events: none`, no children and no text is ignored as decoration. So put the background **on the root element itself**, and keep grain or vignette layers as empty `pointer-events: none` divs.

While a cover is showing:
- A click anywhere is forwarded to the cover's single button (`button`, `[role=button]`, `a[href]`…) if it has exactly one. Keep exactly one real button in the intro; the forwarded click bubbles to your root, so a click listener on the root sees it.
- The guest's first click dispatches `lb:intro-play` (music starts inside the click for Safari).
- When the cover stops being shown, the invitation opens about 120 ms later. "Not shown" means removed, `visibility: hidden`, opacity below 0.05, or an animation or transition running whose last keyframe has opacity below 0.05. So a fade-out on the root opens the invitation at the **start** of the fade.
- If the code shows no reaction at all within 700 ms of a click (no DOM mutation and no finite animation running), the runtime opens anyway, so a dead script never traps the guest.

**Ending:** call `window.__lbIntro.open()` yourself at the end of the sequence; the runtime guards against double opening. Then mark the root done after the fade:
- set `visibility: hidden`;
- stop CSS animations (`.is-done * { animation: none !important }`);
- stop canvas loops (`alive = false`).

Infinite animations on a hidden overlay still cost frames.

**Opened from outside** (countdown, skip, the editor's triple click): `document` gets `lb:intro-open`. Listen once and stop your loops.

`--intro-item-x / --intro-item-y` move the whole box via margins. Your fixed root ignores them, which is fine.

## 3. Section code — `props.code`

Mounted as `.lb-extra-html` at the end of the `<section>`. Its CSS:

- `position: relative; z-index: 2; width: max-content; max-width: 100%; margin-inline: auto; padding: 3px; contain: layout; transform: none !important`
- Offsets go through `left: var(--dx)` and `margin-top: var(--dy)`.
- Direct children get `margin-inline: auto`.

Consequences:
- `contain: layout` makes the box the containing block for `position: fixed`, so "fixed full screen" collapses into the box. Design sections in normal flow.
- `width: max-content` means a root with `width: 100%` of nothing can collapse. Give the root an explicit width: `width: min(100%, 520px)`, or `100vw` minus gutters for full-bleed.
- The 3 px padding shifts things. Compensate with `translate: -3px -3px` on an absolutely positioned root, or measure as described in the video case.
- Paint isn't contained, so content may overflow visually (an envelope opening, a card rising), and `:has([data-move^="ce-"])` forces `overflow: visible`.
- `canvas` inside code boxes gets `display: block; touch-action: none; pointer-events: auto` (finger drawing). Set `pointer-events: none` on a decorative canvas, or it eats scroll gestures.

## 4. Code over a video section

DOM: `.lb-video-wrap > .lb-video-code > .lb-extra-html > your root`. `.lb-video-code` is `position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none`, and the inner box is the max-content box from section 3. Naive `position: absolute; inset: 0` ends up in a ~6 px box, and all the text piles up in the middle of the video. It looks fine in the editor and broken in the live preview.

Pattern that works (from `docs/snippets/engagement-tarek-laila.html`):

```css
.tl {
  position: relative;
  width: min(100vw, calc(120vh * var(--ar, 9/16)));
  aspect-ratio: var(--ar, 9/16);   /* --ar is inherited from .lb-video-wrap */
  container-type: inline-size;
  translate: -3px -3px;
  pointer-events: none;           /* text over video should not steal taps */
  background: none;               /* the video is underneath */
}
```

```js
var wrap = scope.closest ? scope.closest('.lb-video-wrap') : null;
if (wrap && 'ResizeObserver' in window) {
  var fit = function () {
    var w = wrap.offsetWidth, h = wrap.offsetHeight;
    if (!w || !h) return;
    scope.style.width = w + 'px'; scope.style.height = h + 'px'; scope.style.aspectRatio = 'auto';
    scope.style.translate = '0px 0px';
    var a = wrap.getBoundingClientRect(), b = scope.getBoundingClientRect();
    scope.style.translate = (a.left - b.left) + 'px ' + (a.top - b.top) + 'px';
  };
  fit();
  new ResizeObserver(fit).observe(wrap);
}
```

Children are absolutely positioned inside the root and sized with `cqw` units, so they scale with the video.

## 5. The editor

- The editor tags elements inside code boxes with `data-move="ce-N"` (numbered in DOM order) so the user can drag them and edit their text. A pasted snippet often comes back from the user already carrying these attributes. That's normal: you can drop them in your rewrite, because the editor re-adds them.
- `[data-move^="ce-"] { translate: var(--dx) var(--dy) }`. If your CSS animates the `translate` property on such an element, dragging breaks. Animate `transform`; it composes with `translate`.
- Offsets are stored per `ce-N` (`settings.intro_code_layout` for intros, `block.layout` for sections). After a structural rewrite the numbers point at different elements, so tell the user to re-check or reset moved items.
- Text nodes are editable in place. Keep names and texts as plain text in their own elements, not baked into SVG paths or canvas, so the user can edit them. Exception: duplicated decorative copies, such as two halves of a seal, can be cloned from one source by the script. The user then edits a single place.
- In the editor, three quick clicks skip the intro, and the «Try intro» button runs it like a guest.

## 6. Events and globals

| Name | Where | Meaning |
|---|---|---|
| `root` | script scope | invitation/intro element to query from |
| `window.__lbIntro.open()` | global | open the invitation (idempotent) |
| `lb:intro-play` | `document` | guest clicked the intro (music started) |
| `lb:intro-open` | `document` | invitation opened (any cause) |
| `.lb-intro.is-open` | DOM | intro already open — poll as a fallback |
| `?debug=1` | live URL | on-screen intro diagnostics panel (iPhone debugging) |
