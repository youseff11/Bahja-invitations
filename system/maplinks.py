"""روابط خرائط جوجل اللي بتتعرض للضيف: الخريطة المضمّنة وزرار «افتح الاتجاهات».

ليه الملف ده موجود (نوفمبر 2026):

• رابط التضمين القديم ‎https://www.google.com/maps?q=…&output=embed‎ بقى
  جوجل بيرد عليه بتحويل 301 لـ‎/maps/embed?origin=mfe&pb=…‎، والتحويل نفسه
  عليه ‎X-Frame-Options: SAMEORIGIN‎. كروم العادي بيكمّل، لكن متصفحات
  التطبيقات على أندرويد (فيسبوك/ماسنجر/واتساب — WebView) بتوقف عند التحويل
  وبتعرض «Webpage not available … ERR_BLOCKED_BY_RESPONSE» جوّه الخريطة.
  الحل: نبني رابط ‎/maps/embed?origin=mfe&pb=…‎ النهائي على طول، من غير تحويل.

• الروابط المختصرة ‎maps.app.goo.gl‎ اللي العملاء بيبعتوها ساعات مابتفتحش
  من جوّه متصفح التطبيق. لو عندنا إحداثيات أو اسم المكان من خانة التضمين،
  زرار الاتجاهات بيستخدم الرابط الرسمي ‎/maps/search/?api=1&query=…‎ اللي
  بيفتح تطبيق الخرايط على أي موبايل.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, quote, quote_plus, unquote_plus, urlparse

SHORT_HOSTS = ("goo.gl", "maps.app.goo.gl", "g.co")
_PB_LATLNG_RE = re.compile(r"!2d(-?\d{1,3}(?:\.\d+)?)!3d(-?\d{1,2}(?:\.\d+)?)")
_PB_TEXT_RE = re.compile(r"!2m1!1s([^!]+)")


def _host(parsed) -> str:
    host = (parsed.netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def is_google_host(host: str) -> bool:
    return host.startswith("google.") or host.startswith("maps.google.") or ".google." in host


def embed_src(query: str, zoom: str = "") -> str:
    """رابط تضمين جوجل النهائي (من غير تحويل) لإحداثيات أو نص بحث.

    ‎pb‎ هي صيغة جوجل المضغوطة: ‎!1m<عدد العناصر>!2m1!1s<البحث>[!6i<الزوم>]‎.
    جوّه ‎!1s‎ الـ‎!‎ و‎*‎ ليهم معنى، فبيتعملهم escape زي أي رمز تاني.
    """
    query = str(query or "").strip()
    if not query:
        return ""
    text = quote_plus(query, safe=",")
    pb = f"!2m1!1s{text}"
    count = 2
    zoom = str(zoom or "").strip()
    if zoom:
        try:
            pb += f"!6i{int(round(float(zoom)))}"
            count = 3
        except ValueError:
            pass
    return f"https://www.google.com/maps/embed?origin=mfe&pb=!1m{count}{pb}"


def modernize_embed(src: str) -> str:
    """يحوّل رابط تضمين ‎?output=embed‎ القديم للصيغة النهائية؛ غير كده بيرجّعه زي ما هو."""
    raw = str(src or "").strip()
    if "output=embed" not in raw:
        return src
    try:
        parsed = urlparse(raw.replace("&amp;", "&"))
    except ValueError:
        return src
    if not is_google_host(_host(parsed)) or not (parsed.path or "").startswith("/maps"):
        return src
    params = parse_qs(parsed.query or "")

    def first(*names: str) -> str:
        for name in names:
            values = params.get(name) or []
            if values and str(values[0]).strip():
                return str(values[0]).strip()
        return ""

    query = first("q", "ll", "daddr", "query")
    if not query:
        return src
    zoom = first("z", "zoom")
    return embed_src(query, zoom) or src


def embed_query(embed_url: str) -> str:
    """المكان (إحداثيات أو اسم) اللي رابط تضمين جوجل بيشاور عليه، أو فاضي."""
    raw = str(embed_url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
    except ValueError:
        return ""
    if not is_google_host(_host(parsed)):
        return ""
    q = (parse_qs(parsed.query or "").get("q") or [""])[0].strip()
    if q:
        return q
    pb = (parse_qs(parsed.query or "").get("pb") or [""])[0]
    if pb:
        # ‎!1s<بحث>‎ (اللي ‎embed_src‎ بيبنيه) أو ‎!2d<طول>!3d<عرض>‎ (كود «تضمين خريطة» من جوجل)
        coords = _PB_LATLNG_RE.search(pb)
        if coords:
            return f"{coords.group(2)},{coords.group(1)}"
        text = _PB_TEXT_RE.search(pb)
        if text:
            return unquote_plus(text.group(1)).strip()
    return ""


def search_url(query: str) -> str:
    """رابط خرائط جوجل الرسمي اللي بيفتح التطبيق على أي موبايل."""
    query = str(query or "").strip()
    if not query:
        return ""
    return "https://www.google.com/maps/search/?api=1&query=" + quote(query, safe="")


def is_short_link(link: str) -> bool:
    try:
        return _host(urlparse(str(link or "").strip())) in SHORT_HOSTS
    except ValueError:
        return False


def open_url(map_link: str, embed_url: str) -> str:
    """الرابط اللي يفتح المكان للضيف (زرار الاتجاهات والضغط على الخريطة).

    رابط العميل الكامل بيفضل زي ما هو. المختصر (أو مفيش رابط) بيتبدّل بالرابط
    الرسمي لو خانة التضمين فيها المكان؛ ولو مفيش، المختصر بيفضل أحسن من مفيش.
    """
    link = str(map_link or "").strip()
    if link and not is_short_link(link):
        return link
    query = embed_query(embed_url)
    if query:
        return search_url(query)
    return link
