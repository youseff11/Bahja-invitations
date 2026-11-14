"""صفحة الـshell اللي بيتحمّل فيها تطبيق React.

Django بيقدّم HTML واحد صغير: الـ``<head>`` (العنوان، OG، canonical) بيتبني
هنا على السيرفر — زواحف واتساب وفيسبوك مابتشغّلش جافاسكربت — وبعدها React
بياخد الصفحة. بيانات البداية (المستخدم وإعدادات الموقع) بتتحط في
``<script type="application/json" id="boot-data">`` فمفيش طلب إضافي قبل الرسم.
"""

from __future__ import annotations

from django.conf import settings
from django.shortcuts import render
from django.utils.translation import get_language, get_language_bidi
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_safe

from .api.serializers import site_payload, user_payload


def boot_payload(request) -> dict:
    return {
        "basename": settings.SPA_BASENAME,
        "lang": (get_language() or settings.LANGUAGE_CODE).split("-")[0],
        "dir": "rtl" if get_language_bidi() else "ltr",
        "user": user_payload(request.user),
        "site": site_payload(request),
        "debug": settings.DEBUG,
    }


# ‎ensure_csrf_cookie‎: أول POST (تسجيل الدخول) محتاج كوكي ‎csrftoken‎ موجود.
# ‎never_cache‎: الـboot فيه المستخدم الحالي — مايتخزّنش في كاش مشترك.
@ensure_csrf_cookie
@never_cache
@require_safe
def spa_shell(request, *args, **kwargs):
    # أثناء الترحيل التطبيق على /app/ جنب الموقع القديم — noindex عشان جوجل
    # مايفهرسش نسختين من نفس الصفحات. بيتفتح لما SPA_BASENAME يتفضّى.
    noindex = bool(settings.SPA_BASENAME)
    response = render(request, "spa/shell.html", {
        "boot": boot_payload(request),
        "noindex": noindex,
    })
    if noindex:
        response["X-Robots-Tag"] = "noindex, nofollow"
    return response


def _client_head(request, invitation) -> dict:
    """معاينة رابط متابعة الردود: لما صاحب الدعوة يستلمه على واتساب/ماسنجر يبان
    من العنوان والوصف إنه لوحة الردود — مش الدعوة نفسها ولا الصفحة الرئيسية."""
    from django.utils.translation import get_language
    from . import services

    en = (get_language() or "").startswith("en")
    names = (" & " if en else " و ").join(
        n for n in [invitation.name_one, invitation.name_two] if n) or invitation.title
    if en:
        title = f"RSVP Tracker · {names}"
        description = ("Private link for the hosts — follow guest confirmations, "
                       "headcount and wishes live as they arrive.")
    else:
        title = f"متابعة ردود الضيوف · {names}"
        description = ("رابط خاص بأصحاب الدعوة — تابع تأكيدات الحضور وعدد الضيوف "
                       "ورسائل التهنئة أولاً بأول.")
    s = (invitation.get_document() or {}).get("settings") or {}
    template = getattr(invitation, "template", None)
    image = services._share_image(  # noqa: SLF001
        request, s.get("share_image"),
        getattr(template, "cover_image", None), getattr(template, "cover_url", ""),
    )
    return {
        "title": title,
        "description": description,
        "image": image,
        "url": request.build_absolute_uri(invitation.get_client_followup_url()),
    }


@ensure_csrf_cookie
@never_cache
@require_safe
def client_followup_page(request, slug, token):
    """‎/i/<slug>/responses/<code>/‎ (و‎/client/<token>/‎ القديم): نفس الـshell
    بس بميتا خاصة بلوحة الردود. الصفحة سرّية فدايماً noindex."""
    from .models import Invitation

    invitation = Invitation.by_client_code(slug, token)
    response = render(request, "spa/shell.html", {
        "boot": boot_payload(request),
        "noindex": True,
        "head": _client_head(request, invitation) if invitation else None,
    })
    response["X-Robots-Tag"] = "noindex, nofollow"
    response["Referrer-Policy"] = "no-referrer"
    return response
