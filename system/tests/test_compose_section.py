"""قسم «اعملوا دعوتكم بذوقكم»: حتت القوالب، اختيار الأدمن، وبيانات الرئيسية."""

from django.core.cache import cache

from system.models import SiteSetting, Template
from system.tests.test_api_dashboard import BASE, DashboardApiCase

PIECES = {"intro": "/media/assets/a/intro.webp", "ayah": "/media/assets/a/ayah.webp"}


class ComposePiecesTests(DashboardApiCase):
    def test_patch_saves_pieces_and_drops_empty(self):
        res = self.send("PATCH", f"{BASE}/templates/{self.template.pk}/",
                        {"composePieces": {**PIECES, "rsvp": ""}})
        self.assertEqual(res.status_code, 200)
        self.template.refresh_from_db()
        self.assertEqual(self.template.compose_pieces, PIECES)

    def test_patch_rejects_unknown_part_and_bad_url(self):
        bad_part = self.send("PATCH", f"{BASE}/templates/{self.template.pk}/",
                             {"composePieces": {"hero": "/media/x.webp"}})
        bad_url = self.send("PATCH", f"{BASE}/templates/{self.template.pk}/",
                            {"composePieces": {"intro": "javascript:alert(1)"}})
        self.assertEqual((bad_part.status_code, bad_url.status_code), (400, 400))
        self.template.refresh_from_db()
        self.assertEqual(self.template.compose_pieces, {})


class ComposeSettingTests(DashboardApiCase):
    def test_put_saves_order_and_get_lists_parts(self):
        other = Template.objects.create(name="ورد", slug="rose", compose_pieces=PIECES)
        res = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [other.pk, self.template.pk, other.pk]})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(SiteSetting.load().compose_template_ids, [other.pk, self.template.pk])
        rows = {r["id"]: r for r in self.get(f"{BASE}/site/compose/").json()["templates"]}
        self.assertEqual(rows[other.pk]["parts"], ["intro", "ayah"])
        self.assertEqual(rows[self.template.pk]["parts"], [])

    def test_put_rejects_unknown_ids_and_too_many(self):
        missing = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [999999]})
        bad = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": "1,2"})
        many = [Template.objects.create(name=f"t{i}", slug=f"t{i}").pk for i in range(9)]
        too_many = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": many})
        self.assertEqual((missing.status_code, bad.status_code, too_many.status_code), (400, 400, 400))


class ComposeHomeTests(DashboardApiCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def home(self):
        return self.client.get("/api/v1/public/home/").json()["compose"]

    def test_chosen_templates_in_order_skip_inactive_and_pieceless(self):
        a = Template.objects.create(name="أ", slug="a", compose_pieces=PIECES)
        b = Template.objects.create(name="ب", slug="b", compose_pieces={"intro": "/media/b.webp"})
        hidden = Template.objects.create(name="مخفي", slug="h", compose_pieces=PIECES, is_active=False)
        cfg = SiteSetting.load()
        cfg.compose_template_ids = [b.pk, hidden.pk, self.template.pk, a.pk]
        cfg.save()
        self.assertEqual([t["slug"] for t in self.home()], ["b", "a"])

    def test_falls_back_to_templates_with_pieces(self):
        Template.objects.create(name="أ", slug="a", compose_pieces=PIECES)
        data = self.home()
        self.assertEqual([t["slug"] for t in data], ["a"])
        self.assertEqual(data[0]["pieces"], PIECES)
