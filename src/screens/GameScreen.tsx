// Partida del Duelo y ventana de victoria.
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { getPokemon, PlayerId } from '../game/engine';
import { RoomGameState } from '../game/roomClient';
import { CreditsLink } from '../ui/CreditsModal';
import { BoardSection, Button, Portrait, ReconnectBanner, VersusStrip } from '../ui/components';
import { styles } from '../ui/appStyles';
import { SettingsButton } from '../ui/SettingsModal';

export function VictoryModal({
  game,
  player,
  onRematch,
}: {
  game: RoomGameState;
  player: PlayerId;
  onRematch: () => void;
}) {
  const winner = game.winner;
  const ownPokemon = getPokemon(game, game.players[player].secretId);
  const facts = ownPokemon ? (ownPokemon.facts ?? [ownPokemon.funFact ?? '']).filter(Boolean).slice(0, 3) : [];
  const won = winner === player;
  return (
    <Modal visible={game.phase === 'finished'} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.resultModalBackdrop}>
        <ScrollView contentContainerStyle={styles.resultModalScroll}>
          <View style={styles.resultPanel}>
            <Text style={styles.resultEmoji}>{won ? '✦' : '×'}</Text>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="assertive"
              aria-live="assertive"
              style={styles.resultTitle}
            >
              {won ? 'VICTORIA' : 'HAS PERDIDO'}
            </Text>
            <Text style={styles.resultText}>
              {won
                ? 'Has dejado una sola opción válida en tu tablero.'
                : 'El rival ha dejado una sola opción válida antes que tú.'}
            </Text>
            {ownPokemon && (
              <View style={styles.victoryHero}>
                <Portrait pokemon={ownPokemon} size={118} />
                <Text style={styles.victoryPokemonName}>TU POKÉMON · {ownPokemon.name}</Text>
                {facts.map((fact, index) => (
                  <Text key={`${ownPokemon.id}-hero-fact-${index}`} style={styles.victoryFact}>
                    {fact}
                  </Text>
                ))}
              </View>
            )}
            <Text style={styles.resultText}>
              {won ? 'El secreto rival ha sido descubierto.' : 'Tu Pokémon secreto ha sido descubierto.'}
            </Text>
            <View style={styles.winnerFact}>
              <Text style={styles.winnerFactTitle}>DATOS DE TU POKÉMON</Text>
              {ownPokemon?.description && <Text style={styles.winnerFactText}>{ownPokemon.description}</Text>}
              {facts.map((fact, index) => (
                <Text key={`${ownPokemon?.id ?? 'own'}-fact-${index}`} style={styles.winnerFactText}>
                  <Text style={styles.winnerFactStrong}>{index === 0 ? 'DATO CURIOSO: ' : '                 '}</Text>
                  {fact}
                </Text>
              ))}
            </View>
            <Button label="JUGAR DE NUEVO" onPress={onRematch} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function GameScreen({
  game,
  player,
  reduceMotion,
  onToggle,
  onBack,
  onRematch,
  onOpenSettings,
}: {
  game: RoomGameState;
  player: PlayerId;
  reduceMotion: boolean;
  onToggle: (player: PlayerId, id: number) => void;
  onBack: () => void;
  onRematch: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <>
      <ScrollView contentContainerStyle={styles.gameContent}>
        <View style={styles.gameTopbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salir de la sala"
            onPress={onBack}
            style={styles.topbarButton}
          >
            <Text style={styles.backText}>‹ SALIR</Text>
          </Pressable>
          <Text style={styles.gameRoom}>SALA {game.roomCode}</Text>
          <View style={[styles.turnPill, game.phase === 'finished' && styles.turnPillFinished]}>
            <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.turnText}>
              {game.phase === 'finished' ? 'FINAL' : 'EN JUEGO'}
            </Text>
          </View>
        </View>
        <ReconnectBanner game={game} player={player} />
        <BoardSection
          game={game}
          player={player}
          activePlayer={player}
          reduceMotion={reduceMotion}
          onToggle={(id) => onToggle(player, id)}
        />
        <VersusStrip game={game} activePlayer={player} />
        <BoardSection
          game={game}
          player={player === 'p1' ? 'p2' : 'p1'}
          activePlayer={player}
          reduceMotion={reduceMotion}
          onToggle={(id) => onToggle(player === 'p1' ? 'p2' : 'p1', id)}
        />
        <View style={styles.gameSettingsRow}>
          <SettingsButton onPress={onOpenSettings} label="AJUSTES · SONIDO Y TACHADO VISIBLE" />
        </View>
        <CreditsLink />
      </ScrollView>
      <VictoryModal game={game} player={player} onRematch={onRematch} />
    </>
  );
}
