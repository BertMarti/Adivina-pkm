// Ajustes compartidos por toda la app (contexto de React) y guardados en el dispositivo con AsyncStorage
// (en la web, localStorage con la clave prefijada `adivina-pkm:`). Si el almacenamiento falla, se sigue jugando
// con los valores por defecto: los ajustes son una comodidad, no algo crítico.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useReduceMotion } from '../hooks/useReduceMotion';
import {
  AppSettings,
  defaultSettings,
  parseStoredSettings,
  resolveSettings,
  sanitizeStoredSettings,
  SETTINGS_STORAGE_KEY,
  StoredSettings,
} from './settingsModel';

type SettingsContextValue = Readonly<{
  settings: AppSettings;
  /** true cuando ya se han leído los ajustes guardados. */
  loaded: boolean;
  reduceMotion: boolean;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}>;

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings({ reduceMotion: false }),
  loaded: false,
  reduceMotion: false,
  update: () => {},
  reset: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [stored, setStored] = useState<StoredSettings>({});
  const [loaded, setLoaded] = useState(false);
  // Un cambio hecho antes de terminar la lectura inicial no debe perderse al llegar lo leído.
  const touchedRef = useRef(false);
  // Restablecer antes de terminar la lectura inicial: lo leído ya no vale.
  const resetRef = useRef(false);
  const storedRef = useRef<StoredSettings>({});
  // Escrituras en cola: dos cambios rápidos nunca se guardan en orden inverso.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Solo se guardan los ajustes cambiados; sin ninguno, se borra la clave.
  const apply = useCallback((next: StoredSettings) => {
    touchedRef.current = true;
    storedRef.current = next;
    setStored(next);
    writeQueueRef.current = writeQueueRef.current
      .then(() =>
        Object.keys(next).length === 0
          ? AsyncStorage.removeItem(SETTINGS_STORAGE_KEY)
          : AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const saved = resetRef.current ? {} : parseStoredSettings(raw);
        if (touchedRef.current) {
          // Lo cambiado mientras se leía manda sobre lo guardado.
          apply({ ...saved, ...storedRef.current });
          return;
        }
        storedRef.current = saved;
        setStored(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [apply]);

  const update = useCallback(
    (patch: Partial<AppSettings>) => apply(sanitizeStoredSettings({ ...storedRef.current, ...patch })),
    [apply],
  );

  const reset = useCallback(() => {
    resetRef.current = true;
    apply({});
  }, [apply]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings: resolveSettings(stored, { reduceMotion }), loaded, reduceMotion, update, reset }),
    [stored, reduceMotion, loaded, update, reset],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
