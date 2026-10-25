// Sala creada: código e invitación al rival.
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GENERATIONS } from '../data/pokemon';
import { PlayerId } from '../game/engine';
import { RoomGameState } from '../game/roomClient';
import { Button, RetroPanelHeader } from '../ui/components';
import { styles } from '../ui/appStyles';

export function RoomScreen({
  game,
  player,
  onShare,
  onCopyCode,
  onBack,
  notice,
}: {
  game: RoomGameState;
  player: PlayerId;
  onShare: () => void;
  onCopyCode: () => void;
  onBack: () => void;
  notice: string;
}) {
  const generationLabel = GENERATIONS.find((item) => item.id === game.generation)?.label ?? 'Todas';
  const ready = game.playerCount === 2;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>{'‹  VOLVER'}</Text>
      </Pressable>
      <View style={styles.panel}>
        <RetroPanelHeader title={ready ? 'PARTIDA LISTA' : 'CREAR PARTIDA'} />
        <Text style={styles.fieldLabel}>Generación: {generationLabel}</Text>
        <Text style={styles.codeLabel}>TU CÓDIGO DE SALA:</Text>
        <View style={styles.codeInput}>
          <Text selectable style={styles.roomCode}>
            {game.roomCode}
          </Text>
        </View>
        <View style={styles.roomActions}>
          <Button label="INVITAR (ENLACE)" onPress={onShare} variant="orange" />
          <Button label="COPIAR CÓDIGO" onPress={onCopyCode} variant="gray" />
        </View>
        {!!notice && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        )}
      </View>
      {ready ? (
        <View style={styles.readyPanel}>
          <Text style={styles.readyTitle}>¡SALA COMPLETA!</Text>
          <Text style={styles.readyText}>
            Los dos jugadores verán ahora la misma cuadrícula 5×5 y elegirán directamente su secreto.
          </Text>
        </View>
      ) : (
        <View style={styles.waitRoomPanel}>
          <Text style={styles.waitRoomTitle}>ESPERANDO AL OPONENTE…</Text>
          <Text style={styles.waitRoomText}>
            Pulsa INVITAR y envía el enlace a tu rival: al abrirlo entrará directamente. Cuando entre, ambos pasaréis
            solos a la elección.
          </Text>
          <View style={styles.waitDots}>
            <Text style={styles.waitDotGlyph}>●</Text>
            <Text style={styles.waitDotGlyph}>●</Text>
            <Text style={styles.waitDotGlyph}>●</Text>
          </View>
        </View>
      )}
      <Text style={styles.mutedCenter}>
        JUGADOR {player === 'p1' ? '1' : '2'} · {ready ? '2 / 2 CONECTADOS' : '1 / 2 CONECTADOS'}
      </Text>
    </ScrollView>
  );
}
