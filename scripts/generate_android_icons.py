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
    s = size / 192
    def q(v): return int(round(v*s))
    # Signal-yellow rounded square background.
    rect(q(0), q(0), q(192), q(192), (255, 205, 55, 255), q(38))
    # Road stripe.
    rect(q(0), q(145), q(192), q(192), (241, 179, 29, 255), q(20))
    # Bus silhouette and front windscreen.
    rect(q(30), q(48), q(162), q(139), (27, 35, 45, 255), q(18))
    rect(q(42), q(61), q(150), q(104), (239, 245, 248, 255), q(8))
    rect(q(48), q(67), q(91), q(98), (67, 104, 126, 255), q(5))
    rect(q(99), q(67), q(144), q(98), (67, 104, 126, 255), q(5))
    # Front destination panel and signal-red route marker.
    rect(q(42), q(111), q(150), q(124), (255, 205, 55, 255), q(4))
    circle(q(139), q(117), q(4), (220, 55, 54, 255))
    # Wheels.
    circle(q(59), q(139), q(13), (20, 25, 31, 255))
    circle(q(134), q(139), q(13), (20, 25, 31, 255))
    circle(q(59), q(139), q(5), (210, 218, 222, 255))
    circle(q(134), q(139), q(5), (210, 218, 222, 255))
    # Small route line below the bus.
    rect(q(55), q(165), q(137), q(171), (27, 35, 45, 255), q(3))
    circle(q(48), q(168), q(6), (220, 55, 54, 255))
    circle(q(144), q(168), q(6), (45, 145, 91, 255))
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
