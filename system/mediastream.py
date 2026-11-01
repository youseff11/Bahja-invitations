"""فيديو وصوت الدعوة بيتقدّموا من مسار ‎/stream/‎ (Django) مش ‎/media/‎.

الاستضافة بتقدّم ‎/media/‎ من طبقتها وترد ‎200‎ كامل من غير ‎Accept-Ranges‎ لأي طلب ‎Range‎.
سفاري/كروم على الآيفون (WebKit) محتاجين ‎206‎: من غيره الفيديو بيشتغل كام ثانية وبعدين
بيقف في النص و‎ended‎ ما بيجيش، فالافتتاحية بتفضل مقفولة. ‎/stream/‎ مش متسجّل كـstatic mapping
فبيوصل لـDjango اللي بيدعم ‎Range‎ (‎files.media_stream‎).
"""

from __future__ import annotations

import re
from typing import Any

from django.conf import settings

VIDEO_EXTS = frozenset({".mp4", ".m4v", ".mov", ".webm", ".ogv"})
AUDIO_EXTS = frozenset({".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav"})
STREAM_EXTS = VIDEO_EXTS | AUDIO_EXTS

_EXT_ALT = "|".join(sorted((e[1:] for e in STREAM_EXTS), key=len, reverse=True))
# المسار النسبي بس (مش ‎https://موقع-تاني/media/…‎): قبله مفيش حرف/نقطة/شرطة
_MEDIA_REF = re.compile(
    rf"(?<![\w./-])/media/([^\s\"'\\)<>?#]+?\.(?:{_EXT_ALT}))(?![\w])", re.IGNORECASE)


def stream_url_prefix() -> str:
    return getattr(settings, "STREAM_URL", "/stream/")


def streamify_text(text: str) -> str:
    if "/media/" not in text:
        return text
    prefix = stream_url_prefix()
    return _MEDIA_REF.sub(lambda m: f"{prefix}{m.group(1)}", text)


def streamify(value: Any) -> Any:
    """يبدّل كل رابط ‎/media/…(فيديو|صوت)‎ جوّه الحمولة (JSON) برابط ‎/stream/…‎."""
    if isinstance(value, str):
        return streamify_text(value)
    if isinstance(value, dict):
        return {k: streamify(v) for k, v in value.items()}
    if isinstance(value, list):
        return [streamify(v) for v in value]
    return value
