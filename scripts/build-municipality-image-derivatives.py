#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "apps" / "blog" / "public" / "images" / "kommune"
MAX_HERO_WIDTH = 1376
THUMB_WIDTH = 640


def convert(source: Path, target: Path, width: int, quality: int) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        if image.width > width:
            height = round(image.height * (width / image.width))
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        image.save(
            target,
            format="WEBP",
            quality=quality,
            method=6,
            optimize=True,
        )


def main() -> None:
    for source in sorted(IMAGE_DIR.glob("*-hero.png")):
        hero_target = source.with_suffix(".webp")
        thumb_target = source.with_name(source.stem.replace("-hero", "-hero-thumb") + ".webp")

        convert(source, hero_target, MAX_HERO_WIDTH, 82)
        convert(source, thumb_target, THUMB_WIDTH, 76)

        print(f"built {hero_target.name} and {thumb_target.name}")


if __name__ == "__main__":
    main()
