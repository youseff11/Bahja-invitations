"""مكتبة أصول المحرر والمفضلة والخطوط المخصصة (Phase C3) — ‎/api/v1/editor/‎.

فريق العمل بس (‎staff_api‎). منطق الرفع والقص والحذف واستعلام «مستخدم؟» بيتعمل بالدوال
القديمة نفسها (‎_upload_asset_for_editor‎ وأخواتها) — الموقع القديم هو المرجع لقواعد
الأنواع والأحجام والملكية، فبنستوردها بدل ما نكرّرها ونحوّل ردودها من
‎{"ok": false, "error": …}‎ لشكل الواجهة الجديدة ‎{"error": {"code", "message"}}‎ بنفس كود الحالة.

* ‎GET  editor/<invitations|templates>/<id>/assets/‎            آخر ٣٠٠ أصل + ‎used‎
* ‎POST editor/<…>/<id>/assets/upload/‎       ‎multipart: file (+ thumb لفريم الفيديو)‎
* ‎POST editor/<…>/<id>/assets/crop/‎         ‎{asset, box:{x,y,w,h}}‎ نِسَب ٠..١
* ‎POST editor/<…>/<id>/assets/delete/‎       ‎{asset, kind}‎ — ‎409‎ لو الأصل مستخدم
* ‎POST editor/<…>/<id>/assets/bulk-delete/‎  ‎{assets: [...], kind}‎
* ‎GET/POST editor/favorites/‎                 ‎POST {name, block, categoryId?}‎ — الرد فيه ‎categories‎ كمان
* ‎PATCH/DELETE editor/favorites/<id>/‎       ‎PATCH {name?, categoryId?}‎ (‎categoryId: null‎ = بدون تصنيف)
* ‎POST editor/favorites/preview/‎            ‎{block, lang?}‎ — معاينة قسم مفضّل من غير مستند (صفحة المكتبة)
* ‎GET/POST editor/favorite-categories/‎      ‎POST {name}‎ — الـGET قايمة خفيفة من غير الأقسام
* ‎PATCH/DELETE editor/favorite-categories/<id>/‎ — الحذف بيرجّع عناصره «بدون تصنيف»
* ‎POST editor/fonts/‎                         ‎multipart‎ — رفع خط مخصص
"""

from __future__ import annotations

import json

from django.shortcuts import get_object_or_404
from django.urls import path

from .. import blocks as blocks_engine
from .. import services
from ..forms import CustomFontForm
from ..models import FavoriteBlock, FavoriteCategory, Invitation, Template
from .dashboard_common import raise_invalid, staff_api
from .editor import _assets, _preview
from .http import ApiError, json_body, json_response

# كود الخطأ حسب كود الحالة اللي بترجّعه الدوال القديمة
_CODES = {400: "validation_error", 403: "forbidden", 404: "not_found", 409: "asset_in_use"}
_DELETABLE_KINDS = ("image", "video")


def _unwrap(response, *, status: int = 200):
    """رد الدالة القديمة (‎JsonResponse‎) → بيانات، أو ‎ApiError‎ بنفس كود الحالة."""
    try:
        data = json.loads(response.content)
    except ValueError:
        data = {}
    if response.status_code < 400 and data.get("ok"):
        data.pop("ok", None)
        return json_response(data, status=status)
    code = _CODES.get(response.status_code, "server_error")
    raise ApiError(response.status_code, code, str(data.get("error") or ""))


def _owner(kind: str, pk: int) -> dict:
    """مالك المكتبة: ‎{"invitation": …}‎ أو ‎{"template": …}‎ — مفتاح الدوال القديمة."""
    if kind == "invitations":
        return {"invitation": get_object_or_404(Invitation, pk=pk)}
    return {"template": get_object_or_404(Template, pk=pk)}


def _kind_in(body: dict) -> str:
    kind = body.get("kind", "image")
    if kind not in _DELETABLE_KINDS:
        raise ApiError(400, "validation_error", "نوع الملف غير صالح للحذف.",
                       fields={"kind": "image أو video"})
    return kind


def _with_used(response):
    """الأصل الجديد لسه مفيش مستند بيشاور عليه."""
    if response.status_code == 201:
        data = json.loads(response.content)
        data["asset"]["used"] = False
        return json_response(data, status=201)
    return response


