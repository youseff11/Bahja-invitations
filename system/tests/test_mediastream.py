import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings

from system import mediastream


class StreamifyTests(SimpleTestCase):
    def test_video_and_audio_links_move_to_stream(self):
        payload = {
            "intro": {"video": "/media/assets/2026/11/a/x.mp4", "poster": "/media/assets/2026/11/a/x-thumb.png"},
            "music": {"url": "/media/music_clips/c.mp3"},
            "blocks": [{"code": '<video src="/media/a/b.MOV" poster="/media/a/p.jpg"></video>'}],
        }
        out = mediastream.streamify(payload)
        self.assertEqual(out["intro"]["video"], "/stream/assets/2026/11/a/x.mp4")
        self.assertEqual(out["intro"]["poster"], "/media/assets/2026/11/a/x-thumb.png")
        self.assertEqual(out["music"]["url"], "/stream/music_clips/c.mp3")
        self.assertIn('src="/stream/a/b.MOV"', out["blocks"][0]["code"])
        self.assertIn('poster="/media/a/p.jpg"', out["blocks"][0]["code"])

    def test_other_hosts_and_images_untouched(self):
        for text in ("https://cdn.example.com/media/x.mp4", "/media/a/b.jpg", "/media/a/b.mp4x"):
            self.assertEqual(mediastream.streamify_text(text), text)


class StreamViewTests(SimpleTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "v.mp4").write_bytes(bytes(range(100)))
        (self.root / "a.mp3").write_bytes(b"x" * 50)
        (self.root / "i.png").write_bytes(b"png")
        override = override_settings(MEDIA_ROOT=self.root)
        override.enable()
        self.addCleanup(override.disable)

    def body(self, response):
        return b"".join(response.streaming_content)

    def test_range_gets_206(self):
        r = self.client.get("/stream/v.mp4", HTTP_RANGE="bytes=10-19")
        self.assertEqual(r.status_code, 206)
        self.assertEqual(r["Content-Range"], "bytes 10-19/100")
        self.assertEqual(r["Accept-Ranges"], "bytes")
        self.assertEqual(self.body(r), bytes(range(10, 20)))

    def test_plain_get_is_full_and_advertises_ranges(self):
        r = self.client.get("/stream/v.mp4")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Accept-Ranges"], "bytes")
        self.assertEqual(len(self.body(r)), 100)

    def test_audio_served(self):
        r = self.client.get("/stream/a.mp3", HTTP_RANGE="bytes=0-9")
        self.assertEqual(r.status_code, 206)
        self.assertEqual(r["Content-Type"], "audio/mpeg")

    def test_images_and_escapes_not_served(self):
        self.assertEqual(self.client.get("/stream/i.png").status_code, 404)
        self.assertEqual(self.client.get("/stream/../v.mp4").status_code, 404)
