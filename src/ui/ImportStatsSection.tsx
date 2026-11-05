// Importar estadísticas (Solitario y Duelo) exportadas en otro dispositivo, dentro de Ajustes.
// Flujo: archivo o texto pegado → revisión (todo validado, nada escrito) → AÑADIR o REEMPLAZAR → confirmación → guardar.
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { buildDuelStatsExport } from '../game/duelStats';
import type { DuelRecord } from '../game/duelStats';
import { buildSoloStatsExport, statsFileName } from '../game/singlePlayerStats';
import type { SinglePlayerSessionRecord } from '../game/singlePlayerStorage';
import {
  buildStatsBackup,
  describeImportPlan,
  describeImportResult,
  describeParsedFile,
  MAX_IMPORT_BYTES,
  parseStatsFile,
  planImport,
} from '../game/statsImport';
import type { ImportMode, ImportPlan, ParsedStatsFile } from '../game/statsImport';
import { applyStatsImport } from '../game/statsImportStorage';
import { ActionButton } from './settingsControls';
import { COLORS, PIXEL_FONT } from './theme';
import { downloadOnWeb, pickTextFileOnWeb } from './webFiles';

type Props = {
  sessions: readonly SinglePlayerSessionRecord[] | null;
  duels: readonly DuelRecord[] | null;
  nameOf: (id: number) => string | undefined;
  onImported: () => void;
};

type Step =
  | { kind: 'idle' }
  | { kind: 'review'; file: ParsedStatsFile; source: string }
  | { kind: 'confirm'; file: ParsedStatsFile; source: string; plan: ImportPlan }
  | { kind: 'applying'; file: ParsedStatsFile; source: string; plan: ImportPlan };

