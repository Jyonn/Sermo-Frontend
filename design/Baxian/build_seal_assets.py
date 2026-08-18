from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).parent / "shared-seals"
NAMES = ("lv-dongbin-blue", "zhongli-quan-red", "he-xiangu-pink")


def extract(source: Image.Image) -> Image.Image:
    rgb = source.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    background = bytearray(width * height)
    queue = deque()

    def candidate(x, y):
        red, green, blue = pixels[x, y]
        return min(red, green, blue) > 222 and max(red, green, blue) - min(red, green, blue) < 18

    def add(x, y):
        index = y * width + x
        if not background[index] and candidate(x, y):
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)
    while queue:
        x, y = queue.popleft()
        if x: add(x - 1, y)
        if x + 1 < width: add(x + 1, y)
        if y: add(x, y - 1)
        if y + 1 < height: add(x, y + 1)

    alpha = Image.new("L", rgb.size, 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if background[y * width + x]:
                alpha_pixels[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.55))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("No seal found")
    pad = 12
    return rgba.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(width, bbox[2] + pad), min(height, bbox[3] + pad)))


def contain(image, width, height):
    copy = image.copy()
    copy.thumbnail((width - 8, height - 8), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height))
    canvas.alpha_composite(copy, ((width - copy.width) // 2, (height - copy.height) // 2))
    return canvas


def main():
    for name in NAMES:
        seal = extract(Image.open(ROOT / "source" / f"{name}-imagegen.png"))
        seal.save(ROOT / f"{name}-seal.png")
        contain(seal, 192, 288).save(ROOT / f"{name}-seal-288.png")
        contain(seal, 64, 96).save(ROOT / f"{name}-seal-96.png")


if __name__ == "__main__":
    main()
