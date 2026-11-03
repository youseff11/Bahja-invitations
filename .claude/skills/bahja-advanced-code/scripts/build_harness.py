"""Build a local test page that mounts a Bahja advanced-code snippet the way the app does.

usage: python build_harness.py <snippet.html> <out_dir> [--mode intro|section|video] [--ar 9/16] [--video file.mp4]

Writes <out_dir>/index.html. Serve it with `python -m http.server 8765` from <out_dir>
(fonts come from Google Fonts, so file:// works too but http is closer to the real thing).

Mirrors the container CSS from frontend/src/features/invite/invite.css:
  intro   -> .lb-intro > .lb-intro-extra (static, no contain: fixed covers the screen)
  section -> .lb-inner > section.lb > .lb-extra-html (max-content, padding 3px, contain: layout)
  video   -> .lb-video-wrap > .lb-video-code > .lb-extra-html (grid-centred max-content box)
"""
import argparse
import html
import os
import re
import sys

FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700"
    "&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Gelasio:ital@0;1"
    "&family=Great+Vibes&family=Marcellus&family=Montserrat:wght@300;400;600"
    "&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Reem+Kufi:wght@400;600&family=Tajawal:wght@400;700"
    "&display=swap"
)

APP_CSS = """
html, body { margin: 0; background: #f4efe9; font-family: Cairo, sans-serif; }
.lb-inner { max-width: 460px; margin: 0 auto; background: #fff; min-height: 100vh; }
section.lb { position: relative; padding: 48px 16px; text-align: center; }
.lb-extra-html {
  position: relative; z-index: 2;
  left: var(--dx, 0px); margin-top: var(--dy, 0px);
  transform: none !important;
  width: max-content; max-width: 100%; margin-inline: auto;
  padding: 3px; box-sizing: border-box;
  contain: layout;
  text-align: var(--block-align, center);
}
.lb-extra-html > *, .lb-intro-extra > * { margin-inline: auto; }
.lb-extra-html canvas, .lb-intro-extra canvas { display: block; max-width: 100%; touch-action: none; pointer-events: auto; }
.lb-intro { position: fixed; inset: 0; z-index: 50; background: #222; }
.lb-intro.is-open { display: none; }
.lb-intro-extra { position: static; transform: none !important; max-width: 100%; }
.lb-video-wrap { position: relative; --ar: __AR__; aspect-ratio: var(--ar); width: 100%; overflow: visible;
  background: linear-gradient(160deg, #3a4a5a, #1b232c); }
.lb-video-wrap video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.lb-video-wrap .lb-video-code { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; pointer-events: none; }
.lb-video-wrap .lb-video-code .lb-extra-html { pointer-events: auto; margin-top: 0; margin-inline: 0; }
.filler { padding: 40px 16px; color: #777; text-align: center; }
"""

STUB = """
window.__lbIntro = {
  open: function () {
    if (document.body.dataset.opened) return;
    document.body.dataset.opened = String(Date.now());
    var intro = document.querySelector('.lb-intro');
    if (intro) intro.classList.add('is-open');
    console.log('LB_INTRO_OPENED');
    document.dispatchEvent(new CustomEvent('lb:intro-open'));
  },
  isOpen: function () { return !!document.body.dataset.opened; }
};
"""


def split(src):
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", src, re.S | re.I)
    body = re.sub(r"<script[^>]*>.*?</script>", "", src, flags=re.S | re.I)
    return body, "\n".join(scripts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("snippet")
    ap.add_argument("out_dir")
    ap.add_argument("--mode", choices=["intro", "section", "video"], default="intro")
    ap.add_argument("--ar", default="9/16", help="video aspect ratio for --mode video")
    ap.add_argument("--video", help="optional video file to play under the overlay (copied next to index.html)")
    a = ap.parse_args()

    src = open(a.snippet, encoding="utf-8").read()
    body, script = split(src)
    os.makedirs(a.out_dir, exist_ok=True)

    video_tag = ""
    if a.video:
        import shutil
        name = os.path.basename(a.video)
        shutil.copy(a.video, os.path.join(a.out_dir, name))
        video_tag = '<video src="%s" autoplay muted loop playsinline></video>' % html.escape(name)

    if a.mode == "intro":
        mount = (
            '<div class="lb-inner"><div class="filler"><h1>INVITATION CONTENT</h1></div></div>'
            '<div class="lb-intro"><div class="lb-intro-extra" data-intro-item="code">%s</div></div>' % body
        )
        root_expr = "document.querySelector('.lb-intro')"
    elif a.mode == "section":
        mount = (
            '<div class="lb-inner"><div class="filler">section above</div>'
            '<section class="lb" data-block="test"><div class="lb-extra-html">%s</div></section>'
            '<div class="filler">section below</div></div>' % body
        )
        root_expr = "document.querySelector('.lb-inner')"
    else:
        mount = (
            '<div class="lb-inner"><section class="lb" data-block="test" style="padding:0">'
            '<div class="lb-video-wrap">%s<div class="lb-video-code"><div class="lb-extra-html">%s</div></div></div>'
            '</section><div class="filler">section below</div></div>' % (video_tag, body)
        )
        root_expr = "document.querySelector('.lb-inner')"

    page = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="__FONTS__">
<style>__CSS__</style></head><body>
__MOUNT__
<script>__STUB__
window.addEventListener('error', function (e) { console.error('PAGE_ERROR ' + e.message); });
(document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
  var root = __ROOT__;
  try { (function (root) { __SCRIPT__
  })(root); } catch (e) { console.error('SNIPPET_ERROR ' + e.message); }
});
</script></body></html>"""
    # the snippet goes in last so placeholder-looking text inside it is left alone
    for key, val in (("__FONTS__", FONTS), ("__CSS__", APP_CSS.replace("__AR__", a.ar)), ("__STUB__", STUB),
                     ("__ROOT__", root_expr), ("__MOUNT__", mount), ("__SCRIPT__", script)):
        page = page.replace(key, val, 1)
    out = os.path.join(a.out_dir, "index.html")
    open(out, "w", encoding="utf-8").write(page)
    print(out)


if __name__ == "__main__":
    sys.exit(main())
