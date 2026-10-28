"""مكتبة الفيديوهات العامة — كل فيديو مرفوع في أي دعوة أو قالب أو من هنا.

بتجمع أصول ‎Asset(kind="video")‎ في مكان واحد. لما فيديو يتحدد «افتتاحية» بينتقل
لمكتبة الافتتاحيات (‎IntroVideo‎) وبيختفي من هنا ومن شبكة الفيديو في المحرر —
بيفضل في الافتتاحيات بس.
"""

from __future__ import annotations

import json
import os

from django.core.files import File
from django.template.defaultfilters import filesizeformat
from django.urls import path

from .. import services, video
from ..models import Asset, IntroVideo
from .dashboard_common import fmt_dt, staff_api
from .dashboard_library import VIDEO_EXTENSIONS, _clip_row, _get_or_404, _require_type
from .editor_assets import _unwrap
from .http import ApiError, json_body


def _owner_label(asset) -> str:
    if asset.invitation_id:
        return asset.invitation.title or f"#{asset.invitation_id}"
    if asset.template_id:
        return asset.template.name
    return ""


def _video_row(asset) -> dict:
    return {
        "id": asset.pk,
        "name": asset.original_name or os.path.basename(asset.file.name),
        "url": asset.url,
        "posterUrl": asset.thumb_url if asset.thumb else "",
        "sizeLabel": filesizeformat(asset.size_bytes) if asset.size_bytes else "",
        "owner": _owner_label(asset),
        "createdAt": fmt_dt(asset.created_at, "Y-m-d"),
    }


def _videos():
    return (Asset.objects.filter(kind="video", is_intro=False)
            .select_related("invitation", "template").order_by("-id"))


@staff_api("GET", "POST")
def videos(request):
    if request.method == "POST":
        upload = request.FILES.get("file")
        if upload is None:
            raise ApiError(400, "validation_error", "لم يصل أي ملف.",
                           fields={"file": "لم يصل أي ملف."})
        _require_type(upload, extensions=VIDEO_EXTENSIONS, prefix="video/", field="file",
                      message="الفيديو لازم يكون MP4 أو WebM أو MOV.")
        # نفس رفع المحرر (بداية سريعة + غلاف) — أصل مشترك من غير مالك
        response = _unwrap(services._upload_asset_for_editor(request), status=201)  # noqa: SLF001
        asset = Asset.objects.get(pk=json.loads(response.content)["asset"]["id"])
        return _video_row(asset)
    return {"results": [_video_row(asset) for asset in _videos()]}


@staff_api("PATCH")
def video_detail(request, pk):
    """تعديل اسم الفيديو (الاسم الأصلي اللي بيظهر في المكتبة والمحرر)."""
    asset = _get_or_404(Asset, pk)
    if asset.kind != "video" or asset.is_intro:
        raise ApiError(404, "not_found", "الفيديو غير موجود في المكتبة.")
    name = str(json_body(request).get("name") or "").strip()
    if not name:
        raise ApiError(400, "validation_error", "اكتب اسماً للفيديو.",
                       fields={"name": "اكتب اسماً للفيديو."})
    asset.original_name = name[:200]
    asset.save(update_fields=["original_name", "updated_at"])
    return _video_row(asset)


def _copy_file(field, source) -> None:
    """نسخة مستقلة من الملف — عشان حذف الأصل (مع دعوته) ماينسفش الافتتاحية."""
    with source.open("rb") as handle:
        field.save(os.path.basename(source.name), File(handle), save=False)


def _seconds(asset) -> float:
    try:
        return video._duration(asset.file.path) if video.available() else 0.0  # noqa: SLF001
    except Exception:
        return 0.0


@staff_api("POST")
def video_to_intro(request, pk):
    """ينقل الفيديو لمكتبة الافتتاحيات ويشيله من مكتبة الفيديوهات."""
    asset = _get_or_404(Asset, pk)
    if asset.kind != "video" or asset.is_intro:
        raise ApiError(404, "not_found", "الفيديو غير موجود في المكتبة.")
    name = os.path.splitext(asset.original_name or "")[0].strip() or "افتتاحية"
    clip = IntroVideo(name=name[:120], seconds=_seconds(asset))
    _copy_file(clip.file, asset.file)
    if asset.thumb:
        _copy_file(clip.poster, asset.thumb)
    clip.save()
    asset.is_intro = True
    asset.save(update_fields=["is_intro", "updated_at"])
    return _clip_row(clip)


urlpatterns = [
    path("dashboard/videos/", videos, name="api_dashboard_videos"),
    path("dashboard/videos/<int:pk>/", video_detail, name="api_dashboard_video"),
    path("dashboard/videos/<int:pk>/to-intro/", video_to_intro, name="api_dashboard_video_to_intro"),
]