# ---------------------------------------------------------------- الأصول
def make_views(kind: str):
    """مسارات الأصول لنوع المالك (دعوة/قالب) — نفس المنطق، المالك بس بيتغيّر."""

    @staff_api("GET")
    def listing(request, pk):
        owner = _owner(kind, pk)
        return {"assets": _assets(owner.get("invitation"))}

    @staff_api("POST")
    def upload(request, pk):
        owner = _owner(kind, pk)
        if not request.FILES.get("file"):
            raise ApiError(400, "validation_error", "لم يصل أي ملف.",
                           fields={"file": "لم يصل أي ملف."})
        return _with_used(_unwrap(services._upload_asset_for_editor(  # noqa: SLF001
            request, **owner), status=201))

    @staff_api("POST")
    def crop(request, pk):
        owner = _owner(kind, pk)
        return _with_used(_unwrap(services._crop_asset_for_editor(  # noqa: SLF001
            request, **owner), status=201))

    @staff_api("POST")
    def delete(request, pk):
        owner = _owner(kind, pk)
        body = json_body(request)
        return _unwrap(services._delete_asset_for_editor(  # noqa: SLF001
            request, body.get("asset"), kind=_kind_in(body), **owner))

    @staff_api("POST")
    def bulk_delete(request, pk):
        owner = _owner(kind, pk)
        body = json_body(request)
        return _unwrap(services._bulk_delete_assets_for_editor(  # noqa: SLF001
            body.get("assets"), kind=_kind_in(body), **owner))

    return listing, upload, crop, delete, bulk_delete


# ---------------------------------------------------------------- المفضلة
def _block_in(body: dict) -> dict:
    """القسم بعد ما يعدّي على نفس ‎normalize_document‎ بتاع الحفظ."""
    source = body.get("block") or body.get("blockData")
    normalized = blocks_engine.normalize_document(
        {"blocks": [source if isinstance(source, dict) else {}]})
    block = (normalized.get("blocks") or [None])[0]
    if not block or not block.get("type") or not blocks_engine.BLOCK_REGISTRY.get(block["type"]):
        raise ApiError(400, "validation_error", "العنصر المحدد غير صالح للحفظ.",
                       fields={"block": "العنصر المحدد غير صالح للحفظ."})
    return block


def _category_in(body: dict, *, required: bool = False):
    """التصنيف المطلوب من الجسم: ‎None‎ = بدون تصنيف، وغير موجود في الجسم = ما يتغيّرش (‎...‎)."""
    if "categoryId" not in body:
        if required:
            return None
        return ...
    raw = body.get("categoryId")
    if raw in (None, ""):
        return None
    try:
        return FavoriteCategory.objects.get(pk=int(raw))
    except (TypeError, ValueError, FavoriteCategory.DoesNotExist):
        raise ApiError(400, "validation_error", "التصنيف غير موجود.",
                       fields={"categoryId": "التصنيف غير موجود."}) from None


def _favorite_name(body: dict) -> str:
    name = str(body.get("name") or "").strip()
    if not name:
        raise ApiError(400, "validation_error", "اكتب اسماً للعنصر المفضل.",
                       fields={"name": "اكتب اسماً للعنصر المفضل."})
    return name[:120]


@staff_api("GET", "POST")
def favorites(request):
    if request.method == "GET":
        return {"favorites": services._favorites_json(),  # noqa: SLF001
                "categories": services._favorite_categories_json()}  # noqa: SLF001
    body = json_body(request)
    name, block = _favorite_name(body), _block_in(body)
    category = _category_in(body, required=True)
    favorite = FavoriteBlock.objects.create(
        name=name, block_type=block["type"], block_data=block, category=category,
        created_by=request.user)
    return json_response({"favorite": services._favorite_payload(favorite)}, status=201)  # noqa: SLF001


@staff_api("PATCH", "DELETE")
def favorite_detail(request, pk):
    favorite = get_object_or_404(FavoriteBlock, pk=pk)
    if request.method == "DELETE":
        favorite.delete()
        return {"deleted": pk}
    body = json_body(request)
    fields = []
    if "name" in body:
        favorite.name = _favorite_name(body)
        fields.append("name")
    category = _category_in(body)
    if category is not ...:
        favorite.category = category
        fields.append("category")
    if fields:
        favorite.save(update_fields=[*fields, "updated_at"])
    return {"favorite": services._favorite_payload(favorite)}  # noqa: SLF001


