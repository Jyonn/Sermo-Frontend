from pathlib import Path
from collections import deque
import json
from PIL import Image

ROOT = Path(__file__).parent
CELL = (256, 256)

CHARACTERS = {
    "LvDongbin": {
        "id": "baxian-lv-dongbin-border-action",
        "alignment": "center",
        "durations": [120] * 6 + [85] * 6 + [90] * 6 + [100, 100, 110, 130, 150, 240],
        "phases": [
            {"name": "vertical-climb", "frames": [0, 5]},
            {"name": "wall-vault-and-draw", "frames": [6, 11]},
            {"name": "airborne-sword-dance", "frames": [12, 17]},
            {"name": "land-and-sheathe", "frames": [18, 23]},
        ],
        "placement": {
            "path": "right-vertical-edge-to-top-corner",
            "repeatPolicy": "none",
            "recommendedDisplayPxAtBubbleWidth320": 104,
            "note": "Use app-side x/y offsets for upward climb and vault; images contain pose changes only.",
        },
    },
    "ZhongliQuan": {
        "id": "baxian-zhongli-quan-border-action",
        "alignment": "bottom",
        "durations": [130] * 23 + [190],
        "phases": [
            {"name": "loose-start-and-toss", "frames": [0, 5]},
            {"name": "behind-back-transfer", "frames": [6, 11]},
            {"name": "knuckle-and-elbow-play", "frames": [12, 17]},
            {"name": "catch-stow-and-exit", "frames": [18, 23]},
        ],
        "placement": {
            "path": "horizontal-top-edge",
            "repeatPolicy": "none",
            "recommendedDisplayPxAtBubbleWidth320": 112,
            "note": "Translate horizontally in app code; each image is a unique walk/object-play pose.",
        },
    },
    "HeXiangu": {
        "id": "baxian-he-xiangu-border-action",
        "alignment": "center",
        "durations": [100] * 6 + [80] * 6 + [85] * 6 + [90, 100, 110, 130, 160, 220],
        "phases": [
            {"name": "launch", "frames": [0, 5]},
            {"name": "flight-transitions", "frames": [6, 11]},
            {"name": "bank-roll-and-brake", "frames": [12, 17]},
            {"name": "landing", "frames": [18, 23]},
        ],
        "placement": {
            "path": "horizontal-left-to-right",
            "repeatPolicy": "external-adaptive",
            "repeatableCruiseRange": [6, 11],
            "recommendedDisplayPxAtBubbleWidth320": 98,
            "note": "All 24 source poses are unique. The app may repeat or ping-pong frames 6–11 to fit bubble width.",
        },
    },
}


