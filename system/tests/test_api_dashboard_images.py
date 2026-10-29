"""مكتبة الصور العامة ومسح الصور المكررة (‎/api/v1/dashboard/images/‎)."""

import os

from django.core.files.base import ContentFile

from system.models import Asset, Invitation
from system.tests.test_api_dashboard import BASE, DashboardApiCase

IMAGES = f"{BASE}/images/"
DEDUPE = f"{BASE}/images/dedupe/"
BULK = f"{BASE}/images/bulk-delete/"


class ImagesCase(DashboardApiCase):
    def image(self, content, name="photo.png", **extra):
        asset = Asset(kind="image", original_name=name, size_bytes=len(content), **extra)
        asset.file.save(name, ContentFile(content), save=False)
        asset.save()
        return asset

    def point_at(self, asset, invitation=None):
        """يخلّي مستند الدعوة يشاور على الصورة (والحفظ بيحدّث فهرس الوسائط)."""
        invitation = invitation or self.invitation
        document = invitation.document
        document.setdefault("settings", {})["cover_image"] = asset.url
        invitation.document = document
        invitation.save()
        return invitation

    def cover_of(self, invitation):
        invitation.refresh_from_db()
        return invitation.document["settings"]["cover_image"]

    def apply_dedupe(self):
        """ينفّذ المسح فعلاً، ومعاه حذف الملفات اللي بيتأجل لبعد نجاح المعاملة."""
        with self.captureOnCommitCallbacks(execute=True):
            return self.post(DEDUPE, {}).json()


class GuardTests(ImagesCase):
    def test_requires_login(self):
        self.client.logout()
        self.assertEqual(self.client.get(IMAGES).status_code, 401)

    def test_requires_staff(self):
        self.client.force_login(self.plain)
        self.assertEqual(self.get(IMAGES).status_code, 403)
        self.assertEqual(self.post(DEDUPE, {}).status_code, 403)
        self.assertEqual(self.post(BULK, {"ids": [1]}).status_code, 403)

    def test_dedupe_is_post_only(self):
        self.assertEqual(self.get(DEDUPE).status_code, 405)


class ListTests(ImagesCase):
    def test_lists_images_only_with_flags(self):
        used = self.image(b"AAAA", "used.png")
        self.point_at(used)
        a = self.image(b"BBBB", "a.png")
        b = self.image(b"BBBB", "b.png")
        solo = self.image(b"CCCCC", "solo.png")
        data = self.get(IMAGES).json()
        rows = {row["id"]: row for row in data["results"]}
        self.assertNotIn(self.video.pk, rows)  # الفيديو مش صورة
        self.assertTrue(rows[used.pk]["used"])
        self.assertFalse(rows[solo.pk]["used"])
        self.assertEqual(rows[a.pk]["dupCount"], 2)
        self.assertEqual(rows[a.pk]["dupGroup"], rows[b.pk]["dupGroup"])
        self.assertNotEqual(rows[a.pk]["dupGroup"], "")
        self.assertEqual((rows[solo.pk]["dupGroup"], rows[solo.pk]["dupCount"]), ("", 1))
        self.assertEqual(data["duplicateExtra"], 1)

    def test_same_size_but_different_bytes_is_not_a_duplicate(self):
        self.image(b"XXXX", "x.png")
        self.image(b"YYYY", "y.png")
        data = self.get(IMAGES).json()
        self.assertEqual(data["duplicateExtra"], 0)
        self.assertTrue(all(row["dupGroup"] == "" for row in data["results"]))

    def test_owner_label(self):
        asset = self.image(b"AAAA", invitation=self.invitation)
        row = next(r for r in self.get(IMAGES).json()["results"] if r["id"] == asset.pk)
        self.assertEqual(row["ownerKind"], "invitation")
        self.assertEqual(row["owner"], self.invitation.title)


