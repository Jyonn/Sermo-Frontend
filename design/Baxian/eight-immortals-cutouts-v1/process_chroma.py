#!/usr/bin/env python3
"""Convert ImageGen chroma-key renders into standardized transparent PNG assets."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parent
SIZES = (1024, 512, 256)


def remove_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.getdata():
        dominance = green - max(red, blue)
        if green >= 170 and dominance >= 105:
            alpha = 0
        elif green >= 135 and dominance >= 65:
            alpha = round(255 * (105 - dominance) / 40)
            alpha = max(0, min(255, alpha))
        else:
            alpha = 255

        # Suppress residual green only on feathered edge pixels.
        if 0 < alpha < 255:
            green = min(green, max(red, blue) + 12)
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def main() -> None:
    source_dir = ROOT / "source-chroma"
    for source in sorted(source_dir.glob("*.png")):
        transparent = remove_green(Image.open(source))
        for size in SIZES:
            output_dir = ROOT / f"png-{size}"
            output_dir.mkdir(parents=True, exist_ok=True)
            resized = transparent.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(output_dir / source.name, optimize=True)


if __name__ == "__main__":
    main()
