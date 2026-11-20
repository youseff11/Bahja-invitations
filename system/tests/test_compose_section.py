"""قسم «اعملوا دعوتكم بذوقكم»: حتت القوالب، اختيار الأدمن، وبيانات الرئيسية."""

from django.core.cache import cache

from system.models import SiteSetting, Template
from system.tests.test_api_dashboard import BASE, DashboardApiCase

PIECES = {"intro": "/media/assets/a/intro.webp", "ayah": "/media/assets/a/ayah.webp"}
STORED = {"intro": {"src": "/media/assets/a/intro.webp", "on": "any"},
          "ayah": {"src": "/media/assets/a/ayah.webp", "on": "any"}}


class ComposePiecesTests(DashboardApiCase):
    def test_patch_saves_pieces_and_drops_empty(self):
        res = self.send("PATCH", f"{BASE}/templates/{self.template.pk}/",
                        {"composePieces": {**PIECES, "rsvp": ""}})
        self.assertEqual(res.status_code, 200)
        self.template.refresh_from_db()
        self.assertEqual(self.template.compose_pieces, STORED)

    def test_patch_saves_background_and_tones(self):
        body = {"background": {"src": "/media/bg.webp", "tone": "dark"},
                "ayah": {"src": "/media/a.webp", "on": "dark"}}
        res = self.send("PATCH", f"{BASE}/templates/{self.template.pk}/", {"composePieces": body})
        self.assertEqual(res.status_code, 200)
        self.template.refresh_from_db()
        self.assertEqual(self.template.compose_pieces, body)

    def test_patch_rejects_bad_tone(self):
        res = self.send("PATCH", f"{BASE}/templates/{self.template.pk}/",
                        {"composePieces": {"ayah": {"src": "/media/a.webp", "on": "purple"}}})
        self.assertEqual(res.status_code, 400)

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

    def test_put_order_sets_gallery_order(self):
        a = Template.objects.create(name="أ", slug="ord-a", is_active=True)
        b = Template.objects.create(name="ب", slug="ord-b", is_active=True)
        order = [b.pk, self.template.pk, a.pk]
        res = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [], "order": order})
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r["id"] for r in res.json()["templates"]][:3], order)
        self.assertEqual([Template.objects.get(pk=i).sort_order for i in order], [1, 2, 3])
        bad = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [], "order": "1,2"})
        self.assertEqual(bad.status_code, 400)

    def test_put_rejects_unknown_ids_and_too_many(self):
        missing = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [999999]})
        bad = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": "1,2"})
        many = [Template.objects.create(name=f"t{i}", slug=f"t{i}").pk for i in range(13)]
        too_many = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": many})
        self.assertEqual((missing.status_code, bad.status_code, too_many.status_code), (400, 400, 400))

    def test_put_saves_layout_and_rejects_unknown(self):
        res = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [], "layout": "grid"})
        self.assertEqual((res.status_code, res.json()["layout"]), (200, "grid"))
        self.assertEqual(SiteSetting.load().templates_layout, "grid")
        bad = self.send("PUT", f"{BASE}/site/compose/", {"templateIds": [], "layout": "carousel"})
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(SiteSetting.load().templates_layout, "grid")

    def test_layout_reaches_the_public_site(self):
        cache.clear()
        self.assertEqual(self.client.get("/api/v1/public/home/").json()["site"]["templatesLayout"], "showcase")


class ComposeHomeTests(DashboardApiCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def home(self):
        return self.client.get("/api/v1/public/home/").json()["compose"]

    def test_chosen_templates_in_order_skip_inactive(self):
        a = Template.objects.create(name="أ", slug="a", compose_pieces=PIECES)
        b = Template.objects.create(name="ب", slug="b", compose_pieces={"intro": "/media/b.webp"})
        hidden = Template.objects.create(name="مخفي", slug="h", compose_pieces=PIECES, is_active=False)
        cfg = SiteSetting.load()
        cfg.compose_template_ids = [b.pk, hidden.pk, self.template.pk, a.pk]
        cfg.save()
        data = self.home()
        # القالب اللي مالوش حتت بيظهر عادي (المعاينة الحية مش محتاجاها)
        self.assertEqual([t["slug"] for t in data], ["b", self.template.slug, "a"])
        self.assertEqual(data[1]["pieces"], {})

    def test_nothing_chosen_means_empty_list(self):
        Template.objects.create(name="أ", slug="a", compose_pieces=PIECES)
        self.assertEqual(self.home(), [])

    def test_background_is_split_from_pieces(self):
        t = Template.objects.create(name="ب", slug="bg", compose_pieces={
            "background": {"src": "/media/bg.webp", "tone": "light"}, "rsvp": {"src": "/media/r.webp", "on": "light"}})
        cfg = SiteSetting.load()
        cfg.compose_template_ids = [t.pk]
        cfg.save()
        data = self.home()
        self.assertEqual(data[0]["background"], {"src": "/media/bg.webp", "tone": "light"})
        self.assertEqual(data[0]["pieces"], {"rsvp": {"src": "/media/r.webp", "on": "light"}})
