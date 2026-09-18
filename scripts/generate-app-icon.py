"""Generate the small pixel-art identity assets used by PokéQuién.

The artwork is deliberately drawn on a 128px pixel grid and enlarged with
nearest-neighbour sampling. That keeps the mark readable at launcher size and
lets Android adaptive icons use the same safe central emblem.
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
PURPLE = "#665DD6"


def pixel_scale(image: Image.Image) -> Image.Image:
    return image.resize((GRID * SCALE, GRID * SCALE), Image.Resampling.NEAREST)


def draw_lightning(draw: ImageDraw.ImageDraw, *, offset_x: int = 0, fill: str = YELLOW) -> None:
    outline = [(34 + offset_x, 93), (48 + offset_x, 70), (58 + offset_x, 70), (52 + offset_x, 82), (67 + offset_x, 82), (43 + offset_x, 108), (48 + offset_x, 91)]
    inner = [(36 + offset_x, 92), (49 + offset_x, 72), (56 + offset_x, 72), (50 + offset_x, 84), (63 + offset_x, 84), (44 + offset_x, 103), (47 + offset_x, 91)]
    draw.polygon(outline, fill=INK)
    draw.polygon(inner, fill=fill)


def draw_card(draw: ImageDraw.ImageDraw, x: int, color: str, eye_color: str) -> None:
    # Compact opposing profile cards, readable as two players at launcher size.
    draw.rectangle((x, 37, x + 24, 91), fill=INK)
    draw.rectangle((x + 3, 40, x + 21, 88), outline=color, width=3)
    draw.rectangle((x + 7, 57, x + 10, 61), fill=eye_color)
    draw.rectangle((x + 16, 57, x + 19, 61), fill=eye_color)
    draw.rectangle((x + 10, 69, x + 16, 72), fill=eye_color)
    draw.rectangle((x + 1, 48, x + 3, 77), fill=color)


def draw_pokeball(draw: ImageDraw.ImageDraw, cx: int = 64, cy: int = 64) -> None:
    outline = [(cx - 25, cy - 15), (cx - 20, cy - 22), (cx - 13, cy - 27), (cx + 13, cy - 27), (cx + 20, cy - 22), (cx + 25, cy - 15), (cx + 27, cy - 7), (cx + 27, cy + 10), (cx + 22, cy + 19), (cx + 14, cy + 26), (cx - 14, cy + 26), (cx - 22, cy + 19), (cx - 27, cy + 10), (cx - 27, cy - 7)]
    draw.polygon(outline, fill=INK)
    top = [(cx - 22, cy - 7), (cx - 19, cy - 16), (cx - 12, cy - 21), (cx + 12, cy - 21), (cx + 19, cy - 16), (cx + 22, cy - 7)]
    bottom = [(cx - 22, cy + 4), (cx + 22, cy + 4), (cx + 19, cy + 15), (cx + 12, cy + 21), (cx - 12, cy + 21), (cx - 19, cy + 15)]
    draw.polygon(top, fill=RED)
    draw.polygon(bottom, fill=WHITE)
    draw.rectangle((cx - 23, cy - 4, cx + 23, cy + 4), fill=INK)
    button_outline = [(cx - 11, cy - 6), (cx - 7, cy - 10), (cx + 7, cy - 10), (cx + 11, cy - 6), (cx + 11, cy + 6), (cx + 7, cy + 10), (cx - 7, cy + 10), (cx - 11, cy + 6)]
    button = [(cx - 7, cy - 4), (cx - 4, cy - 7), (cx + 4, cy - 7), (cx + 7, cy - 4), (cx + 7, cy + 4), (cx + 4, cy + 7), (cx - 4, cy + 7), (cx - 7, cy + 4)]
    draw.polygon(button_outline, fill=INK)
    draw.polygon(button, fill=WHITE)
    draw.rectangle((cx - 3, cy - 3, cx + 3, cy + 3), fill=CYAN)


def draw_question(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    draw.rectangle((x + 4, y, x + 12, y + 3), fill=color)
    draw.rectangle((x + 12, y + 3, x + 15, y + 13), fill=color)
    draw.rectangle((x + 4, y + 13, x + 12, y + 16), fill=color)
    draw.rectangle((x + 4, y + 16, x + 8, y + 24), fill=color)
    draw.rectangle((x + 4, y + 28, x + 9, y + 33), fill=color)


def draw_mark(transparent: bool) -> Image.Image:
    mode = "RGBA" if transparent else "RGB"
    background = (0, 0, 0, 0) if transparent else BACKGROUND
    image = Image.new(mode, (GRID, GRID), background)
    draw = ImageDraw.Draw(image)

    if not transparent:
        # Pixel-corner frame adds the game-board identity without reducing the
        # contrast of the central mark when the launcher rounds the icon.
        draw.rectangle((9, 18, 12, 103), fill="#26365D")
        draw.rectangle((115, 18, 118, 103), fill="#26365D")
        draw.rectangle((18, 9, 103, 12), fill="#26365D")
        draw.rectangle((18, 115, 103, 118), fill="#26365D")
        draw.rectangle((13, 13, 17, 17), fill=YELLOW_DARK)
        draw.rectangle((111, 13, 115, 17), fill=YELLOW_DARK)

    draw_card(draw, 13, CYAN, YELLOW)
    draw_card(draw, 91, PURPLE, CYAN)
    draw_question(draw, 19, 22, YELLOW)
    draw_question(draw, 94, 22, YELLOW)
    draw_lightning(draw)
    draw_pokeball(draw)

    return pixel_scale(image)


def save_assets() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    full = draw_mark(False)
    foreground = draw_mark(True)
    # Android's monochrome layer is intentionally a single flat color.
    monochrome = foreground.copy()
    alpha = monochrome.getchannel("A")
    white_layer = Image.new("RGBA", monochrome.size, WHITE)
    white_layer.putalpha(alpha)
    background = Image.new("RGB", full.size, BACKGROUND)

    full.save(ASSETS / "icon.png", optimize=True)
    full.save(ASSETS / "favicon.png", optimize=True)
    full.save(ASSETS / "splash-icon.png", optimize=True)
    foreground.save(ASSETS / "android-icon-foreground.png", optimize=True)
    white_layer.save(ASSETS / "android-icon-monochrome.png", optimize=True)
    background.save(ASSETS / "android-icon-background.png", optimize=True)
    print("Generated PokéQuién icon assets in", ASSETS)


if __name__ == "__main__":
    save_assets()
