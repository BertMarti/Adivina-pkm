"""Generate the minimal pixel mark used by PokéQuién.

The mark is intentionally simple: a single question mark whose dot is a tiny
Poké Ball. It remains legible at launcher size and is enlarged with nearest
neighbour sampling for the game's pixel-art language.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
GRID = 128
SCALE = 8
BACKGROUND = "#10162C"
INK = "#080B17"
YELLOW = "#FFD629"
YELLOW_DARK = "#B88800"
RED = "#F04D55"
WHITE = "#F7F4E8"
CYAN = "#62D8E8"
FRAME = "#26365D"


def pixel_scale(image: Image.Image) -> Image.Image:
    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


def draw_question(draw: ImageDraw.ImageDraw) -> None:
    # A chunky question mark with a one-pixel-grid dark shadow. The shape is
    # deliberately wide enough to survive Android/iOS launcher downscaling.
    shadow = [
        (39, 24), (87, 24), (87, 29), (96, 29), (96, 55),
        (88, 55), (88, 64), (80, 64), (80, 72), (68, 72),
        (68, 88), (48, 88), (48, 72), (55, 72), (55, 64),
        (63, 64), (63, 56), (71, 56), (71, 48), (79, 48),
        (79, 40), (71, 40), (71, 36), (55, 36), (55, 40),
        (47, 40), (47, 48), (39, 48),
    ]
    draw.polygon(shadow, fill=INK)
    mark = [
        (36, 20), (84, 20), (84, 25), (92, 25), (92, 51),
        (84, 51), (84, 60), (76, 60), (76, 68), (64, 68),
        (64, 84), (44, 84), (44, 68), (52, 68), (52, 60),
        (60, 60), (60, 52), (68, 52), (68, 44), (76, 44),
        (76, 36), (68, 36), (68, 32), (52, 32), (52, 36),
        (44, 36), (44, 44), (36, 44),
    ]
    draw.polygon(mark, fill=YELLOW)
    draw.rectangle((52, 27, 67, 31), fill="#FFF18A")


def draw_mini_pokeball(draw: ImageDraw.ImageDraw) -> None:
    # The question mark's dot is a tiny, readable Poké Ball.
    cx, cy = 54, 103
    outline = [(cx - 8, cy - 8), (cx + 8, cy - 8), (cx + 12, cy - 4),
               (cx + 12, cy + 5), (cx + 7, cy + 10), (cx - 7, cy + 10),
               (cx - 12, cy + 5), (cx - 12, cy - 4)]
    draw.polygon(outline, fill=INK)
    draw.rectangle((cx - 8, cy - 6, cx + 8, cy), fill=RED)
    draw.rectangle((cx - 8, cy + 1, cx + 8, cy + 6), fill=WHITE)
    draw.rectangle((cx - 9, cy - 1, cx + 9, cy + 2), fill=INK)
    draw.rectangle((cx - 4, cy - 3, cx + 4, cy + 5), fill=INK)
    draw.rectangle((cx - 2, cy - 1, cx + 2, cy + 3), fill=CYAN)


def draw_mark(transparent: bool) -> Image.Image:
    mode = "RGBA" if transparent else "RGB"
    background = (0, 0, 0, 0) if transparent else BACKGROUND
    image = Image.new(mode, (GRID, GRID), background)
    draw = ImageDraw.Draw(image)

    if not transparent:
        # A quiet pixel frame gives the square icon structure without making
        # the adaptive foreground unsafe when Android applies its mask.
        draw.rectangle((9, 9, 118, 118), outline=FRAME, width=3)
        draw.rectangle((9, 9, 23, 12), fill=YELLOW_DARK)
        draw.rectangle((104, 115, 118, 118), fill=YELLOW_DARK)

    draw_question(draw)
    draw_mini_pokeball(draw)
    return pixel_scale(image)


def save_assets() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    full = draw_mark(False)
    foreground = draw_mark(True)
    alpha = foreground.getchannel("A")
    white_layer = Image.new("RGBA", foreground.size, WHITE)
    white_layer.putalpha(alpha)
    background = Image.new("RGB", full.size, BACKGROUND)

    full.save(ASSETS / "icon.png", optimize=True)
    full.save(ASSETS / "favicon.png", optimize=True)
    full.save(ASSETS / "splash-icon.png", optimize=True)
    foreground.save(ASSETS / "android-icon-foreground.png", optimize=True)
    white_layer.save(ASSETS / "android-icon-monochrome.png", optimize=True)
    background.save(ASSETS / "android-icon-background.png", optimize=True)
    print("Generated minimal PokéQuién icon assets in", ASSETS)


if __name__ == "__main__":
    save_assets()