class UploadAndRenameTests(ImagesCase):
    def test_upload_rejects_non_image(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        bad = SimpleUploadedFile("song.mp3", b"ID3" + b"\0" * 32, content_type="audio/mpeg")
        response = self.upload(IMAGES, {}, {"file": bad})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")

    def test_upload_creates_image(self):
        from system.tests.test_api_editor_assets import image_file

        response = self.upload(IMAGES, {}, {"file": image_file("hello.png")})
        self.assertEqual(response.status_code, 200, response.content)
        row = response.json()
        self.assertEqual(Asset.objects.get(pk=row["id"]).kind, "image")
        self.assertFalse(row["used"])

    def test_rename(self):
        asset = self.image(b"AAAA", "old.png")
        response = self.send("PATCH", f"{IMAGES}{asset.pk}/", {"name": "  جديد  "})
        self.assertEqual(response.status_code, 200)
        asset.refresh_from_db()
        self.assertEqual(asset.original_name, "جديد")
        self.assertEqual(self.send("PATCH", f"{IMAGES}{asset.pk}/", {"name": " "}).status_code, 400)

    def test_rename_rejects_other_kinds(self):
        self.assertEqual(self.send("PATCH", f"{IMAGES}{self.video.pk}/", {"name": "x"}).status_code, 404)


class DeleteTests(ImagesCase):
    def test_deletes_unused_image_and_file(self):
        asset = self.image(b"AAAA")
        path = asset.file.path
        self.assertEqual(self.send("DELETE", f"{IMAGES}{asset.pk}/").status_code, 200)
        self.assertFalse(Asset.objects.filter(pk=asset.pk).exists())
        self.assertFalse(os.path.exists(path))

    def test_refuses_used_image(self):
        asset = self.image(b"AAAA")
        self.point_at(asset)
        response = self.send("DELETE", f"{IMAGES}{asset.pk}/")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "asset_in_use")
        self.assertTrue(Asset.objects.filter(pk=asset.pk).exists())

    def test_delete_refuses_video(self):
        self.assertEqual(self.send("DELETE", f"{IMAGES}{self.video.pk}/").status_code, 404)

    def test_bulk_delete(self):
        a, b = self.image(b"AAAA"), self.image(b"BBBB")
        response = self.post(BULK, {"ids": [a.pk, b.pk]})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Asset.objects.filter(pk__in=[a.pk, b.pk]).exists())

    def test_bulk_delete_is_all_or_nothing_when_one_is_used(self):
        a, b = self.image(b"AAAA"), self.image(b"BBBB")
        self.point_at(b)
        self.assertEqual(self.post(BULK, {"ids": [a.pk, b.pk]}).status_code, 409)
        self.assertEqual(Asset.objects.filter(pk__in=[a.pk, b.pk]).count(), 2)

    def test_bulk_delete_needs_ids(self):
        self.assertEqual(self.post(BULK, {"ids": []}).status_code, 400)


class DedupeTests(ImagesCase):
    def test_dry_run_changes_nothing(self):
        a = self.image(b"SAME")
        b = self.image(b"SAME")
        self.image(b"OTHER!")
        result = self.post(DEDUPE, {"dryRun": True}).json()
        self.assertEqual((result["removeCount"], result["keepCount"]), (1, 1))
        self.assertEqual(Asset.objects.filter(pk__in=[a.pk, b.pk]).count(), 2)

    def test_nothing_to_do(self):
        self.image(b"ONE")
        self.image(b"TWO!")
        result = self.post(DEDUPE, {}).json()
        self.assertEqual((result["removeCount"], result["keepCount"], result["groups"]), (0, 0, []))

    def test_keeps_the_most_used_copy_and_repoints_documents(self):
        old = self.image(b"SAME")  # الأقدم لكن مش مستخدم
        used = self.image(b"SAME")
        other = Invitation.objects.create(customer=self.customer, template=self.template,
                                          name_one="س", name_two="ص", status="draft")
        self.point_at(used)
        self.point_at(used, other)
        old_path, used_path = old.file.path, used.file.path

        result = self.apply_dedupe()

        self.assertEqual((result["removeCount"], result["keepCount"], result["repointedDocs"]), (1, 1, 0))
        self.assertTrue(Asset.objects.filter(pk=used.pk).exists())
        self.assertFalse(Asset.objects.filter(pk=old.pk).exists())
        self.assertFalse(os.path.exists(old_path))
        self.assertTrue(os.path.exists(used_path))
        self.assertEqual(self.cover_of(self.invitation), used.url)

    def test_documents_pointing_at_removed_copy_are_repointed(self):
        keeper = self.image(b"SAME")
        dup = self.image(b"SAME")
        # الأصل الباقي مستخدم مرتين فهو اللي يفضل
        other = Invitation.objects.create(customer=self.customer, template=self.template,
                                          name_one="س", name_two="ص", status="draft")
        self.point_at(keeper, other)
        self.point_at(keeper, self.invitation)
        third = Invitation.objects.create(customer=self.customer, template=self.template,
                                          name_one="ع", name_two="ف", status="draft")
        self.point_at(dup, third)

        result = self.apply_dedupe()

        self.assertEqual(result["repointedDocs"], 1)
        self.assertEqual(self.cover_of(third), keeper.url)
        # الفهرس اتحدّث: الصورة الباقية مستخدمة، والمحذوفة مالهاش مفتاح يشاور عليها
        row = next(r for r in self.get(IMAGES).json()["results"] if r["id"] == keeper.pk)
        self.assertTrue(row["used"])
        self.assertFalse(Asset.objects.filter(pk=dup.pk).exists())

    def test_different_content_is_never_touched(self):
        a = self.image(b"AAAA")
        b = self.image(b"BBBB")
        self.assertEqual(self.post(DEDUPE, {}).json()["removeCount"], 0)
        self.assertEqual(Asset.objects.filter(pk__in=[a.pk, b.pk]).count(), 2)

    def test_shared_file_survives_when_another_row_still_uses_it(self):
        keeper = self.image(b"SAME")
        dup = Asset.objects.create(kind="image", original_name="alias.png", size_bytes=4,
                                   file=keeper.file.name)
        self.apply_dedupe()
        remaining = Asset.objects.filter(pk__in=[keeper.pk, dup.pk])
        self.assertEqual(remaining.count(), 1)
        self.assertTrue(os.path.exists(remaining.get().file.path))
