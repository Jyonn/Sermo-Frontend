from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).parent
CELL = 256
GRID = (6, 4)

CHARACTERS = {
    "LvDongbin": {
        "asset": "lv-dongbin",
        "duration": 4000,
        "anchor": "avatar-edge",
        "phases": [["peek-and-rise", 0, 11], ["draw-sword", 12, 23], ["flourish-and-salute", 24, 40], ["sheathe-and-retreat", 41, 47]],
    },
    "ZhongliQuan": {
        "asset": "zhongli-quan",
        "duration": 4500,
        "anchor": "avatar-edge",
        "phases": [["rakish-rise-and-swagger", 0, 11], ["token-play-and-prepare", 12, 23], ["token-toss-and-catch", 24, 38], ["chin-salute-and-retreat", 39, 47]],
    },
    "HeXiangu": {
        "asset": "he-xiangu",
        "duration": 3750,
        "anchor": "avatar-edge",
        "phases": [["sleeve-entry-and-launch", 0, 15], ["flight-and-brake", 16, 31], ["warrior-salute", 32, 36], ["land-and-retreat", 37, 47]],
    },
}

PUBLIC_ASSET_ROOT = ROOT.parent.parent / "public" / "assets" / "baxian"


def durations(total):
    base, extra = divmod(total, 48)
    return [base + (index < extra) for index in range(48)]


def clear_generation_guides(image):
    """Remove thin framing guides left by generated sprite source sheets."""
    pixels = image.load()
    width, height = image.size

    def is_guide_color(color):
        red, green, blue, alpha = color
        if alpha == 0:
            return False
        magenta = red > 205 and blue > 205 and green < 190 and abs(red - blue) < 58
        cyan = green > 205 and blue > 205 and red < 150 and abs(green - blue) < 48
        return magenta or cyan

    def clear_colored_guides(horizontal):
        """Clear straight chroma-guide segments without touching curved costume edges."""
        primary_size = height if horizontal else width
        secondary_size = width if horizontal else height
        minimum_run = 7
        clear_points = set()
        for primary in range(primary_size):
            start = None
            last_guide = None
            for secondary in range(secondary_size + 1):
                if secondary < secondary_size:
                    x, y = (secondary, primary) if horizontal else (primary, secondary)
                    guide = is_guide_color(pixels[x, y])
                else:
                    guide = False
                if guide:
                    if start is None:
                        start = secondary
                    last_guide = secondary
                    continue
                if start is not None and last_guide is not None and secondary - last_guide <= 2:
                    continue
                if start is not None and last_guide is not None and last_guide - start + 1 >= minimum_run:
                    for position in range(start, last_guide + 1):
                        x, y = (position, primary) if horizontal else (primary, position)
                        if is_guide_color(pixels[x, y]):
                            clear_points.add((x, y))
                start = None
                last_guide = None

        # Include antialiasing immediately around a detected guide, but only when it
        # retains the same chroma-key hue. This avoids clipping swords and sleeves.
        expanded = set(clear_points)
        for x, y in clear_points:
            for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= next_x < width and 0 <= next_y < height and is_guide_color(pixels[next_x, next_y]):
                    expanded.add((next_x, next_y))
        for x, y in expanded:
            red, green, blue, _ = pixels[x, y]
            pixels[x, y] = (red, green, blue, 0)

    clear_colored_guides(horizontal=True)
    clear_colored_guides(horizontal=False)

    def clear_long_runs(horizontal):
        primary_size = height if horizontal else width
        secondary_size = width if horizontal else height
        minimum_run = round(secondary_size * 0.3)
        runs = []
        for primary in range(primary_size):
            start = None
            previous_color = None
            for secondary in range(secondary_size + 1):
                if secondary < secondary_size:
                    x, y = (secondary, primary) if horizontal else (primary, secondary)
                    color = pixels[x, y]
                    visible = color[3] > 0
                    color_delta = (
                        sum(abs(channel - previous_channel) for channel, previous_channel in zip(color[:3], previous_color[:3]))
                        if previous_color is not None
                        else 0
                    )
                else:
                    visible = False
                    color = None
                    color_delta = 0
                continues_guide = visible and (start is None or color_delta < 12)
                if continues_guide and start is None:
                    start = secondary
                elif not continues_guide and start is not None:
                    if secondary - start >= minimum_run:
                        runs.append((primary, start, secondary))
                    start = secondary if visible else None
                previous_color = color if visible else None

        for primary, start, end in runs:
            for secondary in range(start, end):
                x, y = (secondary, primary) if horizontal else (primary, secondary)
                red, green, blue, _ = pixels[x, y]
                pixels[x, y] = (red, green, blue, 0)

    clear_long_runs(horizontal=True)
    clear_long_runs(horizontal=False)

    alpha = image.getchannel("A")
    visited = bytearray(width * height)
    pixels_to_clear = []

    for start_y in range(height):
        for start_x in range(width):
            start = start_y * width + start_x
            if visited[start] or alpha.getpixel((start_x, start_y)) == 0:
                continue

            visited[start] = 1
            stack = [(start_x, start_y)]
            component = []
            min_x = max_x = start_x
            min_y = max_y = start_y
            while stack:
                x, y = stack.pop()
                component.append((x, y))
                min_x, max_x = min(min_x, x), max(max_x, x)
                min_y, max_y = min(min_y, y), max(max_y, y)
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    index = next_y * width + next_x
                    if visited[index] or alpha.getpixel((next_x, next_y)) == 0:
                        continue
                    visited[index] = 1
                    stack.append((next_x, next_y))

            component_width = max_x - min_x + 1
            component_height = max_y - min_y + 1
            fill_ratio = len(component) / (component_width * component_height)
            spans_frame = component_width >= width * 0.45 or component_height >= height * 0.45
            if (spans_frame and fill_ratio < 0.09) or len(component) <= 4:
                pixels_to_clear.extend(component)

    for x, y in pixels_to_clear:
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
    return image


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
    slot = clear_generation_guides(slot)
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

    PUBLIC_ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    sprite.save(PUBLIC_ASSET_ROOT / f"{config['asset']}-48-v4-sheet.webp", quality=90, method=6)
    frames[0].save(
        PUBLIC_ASSET_ROOT / f"{config['asset']}-48-v4.webp",
        save_all=True,
        append_images=frames[1:],
        duration=timing,
        loop=1,
        lossless=True,
        method=6,
    )


if __name__ == "__main__":
    for character, character_config in CHARACTERS.items():
        build(character, character_config)
