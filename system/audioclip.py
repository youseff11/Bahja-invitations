"""قص ملف MP3 على حدود الفريمات بدون فك ترميز ولا ffmpeg (السيرفر ماعندوش).

بيتستخدم لنقطة بداية الأغنية: النسخة المقصوصة بتتشغّل من أولها، فمفيش
قفز جوّه الملف (الاستضافة مابتدعمش Range) ولا انتظار لتحميله كله.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from urllib.parse import unquote, urlparse

from django.conf import settings

_BITRATES = {
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],  # MPEG1
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],      # MPEG2
    0: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],      # MPEG2.5
}
_RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}

CLIPS_DIR = "music_clips"


def _id3v2_size(data: bytes) -> int:
    if data[:3] != b"ID3" or len(data) < 10:
        return 0
    size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
    return 10 + size


def _frame_at(data: bytes, pos: int):
    """(طول الفريم، مدته بالثانية) لو فيه هيدر Layer III سليم عند pos، وإلا None."""
    if pos + 4 > len(data):
        return None
    b1, b2, b3 = data[pos + 1], data[pos + 2], data[pos]
    if b3 != 0xFF or (b1 & 0xE0) != 0xE0:
        return None
    version = (b1 >> 3) & 3
    layer = (b1 >> 1) & 3
    if version == 1 or layer != 1:  # محجوز / مش Layer III
        return None
    bitrate_idx, rate_idx = b2 >> 4, (b2 >> 2) & 3
    if bitrate_idx in (0, 15) or rate_idx == 3:
        return None
    bitrate = _BITRATES[version][bitrate_idx] * 1000
    rate = _RATES[version][rate_idx]
    padding = (b2 >> 1) & 1
    samples = 1152 if version == 3 else 576
    length = (samples // 8) * bitrate // rate + padding
    return length, samples / rate


def clip_mp3(data: bytes, start: float, end: float = 0) -> bytes | None:
    """الفريمات من ثانية start لحد end (0 = لآخر الملف). None لو الملف مش MP3 مفهوم."""
    pos = _id3v2_size(data)
    frames: list[tuple[int, int, float]] = []
    t = 0.0
    while pos < len(data):
        info = _frame_at(data, pos)
        if info is None:
            if data[pos:pos + 3] == b"TAG":  # ID3v1 في آخر الملف
                break
            pos += 1  # إعادة مزامنة
            continue
        length, dur = info
        if pos + length > len(data):
            break
        body = data[pos:pos + length]
        # فريم Xing/Info (هيدر VBR): بيبقى غلط بعد القص، فبنرميه
        if not frames and (b"Xing" in body[:48] or b"Info" in body[:48]):
            pos += length
            continue
        frames.append((pos, length, t))
        t += dur
        pos += length
    if len(frames) < 2:
        return None
    picked = [f for f in frames if f[2] >= start and (not end or f[2] < end)]
    if not picked:
        return None
    return b"".join(data[off:off + ln] for off, ln, _ in picked)


def _local_path(url: str) -> Path | None:
    """مسار ملف الميديا المحلي اللي الرابط بيشاور عليه (أو None)."""
    path = unquote(urlparse(url).path)
    if not path.startswith(settings.MEDIA_URL):
        return None
    root = Path(settings.MEDIA_ROOT).resolve()
    candidate = (root / path[len(settings.MEDIA_URL):]).resolve()
    if root not in candidate.parents or candidate.suffix.lower() != ".mp3" or not candidate.is_file():
        return None
    return candidate


def clipped_music_url(url: str, start: float, end: float = 0) -> str | None:
    """رابط نسخة مقصوصة من الأغنية (بتتعمل مرة وتتخزّن)، أو None لو مش ممكن."""
    src = _local_path(url)
    if src is None:
        return None
    stat = src.stat()
    key = f"{src}|{stat.st_mtime_ns}|{stat.st_size}|{start:.3f}|{end:.3f}"
    name = hashlib.sha1(key.encode()).hexdigest()[:20] + ".mp3"
    out = Path(settings.MEDIA_ROOT) / CLIPS_DIR / name
    if not out.is_file():
        try:
            clipped = clip_mp3(src.read_bytes(), start, end)
        except OSError:
            return None
        if not clipped:
            return None
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp")
        tmp.write_bytes(clipped)
        os.replace(tmp, out)
    return f"{settings.MEDIA_URL}{CLIPS_DIR}/{name}"
