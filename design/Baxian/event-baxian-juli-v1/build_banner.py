#!/usr/bin/env python3
"""Build titled and responsive 3:1 Baxian Juli campaign banners."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "banner-props-imagegen.png"
TITLE = ROOT / "title-baxian-juli.png"


def render(width: int, height: int, suffix: str) -> None:
    background = Image.open(SOURCE).convert("RGB").resize(
        (width, height), Image.Resampling.LANCZOS
    )
    background.save(ROOT / f"event-banner-background{suffix}.png", optimize=True)
    background.save(
        ROOT / f"event-banner-background{suffix}.webp",
        "WEBP",
        quality=92,
        method=6,
    )

    banner = background.convert("RGBA")
    title = Image.open(TITLE).convert("RGBA")
    target_width = round(width * 0.37)
    target_height = round(title.height * target_width / title.width)
    title = title.resize((target_width, target_height), Image.Resampling.LANCZOS)
    x = (width - target_width) // 2
    y = (height - target_height) // 2 - round(height * 0.015)
    banner.alpha_composite(title, (x, y))
    banner.convert("RGB").save(ROOT / f"event-banner{suffix}.png", optimize=True)
    banner.convert("RGB").save(
        ROOT / f"event-banner{suffix}.webp",
        "WEBP",
        quality=92,
        method=6,
    )


def main() -> None:
    render(2172, 724, "")
    render(1080, 360, "-1080")
    render(750, 250, "-750")


if __name__ == "__main__":
    main()
