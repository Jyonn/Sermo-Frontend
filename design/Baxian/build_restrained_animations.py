from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).parent
CELL = (256, 256)
GRID = (4, 3)

CHARACTERS = {
    "LvDongbin": {
        "id": "baxian-lv-dongbin-bubble-corner-greeting",
        "anchor": "top-right",
        "durations": [90, 80, 80, 85, 80, 75, 70, 90, 100, 90, 100, 160],
        "phases": [["peek", 0, 2], ["emerge", 3, 5], ["sword-greeting", 6, 8], ["retreat", 9, 11]],
    },
    "ZhongliQuan": {
        "id": "baxian-zhongli-quan-bubble-corner-greeting",
        "anchor": "bottom-left",
        "durations": [100, 90, 90, 100, 90, 90, 100, 120, 100, 110, 110, 170],
        "phases": [["rise", 0, 2], ["swagger", 3, 5], ["ingot-toss", 6, 8], ["shrug-and-sink", 9, 11]],
    },
    "HeXiangu": {
        "id": "baxian-he-xiangu-bubble-edge-greeting",
        "anchor": "top-left",
        "durations": [70, 70, 75, 75, 70, 70, 80, 95, 90, 80, 80, 140],
        "phases": [["sleeve-entry", 0, 2], ["short-glide", 3, 5], ["salute", 6, 8], ["sleeve-exit", 9, 11]],
    },
}


def crop_cells(sheet: Image.Image):
    frames = []
    for row in range(GRID[1]):
        y0 = round(row * sheet.height / GRID[1])
        y1 = round((row + 1) * sheet.height / GRID[1])
        for column in range(GRID[0]):
            x0 = round(column * sheet.width / GRID[0])
            x1 = round((column + 1) * sheet.width / GRID[0])
            slot = sheet.crop((x0, y0, x1, y1))
            bbox = slot.getchannel("A").getbbox()
            if not bbox:
                raise RuntimeError(f"Empty source cell at row {row}, column {column}")
            frames.append(slot.crop(bbox))
    return frames


def normalize(crops):
    max_width = max(frame.width for frame in crops)
    max_height = max(frame.height for frame in crops)
    scale = min(244 / max_width, 244 / max_height)
    output = []
    for crop in crops:
        resized = crop.resize(
            (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
            Image.Resampling.LANCZOS,
        )
        frame = Image.new("RGBA", CELL)
        frame.alpha_composite(resized, ((CELL[0] - resized.width) // 2, (CELL[1] - resized.height) // 2))
        output.append(frame)
    return output


def build(name, config):
    folder = ROOT / name / "restrained-12"
    sheet = Image.open(folder / "source/contact-sheet.png").convert("RGBA")
    frames = normalize(crop_cells(sheet))
    frame_folder = folder / "frames"
    frame_folder.mkdir(exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        frame.save(frame_folder / f"frame-{index:02d}.png")

    sprite = Image.new("RGBA", (CELL[0] * GRID[0], CELL[1] * GRID[1]))
    for index, frame in enumerate(frames):
        sprite.alpha_composite(frame, ((index % GRID[0]) * CELL[0], (index // GRID[0]) * CELL[1]))
    sprite.save(folder / "spritesheet-12.png")

    frames[0].save(
        folder / "animation-12.webp", save_all=True, append_images=frames[1:],
        duration=config["durations"], loop=1, lossless=True, method=6,
    )
    frames[0].save(
        folder / "preview-12.gif", save_all=True, append_images=frames[1:],
        duration=config["durations"], loop=0, disposal=2,
    )

    manifest = {
        "id": config["id"],
        "spriteVersionNumber": 2,
        "frameWidth": CELL[0],
        "frameHeight": CELL[1],
        "frameCount": 12,
        "sheetColumns": GRID[0],
        "sheetRows": GRID[1],
        "rowMajor": True,
        "durationsMs": config["durations"],
        "durationMs": sum(config["durations"]),
        "playback": "once",
        "autoplayTrigger": "new-message-visible",
        "replayTrigger": "character-tap",
        "hideAfterComplete": True,
        "anchor": config["anchor"],
        "recommendedDisplayPx": {"mobile": 64, "desktop": 72},
        "contentOverlapAllowed": False,
        "spritesheet": "spritesheet-12.png",
        "animatedWebP": "animation-12.webp",
        "framesPath": "frames/frame-{01..12}.png",
        "phases": [
            {"name": phase, "frames": [start, end]}
            for phase, start, end in config["phases"]
        ],
        "reducedMotion": {"autoplay": False, "fallbackFrame": 0},
    }
    (folder / "animation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    for character, character_config in CHARACTERS.items():
        build(character, character_config)
