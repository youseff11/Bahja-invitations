import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings

from .. import audioclip
from ..api.invite import _music

# فريم MPEG1 Layer III، 128kbps، 44.1kHz، من غير padding: 417 بايت ومدته ~26.12ms
HEADER = bytes([0xFF, 0xFB, 0x90, 0x00])
FRAME_LEN = 417


def fake_mp3(count: int, id3: bool = True) -> bytes:
    body = b"".join(HEADER + bytes([i]) * (FRAME_LEN - 4) for i in range(count))
    tag = b"ID3\x03\x00\x00\x00\x00\x00\x05" + b"x" * 5 if id3 else b""
    return tag + body


class ClipMp3Tests(SimpleTestCase):
    def test_starts_at_first_frame_after_start_second(self):
        out = audioclip.clip_mp3(fake_mp3(100), 1.0)
        # فريم 39 هو أول فريم بيبدأ عند أو بعد ثانية 1 (39 × 26.12ms = 1.019s)
        self.assertEqual(out[4], 39)
        self.assertEqual(len(out), (100 - 39) * FRAME_LEN)

    def test_end_second_cuts_the_tail(self):
        out = audioclip.clip_mp3(fake_mp3(100), 1.0, 2.0)
        self.assertEqual(out[4], 39)
        self.assertEqual(out[-1], 76)  # آخر فريم بيبدأ قبل ثانية 2

    def test_skips_id3_and_resyncs_over_junk(self):
        data = fake_mp3(10)[:15] + b"\x00\x01\x02" + fake_mp3(10, id3=False)
        self.assertIsNotNone(audioclip.clip_mp3(data, 0))

    def test_not_an_mp3_returns_none(self):
        self.assertIsNone(audioclip.clip_mp3(b"RIFF" + b"\x00" * 500, 1.0))

    def test_start_past_the_end_returns_none(self):
        self.assertIsNone(audioclip.clip_mp3(fake_mp3(10), 60))


class ClippedMusicUrlTests(SimpleTestCase):
    def test_music_payload_points_to_a_cached_clip_starting_at_zero(self):
        with tempfile.TemporaryDirectory() as root:
            (Path(root) / "a").mkdir()
            (Path(root) / "a" / "Music.mp3").write_bytes(fake_mp3(100))
            with override_settings(MEDIA_ROOT=root, MEDIA_URL="/media/"):
                doc = {"music_url": "/media/a/Music.mp3", "music_start": 1}
                first = _music(doc)
                self.assertTrue(first["url"].startswith("/media/music_clips/"))
                self.assertEqual((first["start"], first["end"]), (0.0, 0.0))
                clip = Path(root) / first["url"][len("/media/"):]
                self.assertEqual(clip.read_bytes()[4], 39)
                self.assertEqual(_music(doc)["url"], first["url"])

    def test_no_start_keeps_the_original_file(self):
        self.assertEqual(_music({"music_url": "/media/a/Music.mp3"})["url"], "/media/a/Music.mp3")

    def test_unclippable_source_falls_back_to_client_seek(self):
        with tempfile.TemporaryDirectory() as root, override_settings(MEDIA_ROOT=root, MEDIA_URL="/media/"):
            out = _music({"music_url": "https://cdn.example.com/s.mp3", "music_start": 12})
            self.assertEqual(out["url"], "https://cdn.example.com/s.mp3")
            self.assertEqual(out["start"], 12)

    def test_path_traversal_is_not_clipped(self):
        with tempfile.TemporaryDirectory() as root, override_settings(MEDIA_ROOT=root, MEDIA_URL="/media/"):
            self.assertIsNone(audioclip.clipped_music_url("/media/../x.mp3", 5))
