import tempfile
from io import StringIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from ..models import Asset, Template


class PruneMediaTests(TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        override = override_settings(MEDIA_ROOT=self.root, MEDIA_URL="/media/")
        override.enable()
        self.addCleanup(override.disable)

    def asset(self, name):
        a = Asset(kind="image")
        a.file.save(name, ContentFile(b"x" * 100), save=True)
        return a

    def run_cmd(self, *args):
        call_command("prune_media", *args, stdout=StringIO())

    def test_keeps_used_removes_unused_and_leaves_other_dirs(self):
        used, unused = self.asset("used.png"), self.asset("unused.png")
        Template.objects.create(
            name="t", slug="t",
            document={"blocks": [{"props": {"code": f'<img src="{used.file.url}">'}}]},
        )
        other = self.root / "template_fonts" / "f.woff2"
        other.parent.mkdir(parents=True)
        other.write_bytes(b"f")
        clip = self.root / "music_clips" / "c.mp3"
        clip.parent.mkdir(parents=True)
        clip.write_bytes(b"c")

        self.run_cmd()  # عرض بس
        self.assertTrue(Path(unused.file.path).exists())
        self.assertEqual(Asset.objects.count(), 2)

        self.run_cmd("--apply")
        self.assertTrue(Path(used.file.path).exists())
        self.assertFalse(Path(unused.file.path).exists())
        self.assertFalse(clip.exists())
        self.assertTrue(other.exists())
        self.assertEqual(list(Asset.objects.values_list("pk", flat=True)), [used.pk])

    def test_keep_sources_leaves_template_sources(self):
        src = self.root / "template_sources" / "a.zip"
        src.parent.mkdir(parents=True)
        src.write_bytes(b"z")
        self.run_cmd("--apply", "--keep-sources")
        self.assertTrue(src.exists())
        self.run_cmd("--apply")
        self.assertFalse(src.exists())
