#!/usr/bin/env python3
"""Generate deterministic YatraBus launcher PNGs using only Python's standard library.

The repository intentionally keeps generated Android density assets out of Git.
This script recreates all launcher mipmap resources before an Android build.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / "android/app/src/main/res"
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def png_rgba(width, height, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * width * 4:(y + 1) * width * 4]) for y in range(height))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def make_icon(size):
    px = [0] * (size * size * 4)
    def put(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            px[i:i+4] = color
    def rect(x1, y1, x2, y2, color, radius=0):
        for y in range(y1, y2):
            for x in range(x1, x2):
                if radius:
                    cx = min(max(x, x1 + radius), x2 - radius - 1)
                    cy = min(max(y, y1 + radius), y2 - radius - 1)
                    if (x-cx)**2 + (y-cy)**2 > radius**2:
                        continue
                put(x, y, color)
    def circle(cx, cy, radius, color):
        for y in range(cy-radius, cy+radius+1):
            for x in range(cx-radius, cx+radius+1):
                if (x-cx)**2 + (y-cy)**2 <= radius**2:
                    put(x, y, color)
    s = size / 64
    def q(v): return int(round(v*s))
    # Exact original YatraBus launcher mark from the 16 Nov app:
    # deep-green rounded tile, green bus body, mint windshield and amber lamps.
    rect(q(0), q(0), q(64), q(64), (14, 77, 52, 255), q(16))
    rect(q(12), q(10), q(52), q(50), (21, 128, 61, 255), q(8))
    rect(q(16), q(14), q(48), q(30), (209, 250, 229, 255), q(4))
    rect(q(16), q(34), q(24), q(40), (254, 240, 138, 255), q(2))
    rect(q(40), q(34), q(48), q(40), (254, 240, 138, 255), q(2))
    rect(q(26), q(36), q(38), q(38), (255, 255, 255, 255), q(1))
    circle(q(20), q(52), q(5), (17, 24, 39, 255))
    circle(q(44), q(52), q(5), (17, 24, 39, 255))
    circle(q(20), q(52), q(2), (156, 163, 175, 255))
    circle(q(44), q(52), q(2), (156, 163, 175, 255))
    return png_rgba(size, size, px)

def main():
    for density, size in DENSITIES.items():
        folder = ROOT / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        data = make_icon(size)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            (folder / name).write_bytes(data)
        print(f"Generated {density} launcher icons ({size}x{size})")


if __name__ == "__main__":
    main()
