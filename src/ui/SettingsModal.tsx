// Ajustes: sonido y volumen, vibración, tachado visible (modo daltónico) y estadísticas del Solitario.
// Todo se guarda solo en este dispositivo (ver src/settings y src/game/singlePlayerStorage.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, ScrollViewInstance, Share, StyleSheet, Text, View } from 'react-native';

import { LOCAL_KANTO_ROSTER } from '../data/pokemon';
import { NATIONAL_POKEMON_CATALOG } from '../data/pokemonNationalCatalog';
import {
  buildSoloStatsExport,
  computeSoloStats,
  soloSessionsToCsv,
  statsFileName,
} from '../game/singlePlayerStats';
import { clearSinglePlayerLog, readSinglePlayerLog, SinglePlayerSessionRecord } from '../game/singlePlayerStorage';
import { useSettings } from '../settings/SettingsContext';
import { stepVolume, volumePercent } from '../settings/settingsModel';
import { canVibrateWeb } from '../settings/vibration';
import { PokemonTile } from './components';
import { COLORS, PIXEL_FONT } from './theme';

export type SettingsSection = 'all' | 'stats';

const POKEMON_NAMES = new Map<number, string>();
function pokemonName(id: number) {
  if (POKEMON_NAMES.size === 0) for (const pokemon of NATIONAL_POKEMON_CATALOG) POKEMON_NAMES.set(pokemon.id, pokemon.name);
  return POKEMON_NAMES.get(id);
}

/** «12.5» → «12,5» (decimales en español). */
function decimal(value: number | null) {
  return value === null ? '—' : String(value).replace('.', ',');
}

function percent(part: number, total: number) {
  return total === 0 ? '' : ` (${Math.round((part / total) * 100)} %)`;
}

/** Descarga un archivo de texto en la web (Blob + enlace con `download`). Devuelve false si no se puede. */
function downloadOnWeb(fileName: string, content: string, mime: string) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

