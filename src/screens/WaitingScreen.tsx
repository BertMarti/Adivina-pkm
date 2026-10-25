// Espera a que el rival elija.
import { Image, ScrollView, Text, View } from 'react-native';
import { getPokemon, PlayerId } from '../game/engine';
import { RoomGameState } from '../game/roomClient';
import { PokeballCapture, Portrait } from '../ui/components';
import { styles } from '../ui/appStyles';

export function WaitingScreen({
  game,
  player,
  reduceMotion,
}: {
  game: RoomGameState;
  player: PlayerId;
  reduceMotion: boolean;
}) {
  const pokemon = getPokemon(game, game.players[player].secretId);
  return (
    <ScrollView contentContainerStyle={styles.waitingContent}>
      <View style={styles.waitingPanel}>
        <View style={styles.waitingTopline}>
          <Text style={styles.waitingEyebrow}>SALA · LISTA</Text>
          <View style={styles.waitingLivePill}>
            <View style={styles.waitingLiveDot} />
            <Text style={styles.waitingLiveText}>EN ESPERA</Text>
          </View>
        </View>
        <Text style={styles.waitingTitle}>ESPERANDO{`\n`}AL OPONENTE…</Text>
        <Text style={styles.waitingText}>
          Tu elección está guardada. El otro jugador todavía debe elegir su Pokémon secreto.
        </Text>
        <View style={styles.waitingDivider} />
        <PokeballCapture pokemon={pokemon} reduceMotion={reduceMotion} />
        <View style={styles.waitingSecret}>
          <Text style={styles.statusLabel}>TU POKÉMON SECRETO</Text>
          <View style={styles.waitingSecretRow}>
            {pokemon ? (
              <Portrait pokemon={pokemon} variant="normal" size={54} />
            ) : (
              <Text style={styles.captureQuestion}>?</Text>
            )}
            <Text style={styles.waitingSecretName}>{pokemon?.name ?? 'Secreto guardado'}</Text>
            <Text accessibilityLabel="Elección guardada" style={styles.waitingSecretCheck}>
              ✓
            </Text>
          </View>
        </View>
        <View style={styles.waitingTip}>
          <Text style={styles.waitingTipTitle}>CUANDO AMBOS ESTÉIS LISTOS</Text>
          <Text style={styles.waitingHint}>La partida comenzará automáticamente.</Text>
        </View>
        <Image
          source={require('../../assets/pikachu-flight.gif')}
          accessibilityLabel="Pikachu volando mientras espera al rival"
          resizeMode="contain"
          style={styles.pikachuWaiting}
        />
      </View>
    </ScrollView>
  );
}
