// Paleta y tipografía comunes de PokéQuién (las usan App.tsx y los componentes de src/ui).
export const COLORS = {
  ink: '#111128',
  background: '#05070B',
  panel: '#1D1E2A',
  panelLight: '#262736',
  yellow: '#FFD000',
  orange: '#F06B00',
  cyan: '#4C6BE8',
  white: '#F6F5EF',
  muted: '#A7A8B2',
  danger: '#FF5F67',
  success: '#38D37D',
};

// PokeQuien Pixel = Press Start 2P (OFL) con «Á É Í Ó Ú Ü Ñ» a altura completa (scripts/generate-pixel-font.py).
export const PIXEL_FONT = 'PokeQuienPixel';

// Tachado visible (modo daltónico, en Ajustes): una carta descartada se reconoce sin depender del color
// por cuatro señales de forma y luminosidad: velo oscuro sobre el retrato, aspa blanca con borde negro,
// borde discontinuo claro y la etiqueta «FUERA». src/ui/contrast.test.ts comprueba el contraste WCAG AA.
export const MARKED_CROSS = {
  /** Fondo de la carta tachada (el mismo que sin el modo). */
  tileBackground: '#25262B',
  /** Fondo del tablero sobre el que se ve el borde de la carta. */
  boardBackground: '#1C1D27',
  /** Velo sobre el retrato: color y opacidad. */
  veil: '#05070B',
  veilOpacity: 0.62,
  /** Aspa y su contorno (se ve igual sobre un retrato claro u oscuro). */
  line: '#F6F5EF',
  lineEdge: '#05070B',
  /** Borde discontinuo de la carta. */
  border: '#F6F5EF',
  /** Etiqueta FUERA. */
  badgeBackground: '#05070B',
  badgeText: '#F6F5EF',
} as const;
