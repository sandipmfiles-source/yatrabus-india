#!/usr/bin/env python3
"""Recreate the original 16 Nov YatriBus blue-bus launcher artwork.

The geometry and exact brand colors are taken from the launcher PNGs inside
YatraBus-Original-2026-11-16.apk. This intentionally does not redesign the icon.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / "android/app/src/main/res"
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
BLUE = (21, 101, 192, 255)
WHITE = (255, 255, 255, 255)
YELLOW = (255, 193, 7, 255)


def png_rgba(width, height, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * width * 4:(y + 1) * width * 4]) for y in range(height))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def make_icon(size):
    pixels = [0] * (size * size * 4)

    def put(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            pixels[i:i + 4] = color

    def rect(x1, y1, x2, y2, color, radius=0):
        for y in range(y1, y2):
            for x in range(x1, x2):
                if radius:
                    cx = min(max(x, x1 + radius), x2 - radius - 1)
                    cy = min(max(y, y1 + radius), y2 - radius - 1)
                    if (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2:
                        continue
                put(x, y, color)

    def circle(cx, cy, radius, color):
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                    put(x, y, color)

    scale = size / 192
    q = lambda value: int(round(value * scale))

    rect(0, 0, size, size, BLUE)
    # Original white bus body.
    rect(q(42), q(34), q(150), q(139), WHITE, q(12))
    # Original two blue window bands.
    rect(q(61), q(51), q(131), q(83), BLUE)
    rect(q(55), q(94), q(137), q(108), BLUE)
    # Original pair of amber/yellow wheels.
    circle(q(65), q(145), q(11), YELLOW)
    circle(q(126), q(145), q(11), YELLOW)
    return png_rgba(size, size, pixels)


def main():
    for density, size in DENSITIES.items():
        folder = ROOT / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        data = make_icon(size)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            (folder / name).write_bytes(data)
        print(f"Generated original YatriBus {density} icon ({size}x{size})")


if __name__ == "__main__":
    main()
