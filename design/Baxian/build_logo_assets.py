from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).parent / "shared-logo"
SOURCE = ROOT / "source" / "imagegen-gold-logo.png"


def extract_logo(source: Image.Image) -> Image.Image:
    rgb = source.convert("RGB")
    alpha = Image.new("L", rgb.size)
    source_pixels = rgb.load()
    alpha_pixels = alpha.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            red, green, blue = source_pixels[x, y]
            saturation = max(red, green, blue) - min(red, green, blue)
            warmth = red - blue
            score = max(saturation - 8, warmth - 5)
            alpha_pixels[x, y] = max(0, min(255, score * 9))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("No gold logo pixels detected")
    padding = 20
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(rgba.width, bbox[2] + padding)
    bottom = min(rgba.height, bbox[3] + padding)
    return rgba.crop((left, top, right, bottom))


def contain(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height))
    canvas.alpha_composite(copy, ((width - copy.width) // 2, (height - copy.height) // 2))
    return canvas


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    logo = extract_logo(Image.open(SOURCE))
    logo.save(ROOT / "baxian-logo-gold.png")
    contain(logo, 512, 256).save(ROOT / "baxian-logo-gold-512.png")
    contain(logo, 144, 72).save(ROOT / "baxian-logo-gold-72.png")

    flat = Image.new("RGBA", logo.size, (210, 151, 52, 0))
    flat.putalpha(logo.getchannel("A"))
    flat.save(ROOT / "baxian-logo-flat-gold.png")


if __name__ == "__main__":
    main()
