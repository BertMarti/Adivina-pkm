// Contraste WCAG 2.x entre dos colores sólidos (#RGB o #RRGGBB). Se usa en las pruebas del tachado visible.

function channel(value: number) {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa (0 negro, 1 blanco). */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Color no válido: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Relación de contraste (de 1 a 21). AA pide 4,5 para texto normal y 3 para gráficos y bordes. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Mezcla un color sobre otro con una opacidad (para comprobar un velo semitransparente). */
export function blend(top: string, bottom: string, alpha: number): string {
  const parse = (hex: string) => [0, 2, 4].map((index) => parseInt(hex.replace('#', '').slice(index, index + 2), 16));
  const [t, u] = [parse(top), parse(bottom)];
  return `#${t.map((value, index) => Math.round(value * alpha + u[index] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}
