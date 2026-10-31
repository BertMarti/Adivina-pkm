// Ajustes de PokéQuién (sonido, vibración y tachado visible): modelo puro, sin React ni almacenamiento.
// Se guardan en el dispositivo con la clave SETTINGS_STORAGE_KEY. En la web, el origen bertmarti.github.io es
// compartido con otras webs: por eso la clave lleva el prefijo del proyecto y aquí nunca se guarda nada sensible.

export type AppSettings = Readonly<{
  /** Efectos de sonido del Duelo y del Solitario. */
  soundEnabled: boolean;
  /** Volumen de 0 a 1 en pasos de 0,1. */
  volume: number;
  /** Vibración (háptica en el móvil; `navigator.vibrate` en navegadores que lo tienen). */
  vibrationEnabled: boolean;
  /** Tachado visible sin depender del color: velo, aspa blanca con borde, borde discontinuo y etiqueta FUERA. */
  colorblindMode: boolean;
}>;

/** Solo se guardan los ajustes que la persona ha cambiado; el resto sigue los valores por defecto. */
export type StoredSettings = Partial<AppSettings>;

export const SETTINGS_STORAGE_KEY = 'adivina-pkm:ajustes:v1';
export const VOLUME_STEP = 0.1;
export const DEFAULT_VOLUME = 0.8;

/**
 * Valores por defecto. Si el sistema pide reducir el movimiento, la vibración empieza desactivada
 * (la persona puede activarla en Ajustes).
 */
export function defaultSettings({ reduceMotion }: { reduceMotion: boolean }): AppSettings {
  return { soundEnabled: true, volume: DEFAULT_VOLUME, vibrationEnabled: !reduceMotion, colorblindMode: false };
}

/** Redondea a pasos de 0,1 y limita a [0, 1]. Un valor no numérico devuelve null. */
export function normalizeVolume(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const clamped = Math.min(1, Math.max(0, value));
  // Pasos de 0,1 sin errores de coma flotante (0,7 + 0,1 = 0,8 y no 0,7999…).
  return Math.round(clamped * 10) / 10;
}

/** Sube o baja el volumen un paso. */
export function stepVolume(volume: number, direction: 1 | -1): number {
  return normalizeVolume((normalizeVolume(volume) ?? DEFAULT_VOLUME) + direction * VOLUME_STEP) ?? DEFAULT_VOLUME;
}

/** Porcentaje entero para mostrar y anunciar («80 %»). */
export function volumePercent(volume: number): number {
  return Math.round((normalizeVolume(volume) ?? 0) * 100);
}

/** Volumen que de verdad se aplica: 0 si el sonido está desactivado. */
export function effectiveVolume(settings: AppSettings): number {
  return settings.soundEnabled ? (normalizeVolume(settings.volume) ?? 0) : 0;
}

/** Valida lo leído del almacenamiento: se descarta todo campo desconocido o con un tipo incorrecto. */
export function sanitizeStoredSettings(value: unknown): StoredSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: { -readonly [K in keyof AppSettings]?: AppSettings[K] } = {};
  if (typeof raw.soundEnabled === 'boolean') result.soundEnabled = raw.soundEnabled;
  const volume = normalizeVolume(raw.volume);
  if (volume !== null) result.volume = volume;
  if (typeof raw.vibrationEnabled === 'boolean') result.vibrationEnabled = raw.vibrationEnabled;
  if (typeof raw.colorblindMode === 'boolean') result.colorblindMode = raw.colorblindMode;
  return result;
}

/** Lee el texto guardado (JSON) sin lanzar nunca: un valor corrupto equivale a «sin ajustes guardados». */
export function parseStoredSettings(raw: string | null | undefined): StoredSettings {
  if (!raw) return {};
  try {
    return sanitizeStoredSettings(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Ajustes efectivos: los guardados encima de los valores por defecto. */
export function resolveSettings(stored: StoredSettings, options: { reduceMotion: boolean }): AppSettings {
  return { ...defaultSettings(options), ...sanitizeStoredSettings(stored) };
}
