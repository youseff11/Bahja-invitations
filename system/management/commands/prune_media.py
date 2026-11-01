"""يمسح ملفات الميديا اللي مش مستخدمة في أي قالب أو دعوة، عشان يرجّع مساحة القرص.

المستخدم = أي ملف بيشاور عليه رابط ‎/media/…‎ جوّه أي حقل نص أو JSON في أي جدول
(مستندات القوالب والدعوات، إعدادات الموقع…)، أو ملف حقل رفع في جدول غير ‎Asset‎
(غلاف قالب، مكتبة الموسيقى والخطوط والافتتاحيات، هيرو الرئيسية).

اللي بيتمسح:
* صفوف ‎Asset‎ (مكتبة الصور والفيديو المرفوعة) ما فيش مستند بيستخدمها: الملف
  ومصغّرته وأصله، والصف نفسه (عشان ما يفضلش في مكتبة المحرر وصورته مكسورة).
* ‎template_sources/‎: النسخة الأصلية من ملف القالب المستورد، بتتخزّن بس وماحدش
  بيقراها تاني (ممكن تتخطى بـ‎--keep-sources‎).
* ‎music_clips/‎: النسخ المقصوصة من الأغاني، بتتولّد تاني لوحدها عند أول فتح.
* أي ملف تاني على القرص جوّه المجلدات دي ومالوش صف.

مجلدات تانية (خطوط، سكريبتات وصفحات القوالب، الهوم، الموقع) مابتتلمسش خالص.

افتراضياً عرض بس. مفيش حاجة بتتمسح من غير ‎--apply‎.

    python manage.py prune_media                  # عرض بس
    python manage.py prune_media --apply
    python manage.py prune_media --apply --keep-sources
"""

import json
import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import models, transaction

from system.models import Asset, Template

_MEDIA_URL_RE = re.compile(r'/media/[^\s"\'\\)<>]+')
# مجلدات الرفع اللي مسموح نشيل منها. غيرها مابنقرّبش منه.
_PRUNABLE_DIRS = ("assets", "template_sources", "music_clips")


def _norm(path: str) -> str:
    return unicodedata.normalize("NFC", unquote(path)).replace("\\", "/").lstrip("/")


def _refs_in(raw: str, media_url: str) -> set[str]:
    found = set()
    for url in _MEDIA_URL_RE.findall(raw):
        url = re.split(r"[?#]", url, 1)[0]
        url = re.sub(r"(?:&(?:quot|apos|amp|lt|gt|#\d+);|[),.;])+$", "", url)
        if url.startswith(media_url) and len(url) > len(media_url):
            found.add(_norm(url[len(media_url):]))
    return found


def _human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024


class Command(BaseCommand):
    help = "يمسح ملفات الميديا اللي مش مستخدمة في أي قالب أو دعوة."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="نفّذ المسح فعلاً.")
        parser.add_argument("--keep-sources", action="store_true",
                            help="سيب template_sources (الملفات الأصلية للقوالب المستوردة).")
        parser.add_argument("--show", type=int, default=15,
                            help="كام ملف من الأكبر يتعرض.")

    # ------------------------------------------------------------ المستخدم
    def _used(self, keep_sources: bool) -> set[str]:
        media_url = settings.MEDIA_URL or "/media/"
        used: set[str] = set()
        for model in apps.get_app_config("system").get_models():
            text_fields = [f for f in model._meta.concrete_fields
                           if isinstance(f, (models.CharField, models.TextField, models.JSONField))
                           and not isinstance(f, models.FileField)]
            file_fields = [f for f in model._meta.concrete_fields if isinstance(f, models.FileField)]
            if model is Asset:
                file_fields = []  # مكتبة الرفع: مستخدمة بس لو مستند بيشاور عليها
            elif model is Template and not keep_sources:
                file_fields = [f for f in file_fields if f.name != "source_file"]
            names = [f.name for f in text_fields + file_fields]
            if not names:
                continue
            for row in model.objects.only(*names).iterator():
                for f in text_fields:
                    value = getattr(row, f.name)
                    if not value:
                        continue
                    raw = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                    if "media/" in raw:
                        used |= _refs_in(raw, media_url)
                for f in file_fields:
                    name = getattr(row, f.name).name
                    if name:
                        used.add(_norm(name))
        return used

    def handle(self, *args, **options):
        root = Path(settings.MEDIA_ROOT)
        used = self._used(options["keep_sources"])
        prunable = [d for d in _PRUNABLE_DIRS if not (options["keep_sources"] and d == "template_sources")]

        # صفوف Asset: الصف مستخدم لو أي ملف من ملفاته مشار عليه
        doomed_rows, keep_assets = [], set()
        for asset in Asset.objects.all().iterator():
            files = [_norm(f.name) for f in (asset.file, asset.thumb, asset.source) if f and f.name]
            if any(f in used for f in files):
                keep_assets.update(files)
            else:
                doomed_rows.append(asset)
        keep = used | keep_assets

        # كل ملف على القرص جوّه المجلدات المسموحة ومش في المحفوظ
        doomed_files: list[tuple[str, int]] = []
        by_dir: dict[str, int] = defaultdict(int)
        total_all = 0
        for d in prunable:
            base = root / d
            if not base.is_dir():
                continue
            for dirpath, _dirs, files in os.walk(base):
                for fn in files:
                    full = Path(dirpath) / fn
                    rel = _norm(full.relative_to(root).as_posix())
                    size = full.stat().st_size
                    total_all += size
                    if rel not in keep:
                        doomed_files.append((rel, size))
                        by_dir[d] += size

        total = sum(s for _, s in doomed_files)
        w = self.stdout.write
        w(f"ملفات مستخدمة (مشار عليها): {len(keep)}")
        w(f"صفوف Asset مش مستخدمة: {len(doomed_rows)}")
        w(f"ملفات هتتمسح: {len(doomed_files)}  ({_human(total)} من {_human(total_all)} في المجلدات دي)")
        for d, size in sorted(by_dir.items(), key=lambda kv: -kv[1]):
            w(f"  {d}/  {_human(size)}")
        for rel, size in sorted(doomed_files, key=lambda x: -x[1])[:options["show"]]:
            w(f"    {_human(size):>10}  {rel}")

        if not options["apply"]:
            w(self.style.WARNING("\nعرض بس — ماتمسحش حاجة. أضف --apply للمسح."))
            return

        with transaction.atomic():
            for asset in doomed_rows:
                asset.delete()
        freed = 0
        for rel, size in doomed_files:
            try:
                (root / rel).unlink()
                freed += size
            except OSError as exc:
                w(self.style.ERROR(f"  تعذّر مسح {rel}: {exc}"))
        # مجلدات فاضية
        for d in prunable:
            base = root / d
            if base.is_dir():
                for dirpath, dirs, files in os.walk(base, topdown=False):
                    if not dirs and not files and Path(dirpath) != base:
                        try:
                            os.rmdir(dirpath)
                        except OSError:
                            pass
        w(self.style.SUCCESS(f"\nاتمسح {_human(freed)} وصفوف Asset: {len(doomed_rows)}."))
