"""وسم أيقونة الموقع للـ‎<head>‎."""

from pathlib import Path

from django import template
from django.contrib.staticfiles import finders
from django.templatetags.static import static

from .. import siteicon

register = template.Library()


@register.simple_tag
def site_icon_href(fallback: str) -> str:
    """أيقونة الموقع اللي رفعها المصمّم، وإلا ملف الـstatic الافتراضي ‎fallback‎."""
    custom = siteicon.icon_url()
    if custom:
        return custom
    # الافتراضي بيتخزّن في المتصفح بقوة (أيقونة التبويب)، فنضيف وقت تعديل الملف عشان تتحدّث لما نغيّرها
    url = static(fallback)
    found = finders.find(fallback)
    if isinstance(found, str):
        try:
            return f"{url}?v={int(Path(found).stat().st_mtime)}"
        except OSError:
            pass
    return url
