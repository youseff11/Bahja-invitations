"""اختبارات حماية القوالب من أدوات نسخ المواقع (‎system/protection.py‎)."""

from django.test import override_settings

from system.tests.test_api_invite import InviteBase

BROWSER = {
    "HTTP_USER_AGENT": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    "HTTP_ACCEPT": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "HTTP_SEC_FETCH_MODE": "navigate",
}
WGET = {"HTTP_USER_AGENT": "Wget/1.21.4", "HTTP_ACCEPT": "*/*"}
SPOOFED_UA = {"HTTP_USER_AGENT": BROWSER["HTTP_USER_AGENT"], "HTTP_ACCEPT": "*/*"}
FB_CRAWLER = {"HTTP_USER_AGENT": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
              "HTTP_ACCEPT": "*/*"}

PAGE = "/app/templates/golden-t/preview/"
API = "/api/v1/templates/golden-t/preview/"


@override_settings(PROTECT_TEMPLATES=True, SITE_URL="https://www.example.com")
class ProtectionTests(InviteBase):
    def test_browser_gets_full_page_with_content_and_domain_lock(self):
        html = self.client.get(PAGE, **BROWSER).content.decode()
        self.assertIn('id="invite-data"', html)
        self.assertIn("location.replace", html)
        self.assertIn('"www.example.com"', html)
        self.assertIn('"testserver"', html)

    def test_copier_tools_get_lite_page_without_content(self):
        full = self.client.get(PAGE, **BROWSER).content.decode()
        for extra in (WGET, SPOOFED_UA, {}):
            html = self.client.get(PAGE, **extra).content.decode()
            self.assertNotIn('id="invite-data"', html)
            self.assertNotIn("/static/", html)
            self.assertNotIn("data-lb-layout-css", html)
            self.assertLess(len(html), len(full) / 2)

    def test_lite_page_keeps_share_meta_for_crawlers(self):
        html = self.client.get(PAGE, **FB_CRAWLER).content.decode()
        self.assertIn('property="og:title"', html)
        self.assertIn("معاينة قالب", html)
        self.assertNotIn('id="invite-data"', html)

    def test_headless_and_tool_user_agents_stay_lite_even_with_cookie(self):
        self.client.cookies["bjv"] = "1"
        headless = dict(BROWSER, HTTP_USER_AGENT="Mozilla/5.0 HeadlessChrome/126.0")
        self.assertNotIn('id="invite-data"', self.client.get(PAGE, **headless).content.decode())

    def test_misclassified_browser_recovers_with_cookie(self):
        self.client.cookies["bjv"] = "1"
        html = self.client.get(PAGE, **SPOOFED_UA).content.decode()
        self.assertIn('id="invite-data"', html)

    def test_bypass_token(self):
        with override_settings(PROTECT_BYPASS_TOKEN="s3cret"):
            ok = self.client.get(PAGE, HTTP_X_BAHJA_BYPASS="s3cret", **WGET).content.decode()
            bad = self.client.get(PAGE, HTTP_X_BAHJA_BYPASS="nope", **WGET).content.decode()
        self.assertIn('id="invite-data"', ok)
        self.assertNotIn('id="invite-data"', bad)

    def test_lite_views_are_not_counted(self):
        self.client.get(f"/app/i/{self.inv.slug}/", **WGET)
        self.inv.refresh_from_db()
        self.assertEqual(self.inv.public_views, 0)
        self.client.get(f"/app/i/{self.inv.slug}/", **BROWSER)
        self.inv.refresh_from_db()
        self.assertEqual(self.inv.public_views, 1)

    def test_preview_api_is_same_origin_only(self):
        self.assertEqual(self.client.get(API).status_code, 403)
        self.assertEqual(self.client.get(API, **WGET).status_code, 403)
        self.assertEqual(self.client.get(API, HTTP_REFERER="https://evil.example/x").status_code, 403)
        self.assertEqual(self.client.get(API, HTTP_SEC_FETCH_SITE="cross-site").status_code, 403)
        self.assertEqual(self.client.get(API, HTTP_SEC_FETCH_SITE="none").status_code, 403)
        self.assertEqual(self.client.get(API, HTTP_SEC_FETCH_SITE="same-origin").status_code, 200)
        self.assertEqual(
            self.client.get(API, HTTP_REFERER="http://testserver/templates/golden-t/preview/").status_code, 200)
        self.assertEqual(self.client.get(API, HTTP_ORIGIN="http://testserver").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/invitations/{self.inv.slug}/render/").status_code, 403)
        self.assertEqual(self.client.get(
            f"/api/v1/invitations/{self.inv.slug}/render/", HTTP_SEC_FETCH_SITE="same-origin").status_code, 200)

    def test_extra_allowed_hosts_and_www_variants(self):
        with override_settings(PROTECT_ALLOWED_HOSTS=["Bahja.example"], SITE_URL="https://shop.test"):
            html = self.client.get(PAGE, **BROWSER).content.decode()
        for name in ("bahja.example", "www.bahja.example", "shop.test", "www.shop.test", "localhost"):
            self.assertIn(f'"{name}"', html)


class ProtectionOffTests(InviteBase):
    def test_disabled_by_default_in_tests(self):
        html = self.client.get(PAGE).content.decode()
        self.assertIn('id="invite-data"', html)
        self.assertNotIn("location.replace", html)
        self.assertEqual(self.client.get(API).status_code, 200)
