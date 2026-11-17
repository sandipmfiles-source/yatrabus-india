#!/usr/bin/env python3
"""Copy the exact launcher density PNGs extracted from the original 16 Nov APK."""
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/icons/launcher-original"
ANDROID_RES = ROOT / "android/app/src/main/res"
DENSITIES = ("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi")


def main() -> None:
    for density in DENSITIES:
        source = SOURCE / f"{density}.png"
        if not source.is_file():
            raise FileNotFoundError(f"Original YatriBus icon missing: {source}")
        target = ANDROID_RES / f"mipmap-{density}"
        target.mkdir(parents=True, exist_ok=True)
        for filename in ("ic_launcher.png", "ic_launcher_round.png"):
            copyfile(source, target / filename)
        print(f"Restored exact original YatriBus {density} launcher icons")


if __name__ == "__main__":
    main()
