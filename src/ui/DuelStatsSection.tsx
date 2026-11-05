// Estadísticas del Duelo (contra un amigo) dentro de Ajustes: resumen, por generación, exportación y borrado confirmado.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { clearDuelLog } from '../game/duelStorage';
import { buildDuelStatsExport, computeDuelStats, duelRecordsToCsv } from '../game/duelStats';
import type { DuelRecord } from '../game/duelStats';
import { statsFileName } from '../game/singlePlayerStats';
import { ActionButton, StatLine } from './settingsControls';
import { COLORS, PIXEL_FONT } from './theme';
import { downloadOnWeb } from './webFiles';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function DuelStatsSection({
  records,
  nameOf,
  onCleared,
}: {
  records: readonly DuelRecord[] | null;
  nameOf: (id: number) => string | undefined;
  onCleared: () => void;
}) {
  const stats = useMemo(() => (records === null ? null : computeDuelStats(records)), [records]);
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );
  const exportStats = async (format: 'csv' | 'json') => {
    if (!records?.length) return;
    const fileName = statsFileName(format, new Date(), 'duelo');
    const content =
      format === 'csv'
        ? duelRecordsToCsv(records, nameOf)
        : JSON.stringify(buildDuelStatsExport(records, nameOf), null, 2);
    try {
      if (Platform.OS === 'web') {
        if (!downloadOnWeb(fileName, content, format === 'csv' ? 'text/csv' : 'application/json')) throw new Error();
        setNotice(`Descargado ${fileName}. Ábrelo con una hoja de cálculo o un editor de texto.`);
      } else await Share.share({ title: fileName, message: content });
    } catch {
      setNotice('No se pudo exportar. Inténtalo de nuevo.');
    }
  };
  const clear = async () => {
    if (!confirm) {
      setConfirm(true);
      setNotice('Pulsa otra vez para borrar las estadísticas del Duelo de este dispositivo.');
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => {
        setConfirm(false);
        setNotice('');
      }, 5_000);
      return;
    }
    try {
      await clearDuelLog();
      setConfirm(false);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      onCleared();
      setNotice('Estadísticas del Duelo borradas.');
    } catch {
      setNotice('No se pudieron borrar. Inténtalo de nuevo.');
    }
  };
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        ESTADÍSTICAS DEL DUELO
      </Text>
      <Text style={styles.kicker}>CONTRA UN AMIGO</Text>
      {!stats && <Text style={styles.description}>Cargando…</Text>}
      {stats && stats.played === 0 && (
        <Text style={styles.description}>
          Aún no hay duelos terminados. Crea una sala, invita a un amigo y aquí verás tus victorias y derrotas por
          generación.{stats.rivalLeft > 0 ? ` Se fue el rival: ${stats.rivalLeft}.` : ''}
          {stats.left > 0 ? ` Abandonaste: ${stats.left}.` : ''}
        </Text>
      )}
      {stats && stats.played > 0 && (
        <>
          <StatLine label="Duelos terminados" value={String(stats.played)} />
          {/* Derrotas = 100 − victorias, para que los dos porcentajes sumen siempre 100. */}
          <StatLine label="Victorias" value={`${stats.wins} (${stats.winRate ?? 0} %)`} />
          <StatLine label="Derrotas" value={`${stats.losses} (${100 - (stats.winRate ?? 0)} %)`} />
          <StatLine label="Mejor racha de victorias" value={String(stats.bestWinStreak)} />
          {stats.rivalLeft > 0 && <StatLine label="El rival se fue (no cuentan)" value={String(stats.rivalLeft)} />}
          {stats.left > 0 && <StatLine label="Abandonaste (no cuentan)" value={String(stats.left)} />}
          <Text style={styles.subheading}>POR GENERACIÓN</Text>
          {stats.byGeneration.map((item) => (
            <View
              key={String(item.generation)}
              accessible
              accessibilityLabel={`${item.label}: ${plural(item.played, 'duelo', 'duelos')}, ${plural(item.wins, 'victoria', 'victorias')} y ${plural(item.losses, 'derrota', 'derrotas')}${item.unfinished ? `, ${item.unfinished} sin terminar` : ''}`}
              style={styles.generationRow}
            >
              <View style={styles.generationCopy}>
                <Text style={styles.generationText}>{item.label}</Text>
                <Text style={styles.generationValue}>
                  {item.wins} V · {item.losses} D
                </Text>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                  style={styles.bar}
                >
                  <View style={[styles.fill, { width: `${item.played ? (item.wins / item.played) * 100 : 0}%` }]} />
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.legend}>V = victorias · D = derrotas. La barra amarilla es la parte de victorias.</Text>
        </>
      )}
      <View style={styles.actionsRow}>
        <ActionButton
          label={Platform.OS === 'web' ? 'DESCARGAR CSV' : 'COMPARTIR CSV'}
          variant="row"
          accessibilityLabel={`${Platform.OS === 'web' ? 'Descargar' : 'Compartir'} los duelos en CSV (hoja de cálculo)`}
          disabled={!records || records.length === 0}
          onPress={() => void exportStats('csv')}
        />
        <ActionButton
          label={Platform.OS === 'web' ? 'DESCARGAR JSON' : 'COMPARTIR JSON'}
          variant="row"
          accessibilityLabel={`${Platform.OS === 'web' ? 'Descargar' : 'Compartir'} las estadísticas del Duelo en JSON`}
          disabled={!records || records.length === 0}
          onPress={() => void exportStats('json')}
        />
      </View>
      <ActionButton
        label={confirm ? '¿SEGURO? BORRAR DUELOS' : 'BORRAR ESTADÍSTICAS DEL DUELO'}
        accessibilityLabel={confirm ? 'Confirmar: borrar las estadísticas del Duelo' : 'Borrar estadísticas del Duelo'}
        danger={confirm}
        disabled={!records || records.length === 0}
        onPress={() => void clear()}
      />
      {!!notice && (
        <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.notice}>
          {notice}
        </Text>
      )}
      <Text style={styles.hint}>
        Se guardan al terminar cada duelo en este dispositivo. No se envía nada a ningún servidor.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, borderTopWidth: 2, borderTopColor: '#3A3B48', paddingTop: 12 },
  title: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 15 },
  kicker: { color: '#C9C9D1', fontFamily: PIXEL_FONT, fontSize: 6, lineHeight: 11, marginTop: -7 },
  description: { color: '#D4D4DA', fontSize: 13, lineHeight: 19 },
  subheading: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 13, marginTop: 4 },
  generationRow: { paddingVertical: 3 },
  generationCopy: { gap: 4 },
  generationText: { color: COLORS.white, fontSize: 13, lineHeight: 18 },
  generationValue: {
    position: 'absolute',
    right: 0,
    color: COLORS.white,
    fontFamily: PIXEL_FONT,
    fontSize: 7,
    lineHeight: 13,
  },
  bar: { height: 10, borderWidth: 1, borderColor: '#67686F', backgroundColor: '#2A2B33' },
  fill: { height: '100%', backgroundColor: COLORS.yellow },
  legend: { color: '#A7A8B2', fontSize: 12, lineHeight: 17 },
  notice: { color: '#7CE0A3', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  hint: { color: '#A7A8B2', fontSize: 12, lineHeight: 17 },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
