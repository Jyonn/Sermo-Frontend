from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image

from build_restrained_animations import crop_grid, normalize, smoothstep


ROOT = Path(__file__).parent
CELL = (256, 256)
FRAME_COUNT = 48
KEY_POSITIONS = [0, 7, 14, 21, 28, 35, 42, 47]
DURATIONS = [42 if index % 3 != 2 else 41 for index in range(FRAME_COUNT)]
GIF_DURATIONS = [50 if index % 6 == 5 else 40 for index in range(FRAME_COUNT)]

CHARACTERS = {
    "LvDongbin": {
        "id": "baxian-lv-dongbin-articulated-48-v3",
        "anchor": "top-right",
        "phases": [
            ["grip-and-peek", 0, 13],
            ["draw-and-sword-salute", 14, 28],
            ["sheathe-and-nod", 29, 35],
            ["retreat", 36, 47],
        ],
    },
    "ZhongliQuan": {
        "id": "baxian-zhongli-quan-articulated-48-v3",
        "anchor": "bottom-left",
        "phases": [
            ["rise", 0, 13],
            ["prepare-ingot", 14, 21],
            ["toss-catch-and-shrug", 22, 35],
            ["sink", 36, 47],
        ],
    },
    "HeXiangu": {
        "id": "baxian-he-xiangu-articulated-48-v3",
        "anchor": "top-left",
        "phases": [
            ["sleeve-and-hand-entry", 0, 13],
            ["short-glide", 14, 21],
            ["salute-and-turn", 22, 35],
            ["sleeve-follow-through", 36, 47],
        ],
    },
}


def rgba_for_flow(frame: Image.Image):
    rgba = np.asarray(frame, dtype=np.uint8)
    alpha = rgba[..., 3:4].astype(np.float32) / 255.0
    # A neutral backing gives optical flow texture at antialiased edges without
    # allowing fully transparent RGB garbage to influence the motion field.
    rgb = rgba[..., :3].astype(np.float32) * alpha + 48.0 * (1.0 - alpha)
    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    return rgba, gray


def dense_flow(source_gray, target_gray):
    return cv2.calcOpticalFlowFarneback(
        source_gray,
        target_gray,
        None,
        pyr_scale=0.5,
        levels=5,
        winsize=31,
        iterations=7,
        poly_n=7,
        poly_sigma=1.5,
        flags=cv2.OPTFLOW_FARNEBACK_GAUSSIAN,
    )


def warp(image, flow, amount):
    height, width = image.shape[:2]
    grid_x, grid_y = np.meshgrid(np.arange(width), np.arange(height))
    map_x = (grid_x - flow[..., 0] * amount).astype(np.float32)
    map_y = (grid_y - flow[..., 1] * amount).astype(np.float32)
    return cv2.remap(
        image,
        map_x,
        map_y,
        interpolation=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )


def premultiplied_mix(first, second, amount):
    first_f = first.astype(np.float32) / 255.0
    second_f = second.astype(np.float32) / 255.0
    alpha_a = first_f[..., 3:4]
    alpha_b = second_f[..., 3:4]
    color_a = first_f[..., :3] * alpha_a
    color_b = second_f[..., :3] * alpha_b
    alpha = alpha_a * (1.0 - amount) + alpha_b * amount
    color = color_a * (1.0 - amount) + color_b * amount
    rgb = np.divide(color, np.maximum(alpha, 1e-6), out=np.zeros_like(color), where=alpha > 1e-6)
    output = np.concatenate((rgb, alpha), axis=2)
    return np.clip(output * 255.0, 0, 255).astype(np.uint8)


def morph_sequence(keyposes):
    prepared = [rgba_for_flow(frame) for frame in keyposes]
    pairs = []
    for index in range(len(keyposes) - 1):
        rgba_a, gray_a = prepared[index]
        rgba_b, gray_b = prepared[index + 1]
        pairs.append((rgba_a, rgba_b, dense_flow(gray_a, gray_b), dense_flow(gray_b, gray_a)))

    frames = []
    for frame_index in range(FRAME_COUNT):
        if frame_index == KEY_POSITIONS[-1]:
            frames.append(keyposes[-1])
            continue
        segment = next(
            index for index in range(len(KEY_POSITIONS) - 1)
            if KEY_POSITIONS[index] <= frame_index < KEY_POSITIONS[index + 1]
        )
        start, end = KEY_POSITIONS[segment], KEY_POSITIONS[segment + 1]
        amount = smoothstep((frame_index - start) / (end - start))
        rgba_a, rgba_b, forward, backward = pairs[segment]
        warped_a = warp(rgba_a, forward, amount)
        warped_b = warp(rgba_b, backward, 1.0 - amount)
        frames.append(Image.fromarray(premultiplied_mix(warped_a, warped_b, amount), "RGBA"))
    return frames


def build(name, config):
    folder = ROOT / name / "restrained-48-v3"
    source = Image.open(folder / "source/keyposes.png").convert("RGBA")
    keyposes = normalize(crop_grid(source, 4, 2))
    frames = morph_sequence(keyposes)

    frame_folder = folder / "frames"
    frame_folder.mkdir(exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        frame.save(frame_folder / f"frame-{index:02d}.png")

    columns, rows = 8, 6
    sheet = Image.new("RGBA", (CELL[0] * columns, CELL[1] * rows))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((index % columns) * CELL[0], (index // columns) * CELL[1]))
    sheet.save(folder / "spritesheet-48.png")

    frames[0].save(
        folder / "animation-48.webp",
        save_all=True,
        append_images=frames[1:],
        duration=DURATIONS,
        loop=1,
        lossless=True,
        method=6,
    )
    frames[0].save(
        folder / "preview-48.gif",
        save_all=True,
        append_images=frames[1:],
        duration=GIF_DURATIONS,
        loop=0,
        disposal=2,
        optimize=False,
    )

    manifest = {
        "id": config["id"],
        "spriteVersionNumber": 4,
        "motionDesign": "eight-articulated-keyposes-with-bidirectional-dense-optical-flow",
        "frameWidth": CELL[0],
        "frameHeight": CELL[1],
        "frameCount": FRAME_COUNT,
        "fps": 24,
        "durationMs": 2000,
        "durationsMs": DURATIONS,
        "keyframes": KEY_POSITIONS,
        "sheetColumns": columns,
        "sheetRows": rows,
        "rowMajor": True,
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
        "phases": [
            {"name": phase, "frames": [start, end]}
            for phase, start, end in config["phases"]
        ],
        "reducedMotion": {"autoplay": False, "fallbackFrame": 21},
    }
    (folder / "animation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    assert sum(DURATIONS) == 2000
    assert sum(GIF_DURATIONS) == 2000
    for character_name, character_config in CHARACTERS.items():
        build(character_name, character_config)
