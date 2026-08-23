#!/usr/bin/env python3
"""Convert the ImageGen chroma title into true-alpha web assets."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "title-baxian-juli-chroma.png"


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
    title = remove_green(Image.open(SOURCE))
    alpha_box = title.getchannel("A").getbbox()
    if alpha_box:
        left, top, right, bottom = alpha_box
        padding = 36
        box = (
            max(0, left - padding),
            max(0, top - padding),
            min(title.width, right + padding),
            min(title.height, bottom + padding),
        )
        title = title.crop(box)

    title.save(ROOT / "title-baxian-juli.png", optimize=True)
    for width in (1200, 800, 480):
        height = round(title.height * width / title.width)
        resized = title.resize((width, height), Image.Resampling.LANCZOS)
        resized.save(ROOT / f"title-baxian-juli-{width}.png", optimize=True)


if __name__ == "__main__":
    main()
