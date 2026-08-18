from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).parent
CELL = 256
GRID = (6, 4)

CHARACTERS = {
    "LvDongbin": {
        "duration": 4000,
        "anchor": "avatar-edge",
        "phases": [["peek-and-rise", 0, 11], ["draw-sword", 12, 23], ["flourish-and-salute", 24, 40], ["sheathe-and-retreat", 41, 47]],
    },
    "ZhongliQuan": {
        "duration": 4500,
        "anchor": "avatar-edge",
        "phases": [["heavy-rise", 0, 11], ["inspect-and-prepare", 12, 23], ["toss-and-catch", 24, 38], ["shrug-and-retreat", 39, 47]],
    },
    "HeXiangu": {
        "duration": 3750,
        "anchor": "avatar-edge",
        "phases": [["sleeve-entry-and-launch", 0, 15], ["flight-and-brake", 16, 31], ["warrior-salute", 32, 36], ["land-and-retreat", 37, 47]],
    },
}


def durations(total):
    base, extra = divmod(total, 48)
    return [base + (index < extra) for index in range(48)]


def transparent_slot(sheet, column, row):
    x0 = round(column * sheet.width / GRID[0])
    x1 = round((column + 1) * sheet.width / GRID[0])
    y0 = round(row * sheet.height / GRID[1])
    y1 = round((row + 1) * sheet.height / GRID[1])
    slot = sheet.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4)).convert("RGBA")
    pixels = slot.load()
    for y in range(slot.height):
        for x in range(slot.width):
            red, green, blue, alpha = pixels[x, y]
            magenta_distance = abs(red - 255) + green + abs(blue - 255)
            if magenta_distance < 70:
                pixels[x, y] = (red, green, blue, 0)
            elif magenta_distance < 180 and red > green * 1.6 and blue > green * 1.6:
                pixels[x, y] = (red, green, blue, round(alpha * (magenta_distance - 70) / 110))
    bbox = slot.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (CELL, CELL))
    crop = slot.crop(bbox)
    scale = min(244 / crop.width, 244 / crop.height)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (CELL, CELL))
    frame.alpha_composite(crop, ((CELL - crop.width) // 2, CELL - crop.height - 6))
    return frame


def gif_durations(total):
    values = [total // 480 * 10] * 48
    remaining = total - sum(values)
    for index in range(remaining // 10):
        values[index] += 10
    return values


def build(name, config):
    folder = ROOT / name / "direct-imagegen-v4"
    source = folder / "source"
    sheets = [Image.open(source / f"part-{part:02d}-chroma.png") for part in (1, 2)]
    frames = []
    for sheet in sheets:
        for row in range(GRID[1]):
            for column in range(GRID[0]):
                frames.append(transparent_slot(sheet, column, row))
    assert len(frames) == 48

    frame_folder = folder / "frames"
    frame_folder.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames, 1):
        frame.save(frame_folder / f"frame-{index:02d}.png")

    sprite = Image.new("RGBA", (CELL * 8, CELL * 6))
    for index, frame in enumerate(frames):
        sprite.alpha_composite(frame, ((index % 8) * CELL, (index // 8) * CELL))
    sprite.save(folder / "spritesheet-48.png")

    timing = durations(config["duration"])
    frames[0].save(folder / "animation-48.webp", save_all=True, append_images=frames[1:], duration=timing, loop=1, lossless=True, method=6)
    frames[0].save(folder / "preview-48.gif", save_all=True, append_images=frames[1:], duration=gif_durations(config["duration"]), loop=0, disposal=2, optimize=False)

    manifest = {
        "id": f"baxian-{name.lower()}-direct-imagegen-v4",
        "spriteVersionNumber": 4,
        "frameCount": 48,
        "frameWidth": CELL,
        "frameHeight": CELL,
        "sheetColumns": 8,
        "sheetRows": 6,
        "durationsMs": timing,
        "durationMs": config["duration"],
        "playback": "once",
        "animationSource": "48 directly generated chronological ImageGen drawings; no optical-flow or transform interpolation",
        "pathMotion": "none; optional bubble-edge translation must be composed by the frontend",
        "anchor": config["anchor"],
        "recommendedDisplayPx": {"mobile": 72, "desktop": 80},
        "phases": [{"name": phase, "frames": [start, end]} for phase, start, end in config["phases"]],
        "spritesheet": "spritesheet-48.png",
        "animatedWebP": "animation-48.webp",
        "framesPath": "frames/frame-{01..48}.png",
        "reducedMotion": {"autoplay": False, "fallbackFrame": 11},
    }
    (folder / "animation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    for character, character_config in CHARACTERS.items():
        build(character, character_config)
