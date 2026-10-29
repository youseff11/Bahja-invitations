"""مكتبة الصور العامة — كل صورة مرفوعة في أي دعوة أو قالب أو من هنا.

بتجمع أصول ‎Asset(kind="image")‎ في مكان واحد، مع علامة «مستخدمة» (من فهرس
الوسائط) وعلامة «مكررة» لما أكتر من صورة يكون محتواها نفس البايتات بالظبط.

* الحذف اليدوي (واحدة أو مجموعة) بيرفض الصورة المستخدمة في قالب أو دعوة — نفس
  قاعدة مكتبة المحرر — عشان مايتكسرش مستند.
* «مسح المكرر» بيجمّع الصور المتطابقة بصمة ‎sha256‎ (الحجم الأول عشان مانقراش
  إلا المشتبه فيه)، وبيختار في كل مجموعة الصورة **الأكتر استخداماً** (وعند
  التساوي الأقدم)، وبيحوّل روابط المستندات للنسخة الباقية في نفس المعاملة قبل
  المسح، وملف النسخة المحذوفة بيتمسح بعد نجاح المعاملة لو مفيش صف تاني بيستخدمه.

‎POST /api/v1/dashboard/images/dedupe/‎ بجسم ‎{"dryRun": true}‎ بيرجّع الخطة من
غير ما يغيّر حاجة (الواجهة بتعرضها للتأكيد)، ومن غيره بينفّذ.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from collections import defaultdict
from urllib.parse import quote, unquote

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from django.template.defaultfilters import filesizeformat
from django.urls import path

from .. import services
from ..models import Asset, Invitation, Template
from .dashboard_common import TEMPLATE_HEAVY_FIELDS, fmt_dt, staff_api
from .dashboard_library import _get_or_404, _require_type
from .dashboard_music_dedupe import _count_references, _documents, _pattern
from .editor_assets import _unwrap
from .http import ApiError, json_body

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
_CHUNK = 1024 * 1024
# أقصى عدد صور في طلب حذف جماعي (نفس حد المحرر)
_BULK_LIMIT = 300
# أقصى عدد مجموعات بنرجّعها في الخطة (للعرض بس؛ التنفيذ بيشمل الكل)
_PREVIEW_GROUPS = 40
# الملف بيتخزّن في مجلد uuid فريد فمحتواه عمره ما بيتغيّر — البصمة تتحسب مرة
_DIGESTS: dict[tuple[str, int], str] = {}


# ---------------------------------------------------------------- القراءة
def _owner(asset) -> tuple[str, str]:
    if asset.invitation_id:
        return "invitation", asset.invitation.title or f"#{asset.invitation_id}"
    if asset.template_id:
        return "template", asset.template.name
    return "", ""


def _digest(asset) -> str:
    """بصمة محتوى الملف، أو '' لو الملف مش موجود/مش مقروء."""
    cache_key = (asset.file.name, asset.size_bytes)
    cached = _DIGESTS.get(cache_key)
    if cached is not None:
        return cached
    sha = hashlib.sha256()
    try:
        with asset.file.storage.open(asset.file.name, "rb") as handle:
            for chunk in iter(lambda: handle.read(_CHUNK), b""):
                sha.update(chunk)
    except (OSError, ValueError):
        return ""
    _DIGESTS[cache_key] = sha.hexdigest()
    return _DIGESTS[cache_key]


def _images():
    return (
        Asset.objects.filter(kind="image")
        .select_related("invitation", "template")
        .defer("invitation__document", *(f"template__{field}" for field in TEMPLATE_HEAVY_FIELDS))
        .order_by("-id")
    )


def _digest_groups(assets) -> dict[str, list]:
    """المتطابقين بايت ببايت: بصمة → الصور (مجموعات فيها اتنين أو أكتر بس).

    التجميع الأولي بالحجم رخيص (من غير قراءة)، والبصمة بتتحسب للمشتبه فيه بس.
    """
    by_size: dict[int, list] = defaultdict(list)
    for asset in assets:
        if asset.file and asset.size_bytes:
            by_size[asset.size_bytes].append(asset)
    by_digest: dict[str, list] = defaultdict(list)
    for same_size in by_size.values():
        if len(same_size) < 2:
            continue
        for asset in same_size:
            digest = _digest(asset)
            if digest:
                by_digest[digest].append(asset)
    return {digest: members for digest, members in by_digest.items() if len(members) > 1}


def _image_row(asset, *, used: bool, group: str = "", copies: int = 1) -> dict:
    owner_kind, owner = _owner(asset)
    return {
        "id": asset.pk,
        "name": asset.original_name or os.path.basename(asset.file.name),
        "url": asset.url,
        "thumbUrl": asset.thumb_url,
        "width": asset.width,
        "height": asset.height,
        "sizeBytes": asset.size_bytes,
        "sizeLabel": filesizeformat(asset.size_bytes) if asset.size_bytes else "",
        "owner": owner,
        "ownerKind": owner_kind,
        "createdAt": fmt_dt(asset.created_at, "Y-m-d"),
        "used": used,
        "dupGroup": group,
        "dupCount": copies,
    }


def _rows(assets: list) -> tuple[list[dict], int]:
    usage = services._asset_usage_map(assets)  # noqa: SLF001
    group_of: dict[int, tuple[str, int]] = {}
    extra = 0
    for digest, members in _digest_groups(assets).items():
        extra += len(members) - 1
        for member in members:
            group_of[member.pk] = (digest[:12], len(members))
    rows = []
    for asset in assets:
        group, copies = group_of.get(asset.pk, ("", 1))
        rows.append(_image_row(asset, used=usage.get(asset.pk, False), group=group, copies=copies))
    return rows, extra


@staff_api("GET", "POST")
def images(request):
    if request.method == "POST":
        upload = request.FILES.get("file")
        if upload is None:
            raise ApiError(400, "validation_error", "لم يصل أي ملف.",
                           fields={"file": "لم يصل أي ملف."})
        _require_type(upload, extensions=IMAGE_EXTENSIONS, prefix="image/", field="file",
                      message="الملف لازم يكون صورة (JPG أو PNG أو WebP أو GIF أو SVG).")
        # نفس رفع المحرر (ضغط + مصغّرة + حفظ الأصل) — أصل مشترك من غير مالك
        response = _unwrap(services._upload_asset_for_editor(request), status=201)  # noqa: SLF001
        asset = Asset.objects.get(pk=json.loads(response.content)["asset"]["id"])
        return _image_row(asset, used=False)
    rows, extra = _rows(list(_images()))
    return {"results": rows, "duplicateExtra": extra}


@staff_api("PATCH", "DELETE")
def image_detail(request, pk):
    asset = _get_or_404(Asset, pk)
    if asset.kind != "image":
        raise ApiError(404, "not_found", "الصورة غير موجودة في المكتبة.")
    if request.method == "DELETE":
        # يرفض (409) لو الصورة مستخدمة في قالب أو دعوة — زي مكتبة المحرر
        return _unwrap(services._delete_asset_for_editor(request, pk, kind="image"))  # noqa: SLF001
    name = str(json_body(request).get("name") or "").strip()
    if not name:
        raise ApiError(400, "validation_error", "اكتب اسماً للصورة.",
                       fields={"name": "اكتب اسماً للصورة."})
    asset.original_name = name[:200]
    asset.save(update_fields=["original_name", "updated_at"])
    return _image_row(asset, used=services._asset_is_used(asset))  # noqa: SLF001


@staff_api("POST")
def images_bulk_delete(request):
    ids = json_body(request).get("ids")
    if isinstance(ids, list) and len(ids) > _BULK_LIMIT:
        raise ApiError(400, "validation_error", f"أقصى عدد {_BULK_LIMIT} صورة في المرة.")
    return _unwrap(services._bulk_delete_assets_for_editor(ids, kind="image"))  # noqa: SLF001


# ---------------------------------------------------------------- مسح المكرر
def _variants(url: str) -> list[str]:
    """الرابط زي ما ممكن يتكتب في مستند: خام، أو مفكوك، أو مكوّد (أسماء عربية)."""
    if not url:
        return []
    plain = unquote(url)
    return [url, plain, quote(plain, safe="/:?&=#@+,;~!*'()")]


def _urls_of(asset) -> dict[str, str]:
    """روابط الأصل بالتسمية (الملف/المصغّرة/الأصل) — الناقص بيرجع للملف الأساسي."""
    return {"file": asset.url, "thumb": asset.thumb.url if asset.thumb else asset.url,
            "source": asset.source.url if asset.source else asset.url}


def _rewrite(replacements: dict[str, str]) -> int:
    """يبدّل روابط الصور المحذوفة بروابط الباقية في كل المستندات. يرجّع عدد المستندات."""
    pattern = _pattern(list(replacements))
    if pattern is None:
        return 0
    changed = 0
    for model, pk, document in _documents():
        text = json.dumps(document, ensure_ascii=False)
        if not pattern.search(text):
            continue
        owner = model.objects.get(pk=pk)
        owner.document = json.loads(pattern.sub(lambda m: replacements[m.group(1)], text))
        fields = ["document"]
        if model is Template:
            owner.preview_render = {}  # المعاينة المخزّنة بتتولّد من جديد
            fields.append("preview_render")
        # save (مش update) عشان إشارة الحفظ تعيد بناء فهرس الوسائط
        owner.save(update_fields=fields)
        changed += 1
    return changed


def _delete_files(names: set[str]) -> None:
    for name in names:
        # ملف مشترك مع صف لسه موجود: ماينفعش يتمسح
        if Asset.objects.filter(Q(file=name) | Q(thumb=name) | Q(source=name)).exists():
            continue
        try:
            default_storage.delete(name)
        except OSError:
            logger.warning("couldn't delete image file %s", name, exc_info=True)


def run(*, dry_run: bool) -> dict:
    groups = list(_digest_groups(list(_images())).values())
    if not groups:
        return {"dryRun": dry_run, "removeCount": 0, "keepCount": 0, "repointedDocs": 0,
                "freedBytes": 0, "groups": []}

    owner_of: dict[str, int] = {}
    for members in groups:
        for asset in members:
            for url in _urls_of(asset).values():
                for variant in _variants(url):
                    owner_of.setdefault(variant, asset.pk)
    references = _count_references(owner_of)

    plan = []
    for members in groups:
        keeper = min(members, key=lambda a: (-references.get(a.pk, 0), a.pk))
        plan.append((keeper, [a for a in members if a.pk != keeper.pk]))

    summary = {
        "dryRun": dry_run,
        "removeCount": sum(len(removed) for _keeper, removed in plan),
        "keepCount": len(plan),
        "repointedDocs": 0,
        "freedBytes": 0,
        "groups": [
            {"name": keeper.original_name or os.path.basename(keeper.file.name),
             "keepId": keeper.pk, "removeCount": len(removed)}
            for keeper, removed in plan[:_PREVIEW_GROUPS]
        ],
    }
    if dry_run:
        return summary

    replacements: dict[str, str] = {}
    for keeper, removed in plan:
        kept = _urls_of(keeper)
        for asset in removed:
            for label, old_url in _urls_of(asset).items():
                for old, new in zip(_variants(old_url), _variants(kept[label])):
                    if old != new:
                        replacements[old] = new

    removed_ids = [asset.pk for _keeper, removed in plan for asset in removed]
    names: set[str] = set()
    freed = 0
    for _keeper, removed in plan:
        for asset in removed:
            freed += asset.size_bytes or 0
            names |= {n for n in (asset.file.name, asset.thumb.name, asset.source.name) if n}

    with transaction.atomic():
        summary["repointedDocs"] = _rewrite(replacements)
        Asset.objects.filter(pk__in=removed_ids).delete()
        transaction.on_commit(lambda: _delete_files(names))
    summary["freedBytes"] = freed
    return summary


@staff_api("POST")
def images_dedupe(request):
    return run(dry_run=bool(json_body(request).get("dryRun")))


urlpatterns = [
    path("dashboard/images/", images, name="api_dashboard_images"),
    path("dashboard/images/bulk-delete/", images_bulk_delete, name="api_dashboard_images_bulk_delete"),
    path("dashboard/images/dedupe/", images_dedupe, name="api_dashboard_images_dedupe"),
    path("dashboard/images/<int:pk>/", image_detail, name="api_dashboard_image"),
]
