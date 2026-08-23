#!/usr/bin/env python3
"""Build compact true-alpha He Xiangu bubble seals from the chroma source."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "he-xiangu-pink-baxian-seal-v2-chroma.png"


def remove_green(image: Image.Image) -> Image.Image:
    output = image.convert("RGBA")
    pixels = []
    for red, green, blue, _ in output.getdata():
        dominance = green - max(red, blue)
        if green >= 170 and dominance >= 105:
            alpha = 0
        elif green >= 135 and dominance >= 65:
            alpha = max(0, min(255, round(255 * (105 - dominance) / 40)))
        else:
            alpha = 255
        if 0 < alpha < 255:
            green = min(green, max(red, blue) + 12)
        pixels.append((red, green, blue, alpha))
    output.putdata(pixels)
    return output


def main() -> None:
    seal = remove_green(Image.open(SOURCE))
    # Keep ImageGen's generous transparent padding: this intentionally reduces
    # the visual footprint without requiring one-off CSS sizing per character.
    for size in (512, 128):
        resized = seal.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(ROOT / f"he-xiangu-pink-baxian-seal-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
