#!/usr/bin/env python3
"""Slice generated FRIENDEN atlases into production-ready transparent layers."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ACTOR_BOXES = {
    "night": {
        "door-rabbit": (0, 0, 410, 465),
        "window-black-cat": (450, 150, 770, 465),
        "sleeping-dog": (770, 0, 1230, 465),
        # Keep row boundaries clear of neighboring actors. The generated atlas
        # has generous transparent gutters, but its visual rows do not start at
        # the nominal grid lines.
        "mug-bear": (0, 500, 435, 900),
        "mug-window-cat": (445, 500, 850, 900),
        "door-penguin": (855, 500, 1230, 920),
        "window-sheep": (10, 945, 430, 1235),
        "path-bird": (455, 945, 800, 1235),
        "bottom-cat": (800, 945, 1230, 1235),
    },
    "garden": {
        "letter-rabbit": (0, 0, 410, 430),
        "flower-window-rabbit": (380, 0, 800, 430),
        "watering-dog": (770, 0, 1230, 440),
        "sunhat-rabbit": (0, 390, 410, 855),
        "sleeping-spotted-dog": (380, 390, 820, 855),
        "sunflower-friend": (775, 390, 1230, 860),
        "letter-dog": (0, 800, 345, 1278),
        "tea-rabbit": (320, 800, 660, 1278),
        "tea-companion": (615, 800, 905, 1278),
        "basket-friend": (850, 800, 1230, 1278),
    },
}

PLANT_BOXES = {
    "night": {
        "ivy-strand": (0, 0, 390, 570),
        "tall-pot": (360, 0, 775, 570),
        "white-flower-pot": (745, 0, 1155, 570),
        "mixed-flower-pot": (1120, 0, 1536, 570),
        "cactus-pot": (0, 480, 390, 1024),
        "broad-leaves": (330, 480, 790, 1024),
        "white-flower-vine": (740, 480, 1160, 1024),
        "star-shrub": (1110, 480, 1536, 1024),
    },
    "garden": {
        "flowering-ivy": (0, 0, 285, 610),
        "flower-arch": (260, 0, 790, 560),
        "purple-vine": (780, 0, 1190, 560),
        "sunflower": (1150, 0, 1536, 590),
        "yellow-flowers": (0, 520, 335, 1024),
        "tropical-pot": (300, 500, 690, 1024),
        "daisy-pot": (650, 530, 1000, 1024),
        "hanging-plant": (930, 520, 1250, 1024),
        "yellow-butterfly": (1190, 500, 1536, 780),
        "orange-butterfly": (1190, 735, 1536, 1024),
    },
}


def trim_alpha(image: Image.Image, padding: int = 6) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    # Generated atlases can contain a faint colored studio halo. Remove it and
    # re-expand the useful edge range before trimming so layers never reveal
    # rectangular seams over the environment plate.
    alpha = alpha.point(lambda value: 0 if value < 48 else round((value - 48) * 255 / 207))
    image.putalpha(alpha)
    box = alpha.getbbox()
    if not box:
        raise ValueError("asset crop is empty")
    left, top, right, bottom = box
    return image.crop((
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    ))


def slice_atlas(source: Path, boxes: dict[str, tuple[int, int, int, int]], output: Path) -> None:
    atlas = Image.open(source).convert("RGBA")
    output.mkdir(parents=True, exist_ok=True)
    for name, box in boxes.items():
        trim_alpha(atlas.crop(box)).save(output / f"{name}.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--night-plate", type=Path, required=True)
    parser.add_argument("--garden-plate", type=Path, required=True)
    parser.add_argument("--night-actors", type=Path, required=True)
    parser.add_argument("--garden-actors", type=Path, required=True)
    parser.add_argument("--night-plants", type=Path, required=True)
    parser.add_argument("--garden-plants", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    Image.open(args.night_plate).convert("RGB").save(args.output / "night-environment.webp", "WEBP", quality=91, method=6)
    Image.open(args.garden_plate).convert("RGB").save(args.output / "garden-environment.webp", "WEBP", quality=91, method=6)
    slice_atlas(args.night_actors, ACTOR_BOXES["night"], args.output / "night" / "actors")
    slice_atlas(args.garden_actors, ACTOR_BOXES["garden"], args.output / "garden" / "actors")
    slice_atlas(args.night_plants, PLANT_BOXES["night"], args.output / "night" / "plants")
    slice_atlas(args.garden_plants, PLANT_BOXES["garden"], args.output / "garden" / "plants")


if __name__ == "__main__":
    main()
