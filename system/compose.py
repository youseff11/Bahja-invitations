"""حتت قسم «اعملوا دعوتكم بذوقكم» في الرئيسية (‎Template.compose_pieces‎).

الشكل المخزّن:
    {
      "background": {"src": "/media/…webp", "tone": "light" | "dark"},
      "intro":  {"src": "/media/…webp", "on": "any"},
      "ayah":   {"src": "/media/…webp", "on": "any" | "light" | "dark"},
      …
    }
- ‎background‎: خلفية القالب لوحدها؛ لما الزائر يختار افتتاحية القالب ده، بقية الدعوة بتتعرض عليها.
- كل جزء صورة شفافة (من غير خلفية قسمه)، و‎on‎ بيقول الجزء ده بيبان على أنهي خلفية:
  ‎any‎ (كارت بسطحه)، ‎light‎ (كلامه غامق)، ‎dark‎ (كلامه فاتح).
- القيمة القديمة (رابط نصّي بس) بتتقري كـ ‎{"src": رابط, "on": "any"}‎.
"""

from __future__ import annotations

from .models import COMPOSE_PARTS

TONES = ("light", "dark")
ON = ("any", "light", "dark")


class ComposeError(ValueError):
    pass


def _url(value) -> str:
    url = str(value or "").strip()
    if not url:
        return ""
    if not (url.startswith("/media/") or url.startswith("https://")) or len(url) > 500:
        raise ComposeError("رابط غير صالح.")
    return url


def clean(raw) -> dict:
    """يتحقق من القيمة اللي جاية من لوحة التحكم ويرجّعها بالشكل المخزّن (بيرمي ‎ComposeError‎)."""
    if not isinstance(raw, dict):
        raise ComposeError("composePieces لازم يكون object.")
    out: dict = {}
    for key, value in raw.items():
        if key == "background":
            if not value:
                continue
            if not isinstance(value, dict):
                raise ComposeError("background لازم يكون {src, tone}.")
            src = _url(value.get("src"))
            tone = value.get("tone") or "light"
            if tone not in TONES:
                raise ComposeError("tone لازم يكون light أو dark.")
            if src:
                out["background"] = {"src": src, "tone": tone}
            continue
        if key not in COMPOSE_PARTS:
            raise ComposeError(f"جزء مش معروف: {key}")
        if isinstance(value, dict):
            src, on = _url(value.get("src")), value.get("on") or "any"
        else:
            src, on = _url(value), "any"
        if on not in ON:
            raise ComposeError(f"on غير صالح للجزء {key}.")
        if src:
            out[key] = {"src": src, "on": on}
    return out


def read(raw) -> dict:
    """القراءة الآمنة من المخزّن (بتتجاهل أي حاجة بايظة بدل ما توقع الصفحة)."""
    if not isinstance(raw, dict):
        return {}
    out: dict = {}
    bg = raw.get("background")
    if isinstance(bg, dict) and isinstance(bg.get("src"), str) and bg["src"]:
        out["background"] = {"src": bg["src"], "tone": bg.get("tone") if bg.get("tone") in TONES else "light"}
    for key in COMPOSE_PARTS:
        value = raw.get(key)
        if isinstance(value, str) and value:
            out[key] = {"src": value, "on": "any"}
        elif isinstance(value, dict) and isinstance(value.get("src"), str) and value["src"]:
            out[key] = {"src": value["src"], "on": value.get("on") if value.get("on") in ON else "any"}
    return out


def parts(raw) -> list[str]:
    """الأجزاء الموجودة (من غير الخلفية) — اللي بيتعدّ في لوحة التحكم."""
    data = read(raw)
    return [k for k in COMPOSE_PARTS if k in data]
