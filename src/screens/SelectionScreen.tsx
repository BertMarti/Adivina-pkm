// Elección del Pokémon secreto.
import { ScrollView, Text, View } from 'react-native';
import { PlayerId } from '../game/engine';
import { RoomGameState } from '../game/roomClient';
import { CompactGrid } from '../ui/components';
import { styles } from '../ui/appStyles';

export function SelectionScreen({
  game,
  player,
  reduceMotion,
  onSelect,
}: {
  game: RoomGameState;
  player: PlayerId;
  reduceMotion: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.selectionContent}>
      <View style={styles.selectionHeader}>
        <Text style={styles.selectionTitle}>¡ELIGE TU POKÉMON{`\n`}SECRETO!</Text>
        <Text style={styles.selectionPlayer}>JUGADOR {player === 'p1' ? '1' : '2'} · SALA CONECTADA</Text>
        <Text style={styles.muted}>Toca una casilla de la cuadrícula 5×5. La elección se guarda al instante.</Text>
      </View>
      <View style={styles.selectionBoard}>
        <CompactGrid
          game={game}
          player={player}
          activePlayer={player}
          reduceMotion={reduceMotion}
          onToggle={() => {}}
          onSelect={onSelect}
          selectionId={game.players[player].secretId}
        />
      </View>
      <Text style={styles.selectionFootnote}>Cuando los dos elijáis, comenzará la partida automáticamente.</Text>
    </ScrollView>
  );
}
