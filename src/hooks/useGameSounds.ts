// Sonidos y vibraciones del Duelo y del Solitario (en web, tono sintetizado de respaldo).
// Respetan los Ajustes: sonido sí/no, volumen y vibración sí/no (en web solo si existe navigator.vibrate).
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Platform } from 'react-native';
import { CROSS_WAV } from '../audio/sounds';
import { useSettings } from '../settings/SettingsContext';
import { effectiveVolume } from '../settings/settingsModel';
import { vibrateWeb, WEB_VIBRATION_PATTERNS } from '../settings/vibration';

export type SoundKind = 'select' | 'cross' | 'restore' | 'victory' | 'defeat';

/** Qué canales usar en una llamada concreta (los botones PROBAR de Ajustes prueban uno solo). */
export type FeedbackChannels = Readonly<{ sound?: boolean; vibration?: boolean }>;

export function useGameSounds() {
  const selectionReferencePlayer = useAudioPlayer(require('../../assets/selection-reference.wav'));
  const crossPlayer = useAudioPlayer({ uri: `data:audio/wav;base64,${CROSS_WAV}` });
  const victoryPlayer = useAudioPlayer(require('../../assets/victory-reference.wav'));
  const defeatPlayer = useAudioPlayer(require('../../assets/defeat-reference.wav'));
  const webContext = useRef<any>(null);
  const lastVictoryAt = useRef(0);
  const { settings } = useSettings();

  const playWebTone = (kind: SoundKind, volume: number) => {
    if (typeof window === 'undefined') return;
    const audioWindow = window as unknown as { AudioContext?: new () => any; webkitAudioContext?: new () => any };
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = webContext.current ?? new AudioContextConstructor();
    webContext.current = context;
    if (kind === 'victory') {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.14;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12 * volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.16);
      });
      return;
    }
    if (kind === 'defeat') {
      [196, 155.56, 130.81].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.27;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.1 * volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.26);
      });
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const startFrequency = kind === 'cross' ? 220 : kind === 'restore' ? 440 : 620;
    const endFrequency = kind === 'cross' ? 90 : kind === 'restore' ? 780 : 880;
    oscillator.type = kind === 'cross' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11 * volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'cross' ? 0.14 : 0.1));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === 'cross' ? 0.15 : 0.11));
  };

  const vibrate = (kind: SoundKind) => {
    if (Platform.OS === 'web') {
      vibrateWeb(WEB_VIBRATION_PATTERNS[kind]);
      return;
    }
    if (kind === 'victory') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (kind === 'defeat') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (kind === 'select' || kind === 'restore') void Haptics.selectionAsync().catch(() => {});
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  return (kind: SoundKind, channels: FeedbackChannels = {}) => {
    const testing = channels.sound !== undefined || channels.vibration !== undefined;
    if (!testing && (kind === 'victory' || kind === 'defeat')) {
      const now = Date.now();
      if (now - lastVictoryAt.current < 1800) return;
      lastVictoryAt.current = now;
    }
    const volume = effectiveVolume(settings);
    const wantsSound = (channels.sound ?? !testing) && volume > 0;
    const wantsVibration = (channels.vibration ?? !testing) && settings.vibrationEnabled;
    if (wantsSound) {
      const player =
        kind === 'cross'
          ? crossPlayer
          : kind === 'victory'
            ? victoryPlayer
            : kind === 'defeat'
              ? defeatPlayer
              : selectionReferencePlayer;
      const playNative = () => {
        player.volume = volume;
        void player
          .seekTo(0)
          .catch(() => {})
          .finally(() => player.play());
      };
      try {
        playNative();
      } catch {
        playWebTone(kind, volume);
      }
    }
    if (wantsVibration) vibrate(kind);
  };
}
