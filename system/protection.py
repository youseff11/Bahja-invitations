"""حماية القوالب من أدوات نسخ المواقع (saveweb2zip، HTTrack، wget …).

مفيش حماية 100% لصفحة بتتعرض في متصفح — اللي المتصفح بيستلمه يقدر حد متمرّس يحفظه.
الهدف هنا رفع التكلفة على اللي بينسخ بأداة جاهزة ويرفع الناتج على موقعه:

1. **صفحة خفيفة لغير المتصفحات** — أي طلب مش شبه متصفح حقيقي (من غير ‎Accept: text/html‎،
   أو ‎User-Agent‎ أداة، أو ‎Sec-Fetch-Mode‎ مش ‎navigate‎) بياخد صفحة فيها الميتا بس
   (معاينة واتساب وفيسبوك بتفضل شغّالة) من غير محتوى القالب ولا الأكواد ولا روابط الوسائط.
   متصفح اتصنّف غلط بيعدّي تلقائياً: الصفحة الخفيفة بتحط كوكي وبتعمل reload (الأدوات اللي
   مابتشغّلش جافاسكربت مابتعدّيش).
2. **قفل الدومين** — سكربت مضمّن في الصفحة: لو اتفتحت من دومين غير دومين الموقع (نسخة اترفعت
   على موقع تاني أو اتفتحت من ملف) بيفضّي الصفحة ويرجّع الزائر للموقع الأصلي.
3. **واجهة المعاينة الـJSON** (‎/api/v1/templates/<slug>/preview/‎) مقصورة على طلبات صفحاتنا
   نفسها (نفس الأصل) — ‎curl‎ والسكربتات بترجع 403.

لا يغطّي ملفات ‎/media/‎ (صور/فيديو/خطوط): الاستضافة المجانية بتقدّمها من طبقتها قبل Django.
بتتقفل بـ‎PROTECT_TEMPLATES=0‎ في ‎.env‎.
"""

from __future__ import annotations

import hmac
import json
import re
from urllib.parse import urlsplit

from django.conf import settings

# أدوات بتحط User-Agent واضح ومعاه Accept: text/html (متصفحات headless وأدوات نسخ).
_TOOL_UA = re.compile(
    r"headless|phantomjs|puppeteer|playwright|selenium|httrack|webcopier|"
    r"offline explorer|teleport|sitesucker|saveweb|webzip|website downloader|"
    r"python|curl|wget|libwww|scrapy|aiohttp|httpx|go-http|java/|okhttp|"
    r"node-fetch|axios|undici|postman|insomnia",
    re.IGNORECASE,
)

COOKIE = "bjv"      # بيحطه جافاسكربت الصفحة الخفيفة — دليل إن في متصفح بيشغّل سكربتات
BYPASS_HEADER = "HTTP_X_BAHJA_BYPASS"


def enabled() -> bool:
    return bool(getattr(settings, "PROTECT_TEMPLATES", False))


def _bypassed(request) -> bool:
    token = getattr(settings, "PROTECT_BYPASS_TOKEN", "")
    given = request.META.get(BYPASS_HEADER, "")
    return bool(token) and hmac.compare_digest(given, token)


def _user_agent(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")


def is_browser(request) -> bool:
    """هل الطلب شبه تنقّل متصفح حقيقي؟ (لو الحماية مقفولة: دايماً آه)."""
    if not enabled() or _bypassed(request):
        return True
    ua = _user_agent(request)
    if not ua or _TOOL_UA.search(ua):
        return False
    if request.COOKIES.get(COOKIE) == "1":
        return True
    if "text/html" not in request.META.get("HTTP_ACCEPT", ""):
        return False
    mode = request.META.get("HTTP_SEC_FETCH_MODE")
    return mode in (None, "", "navigate")


def _host_of(value: str) -> str:
    return (urlsplit(value).hostname or "").lower()


def allowed_hosts(request) -> list[str]:
    """الدومينات اللي مسموح للصفحة تشتغل عليها: اللي اتقدّمت منه + دومين الموقع + الإضافية."""
    names = {request.get_host().split(":")[0].lower(),
             _host_of(settings.SITE_URL), "localhost", "127.0.0.1", "[::1]"}
    names.update(h.lower() for h in getattr(settings, "PROTECT_ALLOWED_HOSTS", []))
    for name in list(names):
        if name.startswith("www."):
            names.add(name[4:])
        elif name.count(".") == 1:
            names.add("www." + name)
    return sorted(n for n in names if n)


def _js(value) -> str:
    """JSON آمن جوّه وسم ‎<script>‎."""
    return (json.dumps(value, ensure_ascii=True)
            .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))


def domain_lock(request) -> dict | None:
    """سياق قفل الدومين للقالب (‎None‎ لو الحماية مقفولة)."""
    if not enabled():
        return None
    return {"hosts": _js(allowed_hosts(request)),
            "home": _js(request.build_absolute_uri("/"))}


def is_same_origin(request) -> bool:
    """طلب ‎fetch‎ جاي من صفحة على نفس الموقع (مش curl ولا موقع تاني)."""
    if not enabled() or _bypassed(request):
        return True
    site = request.get_host().split(":")[0].lower()
    fetch_site = request.META.get("HTTP_SEC_FETCH_SITE")
    if fetch_site:
        return fetch_site == "same-origin"
    for header in ("HTTP_ORIGIN", "HTTP_REFERER"):
        value = request.META.get(header, "")
        if value:
            return _host_of(value) == site
    return False
