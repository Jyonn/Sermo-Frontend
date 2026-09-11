#!/usr/bin/env python3
"""Slice generated FRIENDEN atlases into production-ready transparent layers."""

from __future__ import annotations

import argparse
from collections import deque
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
        "letter-rabbit": (25, 25, 400, 355),
        "flower-window-rabbit": (420, 65, 785, 420),
        "watering-dog": (795, 80, 1230, 435),
        "sunhat-rabbit": (35, 450, 385, 830),
        "sleeping-spotted-dog": (410, 570, 765, 830),
        "sunflower-friend": (825, 430, 1230, 845),
        "letter-dog": (20, 920, 325, 1250),
        "tea-rabbit": (330, 860, 650, 1215),
        "tea-companion": (650, 990, 875, 1250),
        "basket-friend": (875, 900, 1230, 1250),
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
        "flowering-ivy": (20, 0, 245, 750),
        "flower-arch": (245, 20, 870, 520),
        "purple-vine": (875, 0, 1190, 550),
        "sunflower": (1190, 0, 1536, 585),
        "yellow-flowers": (45, 600, 315, 1024),
        "tropical-pot": (315, 500, 680, 1024),
        "daisy-pot": (680, 600, 945, 1024),
        "hanging-plant": (950, 550, 1245, 1024),
        "yellow-butterfly": (1270, 560, 1536, 790),
        "orange-butterfly": (1270, 790, 1536, 1024),
    },
}


def keep_largest_alpha_component(alpha: Image.Image) -> Image.Image:
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or not pixels[x, y]:
                continue
            visited[index] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        next_index = next_y * width + next_x
                        if visited[next_index] or not pixels[next_x, next_y]:
                            continue
                        visited[next_index] = 1
                        queue.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component
    isolated = Image.new("L", alpha.size)
    isolated_pixels = isolated.load()
    for x, y in largest:
        isolated_pixels[x, y] = pixels[x, y]
    return isolated


def trim_alpha(image: Image.Image, padding: int = 6, isolate_subject: bool = False) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    # Generated atlases can contain a faint colored studio halo. Remove it and
    # re-expand the useful edge range before trimming so layers never reveal
    # rectangular seams over the environment plate.
    alpha = alpha.point(lambda value: 0 if value < 48 else round((value - 48) * 255 / 207))
    if isolate_subject:
        alpha = keep_largest_alpha_component(alpha)
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


def slice_atlas(source: Path, boxes: dict[str, tuple[int, int, int, int]], output: Path, isolate_subject: bool = False) -> None:
    atlas = Image.open(source).convert("RGBA")
    output.mkdir(parents=True, exist_ok=True)
    for name, box in boxes.items():
        trim_alpha(atlas.crop(box), isolate_subject=isolate_subject).save(output / f"{name}.png", optimize=True)


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
    slice_atlas(args.night_plants, PLANT_BOXES["night"], args.output / "night" / "plants", isolate_subject=True)
    slice_atlas(args.garden_plants, PLANT_BOXES["garden"], args.output / "garden" / "plants", isolate_subject=True)


if __name__ == "__main__":
    main()
