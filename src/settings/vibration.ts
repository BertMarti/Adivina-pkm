// Vibración en la web: solo si el navegador tiene `navigator.vibrate` y la pantalla es táctil (Chrome en Android, por
// ejemplo). Safari en iPhone no la tiene y Chrome de escritorio la tiene pero no hay nada que vibre.
// Nunca lanza: donde no existe, o si el navegador la bloquea, simplemente no vibra.

export type VibrationPattern = number | readonly number[];

type VibratingNavigator = {
  vibrate?: (pattern: number | number[]) => boolean;
  maxTouchPoints?: number;
  userActivation?: { hasBeenActive?: boolean };
};

function currentNavigator(): VibratingNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as unknown as VibratingNavigator);
}

/** ¿Puede vibrar este navegador? (API presente y dispositivo táctil). */
export function canVibrateWeb(nav: VibratingNavigator | undefined = currentNavigator()): boolean {
  return !!nav && typeof nav.vibrate === 'function' && (nav.maxTouchPoints ?? 0) > 0;
}

/**
 * Vibra si se puede. Antes de la primera pulsación en la página no se intenta: Chrome lo bloquearía
 * y dejaría un aviso en la consola.
 */
export function vibrateWeb(pattern: VibrationPattern, nav: VibratingNavigator | undefined = currentNavigator()): boolean {
  // La misma comprobación que muestra Ajustes: si allí sale «no disponible», aquí no se intenta.
  if (!nav || !canVibrateWeb(nav) || typeof nav.vibrate !== 'function') return false;
  if (nav.userActivation && nav.userActivation.hasBeenActive === false) return false;
  try {
    return nav.vibrate.call(nav, typeof pattern === 'number' ? pattern : [...pattern]) === true;
  } catch {
    return false;
  }
}

/** Patrones cortos por tipo de efecto (milisegundos: vibra, pausa, vibra…). */
export const WEB_VIBRATION_PATTERNS = {
  select: 15,
  restore: 15,
  cross: 30,
  victory: [60, 40, 60],
  defeat: [140],
} as const satisfies Record<string, VibrationPattern>;
