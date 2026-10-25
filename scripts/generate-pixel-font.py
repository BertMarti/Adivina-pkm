"""Genera assets/fonts/PokeQuienPixel-Regular.ttf a partir de Press Start 2P (SIL OFL 1.1).

Press Start 2P dibuja «Á É Í Ó Ú Ü Ñ» con la letra encogida a 5 píxeles y se leen como minúsculas («Sí», «CóDIGO»).
Aquí se rehacen como mayúscula entera + el acento de la minúscula subido 2 píxeles (250 unidades).
Como «Press Start 2P» es nombre reservado de la OFL, la fuente modificada se llama «PokeQuien Pixel».

Uso (necesita fonttools: `python3 -m pip install fonttools`):
    python3 scripts/generate-pixel-font.py \
        node_modules/@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf \
        assets/fonts/PokeQuienPixel-Regular.ttf
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent

src, dst = sys.argv[1], sys.argv[2]
shift = int(sys.argv[3]) if len(sys.argv) > 3 else 250
f = TTFont(src)
glyf = f['glyf']
# Glifo compuesto = mayúscula entera + acento de la minúscula subido por encima de la altura de mayúsculas.
PLAN = {
    'Aacute': ('A', 'acute'), 'Eacute': ('E', 'acute'), 'Iacute': ('I', 'acute'),
    'Oacute': ('O', 'acute'), 'Uacute': ('U', 'acute'),
    'Udieresis': ('U', 'dieresis'), 'Ntilde': ('N', 'tilde'),
}
def comp(name, x, y):
    c = GlyphComponent(); c.glyphName = name; c.x = x; c.y = y; c.flags = 0x4  # ROUND_XY_TO_GRID
    return c
for target, (base, accent) in PLAN.items():
    g = Glyph(); g.numberOfContours = -1
    g.components = [comp(base, 0, 0), comp(accent, 0, shift)]
    glyf[target] = g
    g.recalcBounds(glyf)
    f['hmtx'][target] = (f['hmtx'][base][0], g.xMin)
# OFL con nombre reservado «Press Start 2P»: la versión modificada necesita otro nombre.
name = f['name']
FAMILY = 'PokeQuien Pixel'
for rec in list(name.names):
    if rec.nameID in (1, 16):
        rec.string = FAMILY
    elif rec.nameID == 4:
        rec.string = FAMILY + ' Regular' if 'Regular' in str(rec) else FAMILY
    elif rec.nameID in (3,):
        rec.string = FAMILY + ' Regular; derivado de Press Start 2P'
    elif rec.nameID == 6:
        rec.string = 'PokeQuienPixel-Regular'
    elif rec.nameID == 5:
        rec.string = str(rec) + '; PokeQuien: mayusculas acentuadas'
    elif rec.nameID == 0:
        rec.string = str(rec) + '. Modificado en 2026 por BertMarti (PokeQuien): mayusculas acentuadas a altura completa.'
f['head'].yMax = max(f['head'].yMax, max(glyf[t].yMax for t in PLAN))
f.save(dst)
