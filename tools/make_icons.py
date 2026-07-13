#!/usr/bin/env python3
"""Generate Threadline extension icons (pure stdlib — no Pillow needed).

Design: dark rounded square with three "thread" lines of decreasing width,
the top one in Reddit-adjacent orange. Regenerate with:
    python3 tools/make_icons.py
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"

BG = (28, 30, 36, 255)        # dark slate
ACCENT = (255, 69, 0, 255)    # orange
FG = (232, 232, 234, 255)     # near-white
SS = 3                        # supersampling factor for smooth edges

# (y-center, height, x-start, width, color) — all as fractions of icon size
LINES = [
    (0.30, 0.115, 0.20, 0.60, ACCENT),
    (0.50, 0.115, 0.20, 0.48, FG),
    (0.70, 0.115, 0.20, 0.36, FG),
]


def png_bytes(width, height, rgba_rows):
    def chunk(tag, data):
        block = struct.pack(">I", len(data)) + tag + data
        return block + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rgba_rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def in_rounded_rect(x, y, size, radius):
    half = size / 2.0
    dx = max(abs(x - half) - (half - radius), 0.0)
    dy = max(abs(y - half) - (half - radius), 0.0)
    return dx * dx + dy * dy <= radius * radius


def sample(x, y, size):
    """Color at a subpixel coordinate (returns None for transparent)."""
    if not in_rounded_rect(x, y, size, radius=size * 0.22):
        return None
    for yc, h, xs, w, color in LINES:
        if abs(y - yc * size) <= (h * size) / 2 and xs * size <= x <= (xs + w) * size:
            return color
    return BG


def make(size):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS, size)
                    if c:
                        for i in range(4):
                            acc[i] += c[i]
            n = SS * SS
            row.extend(v // n for v in acc)
        rows.append(bytes(row))
    (OUT / f"icon{size}.png").write_bytes(png_bytes(size, size, rows))
    print(f"wrote icons/icon{size}.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (16, 32, 48, 128):
        make(s)
