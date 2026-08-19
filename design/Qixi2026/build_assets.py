from pathlib import Path

from PIL import Image


ROOT = Path(__file__).parent
SOURCE = ROOT / "source"
ASSETS = ROOT / "assets"


def trim(image: Image.Image, padding: int = 12) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("transparent source has no visible pixels")
    left, top, right, bottom = bbox
    return image.crop((max(0, left - padding), max(0, top - padding), min(image.width, right + padding), min(image.height, bottom + padding)))


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return canvas


def save_webp(image: Image.Image, name: str, *, quality: int = 88):
    image.save(ASSETS / name, "WEBP", quality=quality, method=6)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)

    header = trim(Image.open(SOURCE / "header-milky-way.png"))
    contain(header, (1600, 240)).save(ASSETS / "qixi-header-ribbon.png")
    save_webp(contain(header, (1600, 240)), "qixi-header-ribbon.webp")

    tab = trim(Image.open(SOURCE / "tab-feather-underline.png"))
    contain(tab, (320, 64)).save(ASSETS / "qixi-tab-underline.png")
    save_webp(contain(tab, (320, 64)), "qixi-tab-underline.webp")

    corner = trim(Image.open(SOURCE / "corner-magpies.png"))
    contain(corner, (512, 384)).save(ASSETS / "qixi-corner-magpies.png")
    save_webp(contain(corner, (512, 384)), "qixi-corner-magpies.webp")

    medallion = trim(Image.open(SOURCE / "moon-medallion.png"))
    contain(medallion, (256, 256)).save(ASSETS / "qixi-moon-medallion.png")
    contain(medallion, (72, 72)).save(ASSETS / "qixi-moon-medallion-72.png")
    save_webp(contain(medallion, (256, 256)), "qixi-moon-medallion.webp")

    for mode in ("light", "dark"):
        texture = Image.open(SOURCE / f"background-{mode}.png").convert("RGB")
        texture = texture.resize((768, 768), Image.Resampling.LANCZOS)
        save_webp(texture, f"qixi-background-{mode}.webp", quality=82)


if __name__ == "__main__":
    main()