def split_strip(path: Path, count: int = 6):
    image = Image.open(path).convert("RGBA")
    factor = 4
    thumb = image.getchannel("A").resize(
        (max(1, image.width // factor), max(1, image.height // factor)),
        Image.Resampling.NEAREST,
    )
    width, height = thumb.size
    pixels = thumb.load()
    visited = bytearray(width * height)
    components = []
    for y in range(height):
        for x in range(width):
            pos = y * width + x
            if visited[pos] or pixels[x, y] <= 128:
                continue
            queue = deque([(x, y)])
            visited[pos] = 1
            area = 0
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cx, cy = queue.popleft()
                area += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for nx, ny in ((cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1),
                               (cx-1, cy-1), (cx+1, cy-1), (cx-1, cy+1), (cx+1, cy+1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        npos = ny * width + nx
                        if not visited[npos] and pixels[nx, ny] > 128:
                            visited[npos] = 1
                            queue.append((nx, ny))
            if area >= 4:
                components.append({"area": area, "bbox": [min_x, min_y, max_x + 1, max_y + 1]})

    bodies = sorted(components, key=lambda item: item["area"], reverse=True)[:count]
    if len(bodies) != count:
        raise RuntimeError(f"{path}: expected {count} major pose components, found {len(bodies)}")
    # Attach detached props (ingots/swords) to the nearest body by horizontal center.
    body_ids = {id(item) for item in bodies}
    for component in components:
        if id(component) in body_ids or component["area"] < 6:
            continue
        cx = (component["bbox"][0] + component["bbox"][2]) / 2
        target = min(bodies, key=lambda item: abs(cx - (item["bbox"][0] + item["bbox"][2]) / 2))
        if abs(cx - (target["bbox"][0] + target["bbox"][2]) / 2) < width / count * 0.62:
            target["bbox"] = [
                min(target["bbox"][0], component["bbox"][0]),
                min(target["bbox"][1], component["bbox"][1]),
                max(target["bbox"][2], component["bbox"][2]),
                max(target["bbox"][3], component["bbox"][3]),
            ]
    regions = sorted(bodies, key=lambda item: (item["bbox"][0] + item["bbox"][2]) / 2)
    frames = []
    for index, component in enumerate(regions):
        x0, y0, x1, y1 = component["bbox"]
        pad = 4
        slot = image.crop((max(0, x0 * factor - pad), max(0, y0 * factor - pad),
                           min(image.width, x1 * factor + pad), min(image.height, y1 * factor + pad)))
        bbox = slot.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"empty frame {index} in {path}")
        frames.append(slot.crop(bbox))
    return frames


def normalize(crops, alignment):
    scale = min(244 / max(c.width for c in crops), 244 / max(c.height for c in crops))
    frames = []
    for crop in crops:
        resized = crop.resize(
            (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
            Image.Resampling.LANCZOS,
        )
        frame = Image.new("RGBA", CELL)
        x = (CELL[0] - resized.width) // 2
        y = CELL[1] - resized.height - 6 if alignment == "bottom" else (CELL[1] - resized.height) // 2
        frame.alpha_composite(resized, (x, y))
        frames.append(clean_detached_fragments(frame))
    return frames


def clean_detached_fragments(frame):
    """Drop distant neighbor fragments while preserving nearby held props."""
    alpha = frame.getchannel("A")
    pixels = alpha.load()
    width, height = frame.size
    visited = bytearray(width * height)
    components = []
    for y in range(height):
        for x in range(width):
            pos = y * width + x
            if visited[pos] or pixels[x, y] <= 128:
                continue
            queue = deque([(x, y)])
            visited[pos] = 1
            members = []
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cx, cy = queue.popleft()
                members.append((cx, cy))
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for nx, ny in ((cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1),
                               (cx-1, cy-1), (cx+1, cy-1), (cx-1, cy+1), (cx+1, cy+1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        npos = ny * width + nx
                        if not visited[npos] and pixels[nx, ny] > 128:
                            visited[npos] = 1
                            queue.append((nx, ny))
            components.append({"members": members, "bbox": (min_x, min_y, max_x, max_y)})
    if not components:
        return frame
    main = max(components, key=lambda item: len(item["members"]))
    mx0, my0, mx1, my1 = main["bbox"]
    keep = {id(main)}
    for component in components:
        if component is main or len(component["members"]) < 4:
            continue
        x0, y0, x1, y1 = component["bbox"]
        gap_x = max(mx0 - x1 - 1, x0 - mx1 - 1, 0)
        gap_y = max(my0 - y1 - 1, y0 - my1 - 1, 0)
        if gap_x * gap_x + gap_y * gap_y <= 24 * 24:
            keep.add(id(component))
    cleaned = frame.copy()
    clean_alpha = cleaned.getchannel("A")
    alpha_pixels = clean_alpha.load()
    for component in components:
        if id(component) in keep:
            continue
        x0, y0, x1, y1 = component["bbox"]
        for y in range(max(0, y0 - 3), min(height, y1 + 4)):
            for x in range(max(0, x0 - 3), min(width, x1 + 4)):
                alpha_pixels[x, y] = 0
    cleaned.putalpha(clean_alpha)
    return cleaned


def build(name, config):
    folder = ROOT / name
    crops = []
    for part in range(1, 5):
        crops.extend(split_strip(folder / f"source/part-{part:02d}.png"))
    if len(crops) != 24:
        raise RuntimeError(f"{name}: expected 24 crops, got {len(crops)}")
    frames = normalize(crops, config["alignment"])
    frame_dir = folder / "frames"
    frame_dir.mkdir(exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(frame_dir / f"frame-{index + 1:02d}.png")

    sheet = Image.new("RGBA", (CELL[0] * 6, CELL[1] * 4))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((index % 6) * CELL[0], (index // 6) * CELL[1]))
    sheet.save(folder / "spritesheet-24.png")

    frames[0].save(
        folder / "animation-24.webp",
        save_all=True,
        append_images=frames[1:],
        duration=config["durations"],
        loop=0,
        lossless=True,
        method=6,
    )
    frames[0].save(
        folder / "preview-24.gif",
        save_all=True,
        append_images=frames[1:],
        duration=config["durations"],
        loop=0,
        disposal=2,
        transparency=0,
    )

    output = {
        "id": config["id"],
        "spriteVersionNumber": 2,
        "frameWidth": CELL[0],
        "frameHeight": CELL[1],
        "frameCount": 24,
        "sheetColumns": 6,
        "sheetRows": 4,
        "rowMajor": True,
        "durationsMs": config["durations"],
        "playback": "once",
        "hideAfterComplete": True,
        "spritesheet": "spritesheet-24.png",
        "animatedWebP": "animation-24.webp",
        "phases": config["phases"],
        "placement": config["placement"],
    }
    (folder / "animation.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    for character_name, character_config in CHARACTERS.items():
        build(character_name, character_config)