export function ImportStatsSection({ sessions, duels, nameOf, onImported }: Props) {
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const loading = sessions === null || duels === null;
  const busy = step.kind === 'applying';
  const nothingToExport = loading || (sessions.length === 0 && duels.length === 0);

  const review = (value: string, source: string) => {
    setError('');
    setNotice('');
    const result = parseStatsFile(value);
    if (result.ok) setStep({ kind: 'review', file: result.file, source });
    else {
      setStep({ kind: 'idle' });
      setError(result.error);
    }
  };

  const choose = (mode: ImportMode) => {
    if ((step.kind !== 'review' && step.kind !== 'confirm') || loading) return;
    setError('');
    setStep({
      kind: 'confirm',
      file: step.file,
      source: step.source,
      plan: planImport({ solo: sessions, duel: duels }, step.file, mode),
    });
  };

  const confirm = async () => {
    if (step.kind !== 'confirm') return;
    setStep({ ...step, kind: 'applying' });
    setError('');
    try {
      // Relee y recalcula dentro del bloqueo de escritura: lo guardado es exactamente lo que se describe al terminar.
      const applied = await applyStatsImport(step.file, step.plan.mode);
      setText('');
      setStep({ kind: 'idle' });
      setNotice(describeImportResult(applied));
      onImported();
    } catch (caught) {
      setStep(step);
      setError(caught instanceof Error && caught.message ? caught.message : 'No se pudo importar. Tus estadísticas no han cambiado.');
    }
  };

  const cancel = () => {
    setStep({ kind: 'idle' });
    setError('');
  };

  const exportAll = async () => {
    if (loading || nothingToExport) return;
    const fileName = statsFileName('json', new Date(), 'todo');
    // Sin sangría: es para otra copia de PokéQuién, no para leerlo, y ocupa bastante menos.
    const content = JSON.stringify(buildStatsBackup(buildSoloStatsExport(sessions, nameOf), buildDuelStatsExport(duels, nameOf)));
    setError('');
    try {
      if (Platform.OS === 'web') {
        if (!downloadOnWeb(fileName, content, 'application/json')) throw new Error('sin descarga');
        setNotice(`Descargado ${fileName}. Ábrelo en el otro dispositivo con ELEGIR ARCHIVO JSON o pega su contenido.`);
        return;
      }
      await Share.share({ title: fileName, message: content });
    } catch {
      setError('No se pudo exportar. Inténtalo de nuevo.');
    }
  };

  const chooseFile = async () => {
    const result = await pickTextFileOnWeb(MAX_IMPORT_BYTES);
    if (!result) return;
    if (!result.ok) {
      setStep({ kind: 'idle' });
      setNotice('');
      setError(result.error);
      return;
    }
    // El contenido no se copia al cuadro de texto (un archivo grande lo haría lento): se revisa directamente.
    review(result.text, `Archivo «${result.name.slice(0, 80)}»`);
  };

  const plan = step.kind === 'confirm' || step.kind === 'applying' ? step.plan : null;

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        IMPORTAR ESTADÍSTICAS
      </Text>
      <Text style={styles.description}>
        Para pasar tus estadísticas a otro dispositivo: aquí pulsa EXPORTAR TODO (JSON) y, en el otro, abre ese archivo
        o pega su contenido. También valen los JSON del Solitario y del Duelo.
      </Text>
      <ActionButton
        label={Platform.OS === 'web' ? 'EXPORTAR TODO (JSON)' : 'COMPARTIR TODO (JSON)'}
        accessibilityLabel={`${Platform.OS === 'web' ? 'Descargar' : 'Compartir'} todas las estadísticas en JSON para otro dispositivo`}
        disabled={nothingToExport || busy}
        onPress={() => void exportAll()}
      />
      {Platform.OS === 'web' && (
        <ActionButton
          label="ELEGIR ARCHIVO JSON"
          accessibilityLabel="Elegir un archivo JSON de estadísticas para importar"
          disabled={busy || loading}
          onPress={() => void chooseFile()}
        />
      )}
      <TextInput
        multiline
        numberOfLines={4}
        value={text}
        onChangeText={(value) => {
          setText(value);
          // Si cambia el texto, lo revisado ya no vale.
          if (step.kind !== 'idle' && step.kind !== 'applying') setStep({ kind: 'idle' });
        }}
        editable={!busy}
        placeholder="…o pega aquí el contenido del JSON"
        placeholderTextColor="#A7A8B2"
        accessibilityLabel="Contenido JSON para importar"
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        style={styles.input}
      />
      <ActionButton
        label="REVISAR JSON"
        accessibilityLabel="Revisar el JSON pegado antes de importar"
        disabled={busy || loading || !text.trim()}
        onPress={() => review(text, 'Texto pegado')}
      />

      {step.kind === 'review' && (
        <View style={styles.box}>
          <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.description}>
            {`${step.source}. ${describeParsedFile(step.file)} ¿Qué quieres hacer con tus estadísticas?`}
          </Text>
          <View style={styles.actionsRow}>
            <ActionButton
              label="AÑADIR A LAS MÍAS"
              accessibilityLabel="Fusionar: añadir las partidas del archivo a las de este dispositivo"
              variant="row"
              disabled={loading}
              onPress={() => choose('merge')}
            />
            <ActionButton
              label="REEMPLAZAR LAS MÍAS"
              accessibilityLabel="Reemplazar las estadísticas de este dispositivo por las del archivo"
              variant="row"
              disabled={loading}
              onPress={() => choose('replace')}
            />
          </View>
          <ActionButton label="CANCELAR" accessibilityLabel="Cancelar la importación" onPress={cancel} />
        </View>
      )}

      {plan && (
        <View style={[styles.box, plan.mode === 'replace' && styles.boxDanger]}>
          {plan.mode === 'replace' && <Text style={styles.warning}>ATENCIÓN: REEMPLAZAR BORRA LO QUE HAY</Text>}
          <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.description}>
            {busy ? 'Importando…' : describeImportPlan(plan)}
          </Text>
          <View style={styles.actionsRow}>
            <ActionButton
              label={plan.mode === 'replace' ? 'CONFIRMAR REEMPLAZO' : 'CONFIRMAR'}
              accessibilityLabel={plan.mode === 'replace' ? 'Confirmar reemplazo' : 'Confirmar fusión'}
              danger={plan.mode === 'replace'}
              variant="row"
              disabled={busy}
              onPress={() => void confirm()}
            />
            <ActionButton
              label="VOLVER"
              accessibilityLabel="Volver a elegir entre añadir y reemplazar"
              variant="row"
              disabled={busy}
              onPress={() => step.kind === 'confirm' && setStep({ kind: 'review', file: step.file, source: step.source })}
            />
          </View>
        </View>
      )}

      {!!error && (
        <Text accessibilityRole="alert" aria-live="assertive" style={styles.error}>
          {`ERROR: ${error}`}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.notice}>
          {notice}
        </Text>
      )}
      <Text style={styles.hint}>
        Se comprueba todo el archivo antes de tocar nada: si algo no cuadra, no se importa nada y tus estadísticas siguen
        como estaban.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, borderTopWidth: 2, borderTopColor: '#3A3B48', paddingTop: 12 },
  title: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 15 },
  description: { color: '#D4D4DA', fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 96,
    maxHeight: 180,
    backgroundColor: '#171820',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4A4B57',
    color: COLORS.white,
    fontSize: 13,
    padding: 10,
    textAlignVertical: 'top',
  },
  box: { gap: 10, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: '#4A4B57', backgroundColor: '#171820' },
  boxDanger: { borderColor: COLORS.orange, borderStyle: 'dashed' },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  warning: { color: '#FFB27A', fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 14 },
  error: {
    color: '#FFB27A',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.orange,
    paddingLeft: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  notice: { color: '#7CE0A3', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  hint: { color: '#A7A8B2', fontSize: 12, lineHeight: 17 },
});
