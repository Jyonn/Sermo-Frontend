#!/usr/bin/env python3
"""Convert the He Xiangu ImageGen chroma sheet to true alpha."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "imagegen-sheet-chroma.png"
OUTPUT = ROOT / "source" / "imagegen-sheet.png"


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    pixels = []
    for red, green, blue, _ in image.getdata():
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
    image.putdata(pixels)
    image.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
