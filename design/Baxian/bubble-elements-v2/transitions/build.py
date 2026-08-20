#!/usr/bin/env python3
"""Build fixed-size web animation assets from the three ImageGen contact sheets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
CHARACTERS = {
    "lv-dongbin": {
        "name": "吕洞宾",
        "motion": "clockwise sword flourish → indigo whirlwind → diagonal seal snap",
    },
    "zhongli-quan": {
        "name": "钟离权",
        "motion": "weighted vase rock → cinnabar cloud → heavy seal landing",
    },
    "he-xiangu": {
        "name": "何仙姑",
        "motion": "douli updraft → lotus wind ring → light seal unfold",
    },
}
FRAME_SIZE = 256
DURATIONS_MS = [80, 60, 50, 45, 45, 45, 50, 50, 55, 55, 60, 65, 70, 80, 90, 150]


def split_sheet(sheet: Image.Image) -> list[Image.Image]:
    sheet = sheet.convert("RGBA")
    width, height = sheet.size
    frames: list[Image.Image] = []
    for row in range(4):
        for column in range(4):
            left = round(column * width / 4)
            top = round(row * height / 4)
            right = round((column + 1) * width / 4)
            bottom = round((row + 1) * height / 4)
            frame = sheet.crop((left, top, right, bottom))
            frame.thumbnail((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
            canvas.alpha_composite(frame, ((FRAME_SIZE - frame.width) // 2, (FRAME_SIZE - frame.height) // 2))
            frames.append(canvas)
    return frames


def build(character_id: str, metadata: dict[str, str]) -> None:
    directory = ROOT / character_id
    frames_directory = directory / "frames"
    frames_directory.mkdir(parents=True, exist_ok=True)
    frames = split_sheet(Image.open(directory / "source" / "imagegen-sheet.png"))

    for index, frame in enumerate(frames, start=1):
        frame.save(frames_directory / f"frame-{index:02d}.png", optimize=True)

    sheet = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE * 4))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((index % 4) * FRAME_SIZE, (index // 4) * FRAME_SIZE))
    sheet.save(directory / "spritesheet.png", optimize=True)

    frames[0].save(
        directory / "animation.webp",
        save_all=True,
        append_images=frames[1:],
        duration=DURATIONS_MS,
        loop=0,
        lossless=True,
        method=6,
    )

    manifest = {
        "id": character_id,
        "name": metadata["name"],
        "motion": metadata["motion"],
        "frameCount": len(frames),
        "frameWidth": FRAME_SIZE,
        "frameHeight": FRAME_SIZE,
        "sheetColumns": 4,
        "sheetRows": 4,
        "durationsMs": DURATIONS_MS,
        "totalDurationMs": sum(DURATIONS_MS),
        "recommendedIterations": 1,
        "holdLastFrame": True,
        "source": "ImageGen 4x4 transformation sheet",
    }
    (directory / "animation.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    for character, details in CHARACTERS.items():
        build(character, details)