function SettingSwitch({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      // react-native-web 0.21 no traduce accessibilityState.checked: aria-checked lo anuncia también en la web.
      aria-checked={value}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.switchRow, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.switchCopy}>
        <Text style={styles.switchLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {/* Estado con texto y posición del botón, no solo con color. */}
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
        <Text style={[styles.switchState, value && styles.switchStateOn]}>{value ? 'SÍ' : 'NO'}</Text>
      </View>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  danger = false,
  accessibilityLabel,
  variant = 'block',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
  /** block: ancho completo; row: comparte fila; stepper: botón cuadrado de − / +. */
  variant?: 'block' | 'row' | 'stepper';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        variant === 'row' && styles.actionInRow,
        variant === 'stepper' && styles.stepper,
        danger && styles.actionDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, variant === 'stepper' && styles.stepperText]}>{label}</Text>
    </Pressable>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statLine} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function SettingsModal({
  visible,
  section,
  onClose,
  onTestSound,
  onTestVibration,
  onStatsCleared,
}: {
  visible: boolean;
  section: SettingsSection;
  onClose: () => void;
  onTestSound: () => void;
  onTestVibration: () => void;
  onStatsCleared: () => void;
}) {
  const { settings, update, reset, reduceMotion } = useSettings();
  const [sessions, setSessions] = useState<SinglePlayerSessionRecord[] | null>(null);
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const statsY = useRef<number | null>(null);
  const vibrationAvailable = Platform.OS !== 'web' || canVibrateWeb();

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setSessions(null);
    setNotice('');
    setConfirmClear(false);
    void readSinglePlayerLog().then((read) => {
      if (active) setSessions(read);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const stats = useMemo(() => (sessions ? computeSoloStats(sessions, pokemonName) : null), [sessions]);

  const flash = (message: string, confirm = false) => {
    setNotice(message);
    setConfirmClear(confirm);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice('');
      setConfirmClear(false);
    }, 5_000);
  };

  const exportStats = async (format: 'csv' | 'json') => {
    if (!sessions || sessions.length === 0) return;
    const fileName = statsFileName(format);
    const content =
      format === 'csv'
        ? soloSessionsToCsv(sessions, pokemonName)
        : JSON.stringify(buildSoloStatsExport(sessions, pokemonName), null, 2);
    try {
      if (Platform.OS === 'web') {
        if (!downloadOnWeb(fileName, content, format === 'csv' ? 'text/csv' : 'application/json')) throw new Error('sin descarga');
        flash(`Descargado ${fileName}. Ábrelo con una hoja de cálculo o un editor de texto.`);
        return;
      }
      await Share.share({ title: fileName, message: content });
    } catch {
      flash('No se pudo exportar. Inténtalo de nuevo.');
    }
  };

  // Borrar es irreversible: la primera pulsación pide confirmación y la segunda (en 5 s) borra.
  const clearStats = async () => {
    if (!confirmClear) {
      flash('Pulsa otra vez para borrar las estadísticas y el historial del Solitario de este dispositivo.', true);
      return;
    }
    try {
      await clearSinglePlayerLog();
      setSessions([]);
      onStatsCleared();
      flash('Estadísticas e historial borrados.');
    } catch {
      flash('No se pudieron borrar. Inténtalo de nuevo.');
    }
  };

  const total = stats?.played ?? 0;
  const previewAvailable = LOCAL_KANTO_ROSTER[0];
  const previewCrossed = LOCAL_KANTO_ROSTER[24] ?? LOCAL_KANTO_ROSTER[1];

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            AJUSTES
          </Text>
          <Text style={styles.subtitle}>SE GUARDAN SOLO EN ESTE DISPOSITIVO</Text>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => {
              if (section === 'stats' && statsY.current !== null) scrollRef.current?.scrollTo({ y: statsY.current, animated: false });
            }}
          >
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                SONIDO
              </Text>
              <SettingSwitch
                label="Sonido"
                description="Efectos al elegir, tachar, ganar y perder."
                value={settings.soundEnabled}
                onChange={(value) => update({ soundEnabled: value })}
              />
              <View style={styles.volumeRow}>
                <ActionButton
                  label="-"
                  variant="stepper"
                  accessibilityLabel="Bajar volumen"
                  disabled={!settings.soundEnabled || settings.volume <= 0}
                  onPress={() => update({ volume: stepVolume(settings.volume, -1) })}
                />
                <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.volumeValue}>
                  {`VOLUMEN ${volumePercent(settings.volume)} %`}
                </Text>
                <ActionButton
                  label="+"
                  variant="stepper"
                  accessibilityLabel="Subir volumen"
                  disabled={!settings.soundEnabled || settings.volume >= 1}
                  onPress={() => update({ volume: stepVolume(settings.volume, 1) })}
                />
              </View>
              <ActionButton
                label="PROBAR SONIDO"
                disabled={!settings.soundEnabled || settings.volume <= 0}
                onPress={onTestSound}
              />
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                VIBRACIÓN
              </Text>
              <SettingSwitch
                label="Vibración"
                description={
                  vibrationAvailable
                    ? 'Un toque corto al tachar y otro más largo al terminar la partida.'
                    : 'Este navegador no puede vibrar (por ejemplo, Safari en iPhone o un ordenador). En un móvil Android con Chrome sí funciona.'
                }
                value={settings.vibrationEnabled && vibrationAvailable}
                disabled={!vibrationAvailable}
                onChange={(value) => update({ vibrationEnabled: value })}
              />
              {vibrationAvailable && (
                <ActionButton label="PROBAR VIBRACIÓN" disabled={!settings.vibrationEnabled} onPress={onTestVibration} />
              )}
              {reduceMotion && (
                <Text style={styles.description}>
                  Tu dispositivo pide reducir el movimiento: las animaciones ya van sin movimiento y la vibración empieza
                  desactivada (puedes activarla aquí).
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                TACHADO VISIBLE
              </Text>
              <SettingSwitch
                label="Modo daltónico"
                description="Las cartas descartadas se oscurecen y llevan un aspa blanca, borde discontinuo y la etiqueta FUERA: se distinguen sin depender del color."
                value={settings.colorblindMode}
                onChange={(value) => update({ colorblindMode: value })}
              />
              <Text style={styles.previewLabel}>VISTA PREVIA: DISPONIBLE · DESCARTADA</Text>
              <View style={styles.previewRow}>
                {previewAvailable && (
                  <PokemonTile pokemon={previewAvailable} crossed={false} interactive={false} reduceMotion onPress={() => {}} />
                )}
                {previewCrossed && (
                  <PokemonTile pokemon={previewCrossed} crossed interactive={false} reduceMotion onPress={() => {}} />
                )}
              </View>
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                statsY.current = event.nativeEvent.layout.y;
                if (section === 'stats') scrollRef.current?.scrollTo({ y: statsY.current, animated: false });
              }}
            >
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                ESTADÍSTICAS DEL SOLITARIO
              </Text>
              {!stats && <Text style={styles.description}>Cargando…</Text>}
              {stats && stats.played === 0 && (
                <Text style={styles.description}>
                  Aún no hay partidas terminadas del Solitario. Juega una contra la máquina y aquí verás tus números.
                  {stats.abandoned > 0 ? ` Partidas abandonadas: ${stats.abandoned}.` : ''}
                </Text>
              )}
              {stats && stats.played > 0 && (
                <>
                  <StatLine label="Partidas terminadas" value={String(stats.played)} />
                  <StatLine label="La máquina acertó" value={`${stats.machineWins}${percent(stats.machineWins, total)}`} />
                  <StatLine label="Ganaste tú" value={`${stats.playerWins}${percent(stats.playerWins, total)}`} />
                  {stats.unresolved > 0 && <StatLine label="Sin resolver" value={String(stats.unresolved)} />}
                  <StatLine label="Preguntas medias por partida" value={decimal(stats.averageQuestions)} />
                  <StatLine label="Preguntas medias para acertar" value={decimal(stats.averageQuestionsToGuess)} />
                  {stats.abandoned > 0 && <StatLine label="Abandonadas (no cuentan)" value={String(stats.abandoned)} />}
                  <Text style={styles.subheading}>POKÉMON MÁS DIFÍCILES PARA LA MÁQUINA</Text>
                  {stats.hardest.map((item, index) => (
                    <Text key={item.pokemonId} style={styles.hardItem}>
                      {`${index + 1}. ${item.name} · ${
                        item.machineMisses > 0 ? `falló ${item.machineMisses} de ${item.games}` : `acertó ${item.games} de ${item.games}`
                      } · ${decimal(item.averageQuestions)} preguntas de media`}
                    </Text>
                  ))}
                </>
              )}
              <View style={styles.actionsRow}>
                <ActionButton
                  label={Platform.OS === 'web' ? 'DESCARGAR CSV' : 'COMPARTIR CSV'}
                  variant="row"
                  accessibilityLabel={`${Platform.OS === 'web' ? 'Descargar' : 'Compartir'} las partidas en CSV (hoja de cálculo)`}
                  disabled={!sessions || sessions.length === 0}
                  onPress={() => void exportStats('csv')}
                />
                <ActionButton
                  label={Platform.OS === 'web' ? 'DESCARGAR JSON' : 'COMPARTIR JSON'}
                  variant="row"
                  accessibilityLabel={`${Platform.OS === 'web' ? 'Descargar' : 'Compartir'} las estadísticas en JSON`}
                  disabled={!sessions || sessions.length === 0}
                  onPress={() => void exportStats('json')}
                />
              </View>
              <ActionButton
                label={confirmClear ? '¿SEGURO? BORRAR TODO' : 'BORRAR ESTADÍSTICAS'}
                accessibilityLabel={confirmClear ? 'Confirmar: borrar estadísticas e historial' : 'Borrar estadísticas'}
                danger={confirmClear}
                disabled={!sessions || sessions.length === 0}
                onPress={() => void clearStats()}
              />
              {!!notice && (
                <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.notice}>
                  {notice}
                </Text>
              )}
              <Text style={styles.hint}>
                Se calculan con el historial del Solitario guardado en este dispositivo. No se envía nada a ningún servidor.
              </Text>
            </View>

            <ActionButton label="VALORES POR DEFECTO" accessibilityLabel="Volver a los ajustes por defecto" onPress={reset} />
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar ajustes"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>CERRAR</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Botón compacto «AJUSTES» (barra del inicio y partida). */
export function SettingsButton({ onPress, label = 'AJUSTES' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajustes: sonido, vibración, tachado visible y estadísticas"
      onPress={onPress}
      style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
    >
      <Text style={styles.settingsButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 4, 10, 0.86)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.yellow,
    padding: 16,
    gap: 10,
  },
  title: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  subtitle: { color: '#C9C9D1', fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 13, textAlign: 'center', marginTop: -4 },
  list: { gap: 16, paddingBottom: 6 },
  section: { gap: 10, borderTopWidth: 2, borderTopColor: '#3A3B48', paddingTop: 12 },
  sectionTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 15 },
  subheading: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 13, marginTop: 4 },
  description: { color: '#D4D4DA', fontSize: 13, lineHeight: 19 },
  switchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A4B57',
    backgroundColor: '#171820',
  },
  switchCopy: { flex: 1, gap: 4 },
  switchLabel: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 14 },
  switchTrack: {
    width: 74,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#8A8B93',
    backgroundColor: '#2A2B33',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchTrackOn: { borderColor: COLORS.yellow, backgroundColor: '#3B3410' },
  switchKnob: { position: 'absolute', left: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#A7A8B2' },
  switchKnobOn: { left: 43, backgroundColor: COLORS.yellow },
  switchState: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 12, textAlign: 'right', paddingRight: 6 },
  switchStateOn: { textAlign: 'left', paddingLeft: 6, paddingRight: 0 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  volumeValue: { flex: 1, color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 14, textAlign: 'center' },
  previewLabel: { color: '#C9C9D1', fontFamily: PIXEL_FONT, fontSize: 6, lineHeight: 11 },
  previewRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, width: '100%' },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#30313C',
  },
  statLabel: { flex: 1, color: '#D4D4DA', fontSize: 13, lineHeight: 18 },
  statValue: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 15 },
  hardItem: { color: COLORS.white, fontSize: 13, lineHeight: 19 },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  // En fila, los botones se reparten el ancho (y bajan de línea en pantallas estrechas).
  actionInRow: { flexGrow: 1, flexBasis: 120 },
  stepper: { width: 56 },
  stepperText: { fontSize: 16, lineHeight: 20 },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#67686F',
    backgroundColor: '#25262F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDanger: { borderColor: COLORS.orange, backgroundColor: '#3A1B0C' },
  actionText: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 14, textAlign: 'center' },
  notice: { color: '#7CE0A3', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  hint: { color: '#A7A8B2', fontSize: 12, lineHeight: 17 },
  close: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#505158',
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#74757A',
    borderBottomColor: '#2E2F34',
  },
  closeText: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 16 },
  settingsButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#5C6488',
    backgroundColor: '#141833',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 12 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
