from pathlib import Path
import json
import math

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


def crop_grid(sheet: Image.Image, columns: int, rows: int):
    frames = []
    for row in range(rows):
        y0 = round(row * sheet.height / rows)
        y1 = round((row + 1) * sheet.height / rows)
        for column in range(columns):
            x0 = round(column * sheet.width / columns)
            x1 = round((column + 1) * sheet.width / columns)
            slot = sheet.crop((x0, y0, x1, y1))
            bbox = slot.getchannel("A").getbbox()
            if not bbox:
                raise RuntimeError(f"Empty source cell at row {row}, column {column}")
            frames.append(slot.crop(bbox))
    return frames


def crop_cells(sheet: Image.Image):
    return crop_grid(sheet, *GRID)


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


def build_24(name, config):
    source_folder = ROOT / name / "restrained-12"
    folder = ROOT / name / "restrained-24"
    folder.mkdir(exist_ok=True)

    keyframes = [
        Image.open(source_folder / f"frames/frame-{index:02d}.png").convert("RGBA")
        for index in range(1, 13)
    ]
    inbetween_sheet = Image.open(folder / "source/inbetweens.png").convert("RGBA")
    inbetweens = normalize(crop_cells(inbetween_sheet))

    frames = []
    durations = []
    for keyframe, inbetween, key_duration in zip(keyframes, inbetweens, config["durations"]):
        first_half = (key_duration + 1) // 2
        second_half = key_duration - first_half
        frames.extend((keyframe, inbetween))
        durations.extend((first_half, max(1, second_half)))

    frame_folder = folder / "frames"
    frame_folder.mkdir(exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        frame.save(frame_folder / f"frame-{index:02d}.png")

    columns, rows = 6, 4
    sprite = Image.new("RGBA", (CELL[0] * columns, CELL[1] * rows))
    for index, frame in enumerate(frames):
        sprite.alpha_composite(frame, ((index % columns) * CELL[0], (index // columns) * CELL[1]))
    sprite.save(folder / "spritesheet-24.png")

    frames[0].save(
        folder / "animation-24.webp", save_all=True, append_images=frames[1:],
        duration=durations, loop=1, lossless=True, method=6,
    )
    frames[0].save(
        folder / "preview-24.gif", save_all=True, append_images=frames[1:],
        duration=durations, loop=0, disposal=2,
    )

    manifest = {
        "id": config["id"].replace("greeting", "greeting-24"),
        "spriteVersionNumber": 2,
        "derivedFrom": "../restrained-12/animation.json",
        "frameWidth": CELL[0],
        "frameHeight": CELL[1],
        "frameCount": 24,
        "sheetColumns": columns,
        "sheetRows": rows,
        "rowMajor": True,
        "durationsMs": durations,
        "durationMs": sum(durations),
        "playback": "once",
        "autoplayTrigger": "new-message-visible",
        "replayTrigger": "character-tap",
        "hideAfterComplete": True,
        "anchor": config["anchor"],
        "recommendedDisplayPx": {"mobile": 64, "desktop": 72},
        "contentOverlapAllowed": False,
        "spritesheet": "spritesheet-24.png",
        "animatedWebP": "animation-24.webp",
        "framesPath": "frames/frame-{01..24}.png",
        "frameProvenance": {"oddFrames": "restrained-12 keyframes", "evenFrames": "ImageGen in-betweens"},
        "reducedMotion": {"autoplay": False, "fallbackFrame": 0},
    }
    (folder / "animation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


def smoothstep(value: float):
    return value * value * (3 - 2 * value)


def build_48_v2(name, config):
    """Build a ghost-free 24fps cutout animation from one canonical half-body pose."""
    folder = ROOT / name / "restrained-48-v2"
    sheet = Image.open(folder / "source/keyposes.png").convert("RGBA")
    keyposes = normalize(crop_grid(sheet, 4, 2))
    motion = {
        "LvDongbin": {"pose": 4, "axis": "x", "offscreen": 50, "rotation": -2.0},
        "ZhongliQuan": {"pose": 2, "axis": "y", "offscreen": 54, "rotation": 1.6},
        "HeXiangu": {"pose": 4, "axis": "x", "offscreen": -56, "rotation": -2.4},
    }[name]
    pose = keyposes[motion["pose"]]

    def transform_cutout(source, scale, rotation, offset_x, offset_y, opacity):
        width = max(1, round(CELL[0] * scale))
        height = max(1, round(CELL[1] * scale))
        transformed = source.resize((width, height), Image.Resampling.BICUBIC)
        canvas = Image.new("RGBA", CELL)
        canvas.alpha_composite(transformed, ((CELL[0] - width) // 2, (CELL[1] - height) // 2))
        canvas = canvas.rotate(rotation, resample=Image.Resampling.BICUBIC, center=(CELL[0] // 2, CELL[1] // 2))
        shifted = Image.new("RGBA", CELL)
        shifted.alpha_composite(canvas, (round(offset_x), round(offset_y)))
        if opacity < 1:
            alpha = shifted.getchannel("A").point(lambda value: round(value * opacity))
            shifted.putalpha(alpha)
        return shifted

    frames = []
    for frame_index in range(48):
        t = frame_index / 47
        if t < 0.25:
            visibility = smoothstep(t / 0.25)
        elif t < 0.72:
            visibility = 1.0
        else:
            visibility = 1 - smoothstep((t - 0.72) / 0.28)

        # Overshoot and follow-through are deliberately tiny at chat-bubble scale.
        settle = math.sin(min(1, t / 0.38) * math.pi) * (1 - min(1, t / 0.38))
        greeting = math.sin(max(0, min(1, (t - 0.28) / 0.42)) * math.pi)
        retreat = smoothstep(max(0, (t - 0.72) / 0.28))
        offset = motion["offscreen"] * (1 - visibility)
        offset_x = offset if motion["axis"] == "x" else 0
        offset_y = offset if motion["axis"] == "y" else 0
        offset_y += -1.2 * settle - 2.0 * greeting + 1.5 * retreat
        scale = 0.985 + 0.015 * visibility + 0.008 * greeting
        rotation = (
            motion["rotation"] * (1 - visibility)
            + 0.45 * settle
            - motion["rotation"] * 0.35 * greeting
        )
        frames.append(transform_cutout(pose, scale, rotation, offset_x, offset_y, visibility))

    # 32 × 42ms + 16 × 41ms = exactly 2000ms at an effective 24fps cadence.
    durations = [42 if index % 3 != 2 else 41 for index in range(48)]
    assert sum(durations) == 2000

    frame_folder = folder / "frames"
    frame_folder.mkdir(exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        frame.save(frame_folder / f"frame-{index:02d}.png")

    columns, rows = 8, 6
    sprite = Image.new("RGBA", (CELL[0] * columns, CELL[1] * rows))
    for index, frame in enumerate(frames):
        sprite.alpha_composite(frame, ((index % columns) * CELL[0], (index // columns) * CELL[1]))
    sprite.save(folder / "spritesheet-48.png")

    frames[0].save(
        folder / "animation-48.webp", save_all=True, append_images=frames[1:],
        duration=durations, loop=1, lossless=True, method=6,
    )
    frames[0].save(
        folder / "preview-48.gif", save_all=True, append_images=frames[1:],
        # GIF timing is quantized to 10ms: 40 × 40ms + 8 × 50ms = 2000ms.
        duration=[50 if index % 6 == 5 else 40 for index in range(48)],
        loop=0, disposal=2, optimize=False,
    )

    manifest = {
        "id": config["id"].replace("greeting", "greeting-48-v2"),
        "spriteVersionNumber": 3,
        "motionDesign": "single-canonical-half-body-cutout-with-deterministic-eased-transform",
        "frameWidth": CELL[0],
        "frameHeight": CELL[1],
        "frameCount": 48,
        "fps": 24,
        "sheetColumns": columns,
        "sheetRows": rows,
        "rowMajor": True,
        "durationsMs": durations,
        "durationMs": 2000,
        "sourcePoseIndex": motion["pose"],
        "easing": "smoothstep-with-subtle-overshoot-and-follow-through",
        "playback": "once",
        "autoplayTrigger": "new-message-visible",
        "replayTrigger": "character-tap",
        "hideAfterComplete": True,
        "anchor": config["anchor"],
        "recommendedDisplayPx": {"mobile": 64, "desktop": 72},
        "contentOverlapAllowed": False,
        "spritesheet": "spritesheet-48.png",
        "animatedWebP": "animation-48.webp",
        "framesPath": "frames/frame-{01..48}.png",
        "reducedMotion": {"autoplay": False, "fallbackFrame": 0},
    }
    (folder / "animation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    for character, character_config in CHARACTERS.items():
        build(character, character_config)
        inbetween_source = ROOT / character / "restrained-24/source/inbetweens.png"
        if inbetween_source.exists():
            build_24(character, character_config)
        keypose_source = ROOT / character / "restrained-48-v2/source/keyposes.png"
        if keypose_source.exists():
            build_48_v2(character, character_config)