@staff_api("POST")
def favorite_preview(request):
    """معاينة قسم واحد من غير دعوة/قالب (صفحة مكتبة المفضلة في اللوحة): نفس ‎_preview‎ بمستند من قسم واحد."""
    body = json_body(request)
    return _preview(request, {"document": {"blocks": [_block_in(body)]}, "lang": body.get("lang")})


# ------------------------------------------------------------- تصنيفات المفضلة
def _category_name(body: dict, *, current: int | None = None) -> str:
    name = " ".join(str(body.get("name") or "").split())[:80]
    if not name:
        raise ApiError(400, "validation_error", "اكتب اسماً للتصنيف.",
                       fields={"name": "اكتب اسماً للتصنيف."})
    taken = FavoriteCategory.objects.filter(name__iexact=name).exclude(pk=current)
    if taken.exists():
        raise ApiError(400, "validation_error", "فيه تصنيف بنفس الاسم.",
                       fields={"name": "فيه تصنيف بنفس الاسم."})
    return name


@staff_api("GET", "POST")
def favorite_categories(request):
    """القايمة الخفيفة (من غير بيانات الأقسام) لنافذة «حفظ كمفضلة»، والإضافة."""
    if request.method == "GET":
        return {"categories": services._favorite_categories_json()}  # noqa: SLF001
    category = FavoriteCategory.objects.create(name=_category_name(json_body(request)))
    return json_response({"category": {"id": category.pk, "name": category.name}}, status=201)


@staff_api("PATCH", "DELETE")
def favorite_category_detail(request, pk):
    category = get_object_or_404(FavoriteCategory, pk=pk)
    if request.method == "DELETE":
        category.delete()  # SET_NULL: العناصر بترجع «بدون تصنيف»
        return {"deleted": pk}
    category.name = _category_name(json_body(request), current=category.pk)
    category.save(update_fields=["name", "updated_at"])
    return {"category": {"id": category.pk, "name": category.name}}


# ---------------------------------------------------------------- الخطوط
@staff_api("POST")
def font_create(request):
    """رفع خط جديد من أي حقل ‎font‎ — نفس ‎CustomFontForm‎ بتاع لوحة الخطوط (الامتداد والحجم والاسم)."""
    data = request.POST.copy()
    # الحقول دي مطلوبة في النموذج ومالهاش لازمة في الرفع السريع من المحرر: نكمّلها بدل ما
    # العميل يبعتها (الخط يتفعّل فوراً عشان يتطبق على النص)
    for key, default in (("weight", "400"), ("style", "normal"), ("order", "0"), ("is_active", "on")):
        data.setdefault(key, default)
    form = CustomFontForm(data, request.FILES)
    if not form.is_valid():
        raise_invalid(form)
    font = form.save(commit=False)
    font.uploaded_by = request.user
    font.save()
    return json_response({"font": services._font_payload(font)}, status=201)  # noqa: SLF001


def _routes():
    routes = []
    for kind in ("invitations", "templates"):
        listing, upload, crop, delete, bulk_delete = make_views(kind)
        base = f"editor/{kind}/<int:pk>/assets/"
        routes += [
            path(base, listing, name=f"api_editor_{kind}_assets"),
            path(base + "upload/", upload, name=f"api_editor_{kind}_asset_upload"),
            path(base + "crop/", crop, name=f"api_editor_{kind}_asset_crop"),
            path(base + "delete/", delete, name=f"api_editor_{kind}_asset_delete"),
            path(base + "bulk-delete/", bulk_delete, name=f"api_editor_{kind}_asset_bulk_delete"),
        ]
    return routes


urlpatterns = _routes() + [
    path("editor/favorites/", favorites, name="api_editor_favorites"),
    path("editor/favorites/preview/", favorite_preview, name="api_editor_favorite_preview"),
    path("editor/favorites/<int:pk>/", favorite_detail, name="api_editor_favorite"),
    path("editor/favorite-categories/", favorite_categories, name="api_editor_favorite_categories"),
    path("editor/favorite-categories/<int:pk>/", favorite_category_detail,
         name="api_editor_favorite_category"),
    path("editor/fonts/", font_create, name="api_editor_font_create"),
]
