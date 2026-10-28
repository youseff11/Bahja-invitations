"""القوالب في لوحة التحكم: القائمة، الإخفاء/الحذف، الإنشاء، واستيراد ZIP/HTML.

مطابق لـ‎dashboard_templates‎ و‎template_create‎ في ‎views.py‎ القديم. الاستيراد بيعدّي
على ‎templateimport.import_template‎ بنفس حدوده (٥٠ ميجا للملف، حماية ZIP bomb، المسارات
الخارجة عن الفولدر…) — وبنرفض الحجم الكبير قبل ما الملف يتقرا في الذاكرة.
"""

from __future__ import annotations

import logging

from django import forms
from django.db.models import Count
from django.http import Http404
from django.urls import path, reverse

from .. import blocks as blocks_engine
from .. import templateimport
from ..forms import TemplateForm
from ..models import NO_CATEGORY, Template, category_choices
from .dashboard_common import (
    editor_url,
    check_upload,
    raise_invalid,
    snake_keys,
    staff_api,
)
from .http import ApiError, json_body

logger = logging.getLogger(__name__)


def _template_row(tpl, labels: dict) -> dict:
    blocks = (tpl.document or {}).get("blocks") if isinstance(tpl.document, dict) else None
    return {
        "id": tpl.pk,
        "slug": tpl.slug,
        "name": tpl.name,
        "description": tpl.description,
        "category": tpl.category,
        "categoryLabel": labels.get(tpl.category, tpl.category),
        "source": tpl.source,
        "sourceLabel": tpl.get_source_display(),
        "blocks": len(blocks or []),
        "uses": tpl.uses,
        "isActive": tpl.is_active,
        "cover": tpl.cover_src or None,
        "editorUrl": editor_url("templates", tpl.pk),
        "adminUrl": reverse("admin:system_template_change", args=[tpl.pk]),
        "previewUrl": reverse("template_demo", args=[tpl.slug]),
    }


def _get_or_404(pk) -> Template:
    try:
        return Template.objects.defer("preview_render", "runtime_scripts").get(pk=pk)
    except Template.DoesNotExist:
        raise Http404("القالب غير موجود.")


@staff_api("GET", "POST")
def templates(request):
    if request.method == "POST":
        return _create_template(request)
    # المستند محتاجينه لعدد الأقسام بس؛ المعاينة الجاهزة والسكربتات لأ
    qs = Template.objects.defer("preview_render", "runtime_scripts").annotate(
        uses=Count("invitations"))
    choices = category_choices()
    labels = dict(choices)
    return {
        "categories": [{"value": value, "label": label} for value, label in choices],
        "results": [_template_row(tpl, labels) for tpl in qs],
    }


def _quick_edit(request, tpl) -> dict:
    """تعديل سريع للاسم والوصف من كارت القالب — اللي مابيتبعتش مابيتغيّرش."""
    data = json_body(request)
    update_fields = []
    if "name" in data:
        name = str(data["name"] or "").strip()
        max_length = Template._meta.get_field("name").max_length
        if not name:
            raise ApiError(400, "validation_error", "اسم القالب مطلوب.",
                           fields={"name": "اسم القالب مطلوب."})
        if len(name) > max_length:
            message = f"الاسم أطول من {max_length} حرف."
            raise ApiError(400, "validation_error", message, fields={"name": message})
        tpl.name = name
        update_fields.append("name")
    if "description" in data:
        tpl.description = str(data["description"] or "").strip()
        update_fields.append("description")
    if update_fields:
        tpl.save(update_fields=[*update_fields, "updated_at"])
    return {"id": tpl.pk, "name": tpl.name, "description": tpl.description}


@staff_api("PATCH", "DELETE")
def template_detail(request, pk):
    tpl = _get_or_404(pk)
    if request.method == "PATCH":
        return _quick_edit(request, tpl)
    # الدعوات بتاخد نسخة مستقلة من المستند وقت الإنشاء، فحذف القالب مابيأثرش عليها —
    # بس اللي اتستخدم بنسيبه عشان الإحصائيات تفضل صح
    used = tpl.invitations.count()
    if used:
        raise ApiError(
            409, "template_in_use",
            f"«{tpl.name}» متستخدم في {used} دعوة — اخفيه بدل ما تحذفه.")
    name = tpl.name
    tpl.delete()
    return {"deleted": True, "name": name}


@staff_api("POST")
def template_toggle(request, pk):
    tpl = _get_or_404(pk)
    tpl.is_active = not tpl.is_active
    tpl.save(update_fields=["is_active", "updated_at"])
    return {"id": tpl.pk, "name": tpl.name, "isActive": tpl.is_active}


class _CoverForm(forms.Form):
    cover_image = forms.ImageField(label="صورة الغلاف", error_messages={
        "required": "اختر صورة الخلفية.",
    })


@staff_api("POST", "DELETE")
def template_cover(request, pk):
    """إضافة/تغيير (‎POST‎) أو حذف (‎DELETE‎) خلفية كارت القالب (صورة الغلاف)."""
    tpl = _get_or_404(pk)
    if request.method == "DELETE":
        if tpl.cover_image:
            tpl.cover_image.delete(save=False)
        tpl.cover_url = ""
        tpl.save(update_fields=["cover_image", "cover_url", "updated_at"])
        return {"id": tpl.pk, "name": tpl.name, "cover": None}

    upload = request.FILES.get("coverImage")
    check_upload(upload, label="صورة الغلاف")
    form = _CoverForm({}, {"cover_image": upload})
    if not form.is_valid():
        raise_invalid(form)
    if tpl.cover_image:
        tpl.cover_image.delete(save=False)
    tpl.cover_image = form.cleaned_data["cover_image"]
    # الصورة المرفوعة بتتقدّم على الرابط في ‎cover_src‎؛ نفضّيه عشان مايرجعش لو اتحذفت
    tpl.cover_url = ""
    tpl.save(update_fields=["cover_image", "cover_url", "updated_at"])
    return {"id": tpl.pk, "name": tpl.name, "cover": tpl.cover_src or None}


def _create_template(request) -> dict:
    """قالب فارغ — بعده فريق العمل بيروح للمحرر."""
    check_upload(request.FILES.get("coverImage"), label="صورة الغلاف")
    form = TemplateForm(snake_keys(request.POST), {"cover_image": request.FILES.get("coverImage")})
    if not form.is_valid():
        raise_invalid(form)
    template = form.save(commit=False)
    template.document = blocks_engine.empty_document()
    template.preview_render = {}
    template.source = "editor"
    template.created_by = request.user
    template.is_active = True
    template.sort_order = 0
    template.runtime_scripts = []
    template.runtime_root_attrs = {}
    template.required_features = []
    # Template.save() يولّد slug فريداً تلقائياً لو تركه المستخدم فارغاً.
    template.save()
    return {
        "id": template.pk,
        "name": template.name,
        "editorUrl": editor_url("templates", template.pk),
    }


@staff_api("POST")
def template_import(request):
    upload = request.FILES.get("file")
    if upload is None:
        raise ApiError(400, "validation_error", "ارفع ملف HTML أو أرشيف ZIP.",
                       fields={"file": "ارفع ملف HTML أو أرشيف ZIP."})
    # حد الاستيراد (٥٠ ميجا) قبل أي قراءة للملف في الذاكرة
    if upload.size > templateimport.MAX_ARCHIVE_BYTES:
        raise ApiError(400, "import_failed", "حجم الملف أكبر من 50 ميجابايت.")

    category = request.POST.get("category") or NO_CATEGORY
    if category not in {value for value, _label in category_choices()}:
        raise ApiError(400, "validation_error", "التصنيف غير صالح.",
                       fields={"category": "التصنيف غير صالح."})
    try:
        tpl = templateimport.import_template(
            upload, name=(request.POST.get("name") or "").strip(), category=category)
    except templateimport.ImportError_ as exc:
        raise ApiError(400, "import_failed", str(exc))
    except Exception as exc:
        # الرسالة العامة كانت بتبلع الاستثناء الحقيقي — بيتسجّل كامل في سجل السيرفر،
        # وبيتعرض ملخّصه لفريق العمل عشان يوصفه (زي الـview القديم).
        logger.exception("فشل استيراد قالب: %s", getattr(upload, "name", "?"))
        raise ApiError(
            400, "import_failed",
            ("تعذّر قراءة الملف. جرّب أرشيف ZIP فيه index.html. "
             f"(السبب الفني: {type(exc).__name__}: {exc})")[:400])

    chars = templateimport.document_text_length(tpl.document)
    return {
        "id": tpl.pk,
        "name": tpl.name,
        "blocks": len(tpl.document.get("blocks", [])),
        "chars": chars,
        "tracks": getattr(tpl, "imported_tracks", 0),
        "scripts": len(getattr(tpl, "runtime_scripts", []) or []),
        # ملف صغير بيعدّي، بس ننبّه فريق العمل عشان يراجع المعاينة
        "thinContent": chars < templateimport.MIN_VISIBLE_CHARS,
    }


urlpatterns = [
    path("dashboard/templates/", templates, name="api_dashboard_templates"),
    path("dashboard/templates/import/", template_import, name="api_dashboard_template_import"),
    path("dashboard/templates/<int:pk>/", template_detail, name="api_dashboard_template"),
    path("dashboard/templates/<int:pk>/toggle/", template_toggle,
         name="api_dashboard_template_toggle"),
    path("dashboard/templates/<int:pk>/cover/", template_cover,
         name="api_dashboard_template_cover"),
]
