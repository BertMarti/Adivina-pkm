// Piezas de interfaz del Duelo compartidas por varias pantallas.
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { PokemonCandidate } from '../data/pokemon';
import { getPokemon, getRemainingCount, PlayerId } from '../game/engine';
import { RoomGameState } from '../game/roomClient';
import { styles } from './appStyles';

export function RetroBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Image
        source={require('../../assets/spritecollab-background.png')}
        style={styles.backdropImage}
        resizeMode="cover"
        accessible={false}
      />
      <View style={styles.backdropTint} />
      <View style={styles.scanlines}>
        {Array.from({ length: 80 }, (_, index) => (
          <View key={index} style={styles.scanline} />
        ))}
      </View>
    </View>
  );
}

export function Portrait({
  pokemon,
  variant = 'happy',
  size = 52,
}: {
  pokemon: PokemonCandidate;
  variant?: 'happy' | 'sad' | 'normal';
  size?: number;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [pokemon.id, variant]);
  const sources =
    variant === 'sad'
      ? [pokemon.sadUrl, pokemon.normalUrl, pokemon.portraitUrl, pokemon.fallbackUrl]
      : variant === 'normal'
        ? [pokemon.normalUrl, pokemon.portraitUrl, pokemon.fallbackUrl]
        : [pokemon.portraitUrl, pokemon.normalUrl, pokemon.fallbackUrl];
  const uri = sources[Math.min(sourceIndex, sources.length - 1)];
  return (
    <View pointerEvents="none" style={[styles.portraitFrame, { width: size, height: size }]}>
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri }}
        onError={() => setSourceIndex((current) => Math.min(current + 1, sources.length - 1))}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <Text style={styles.dexBadge}>#{String(pokemon.id).padStart(3, '0')}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'orange' | 'gray' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'orange' && styles.buttonOrange,
        variant === 'gray' && styles.buttonGray,
        variant === 'ghost' && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'gray' || variant === 'secondary' ? styles.buttonTextLight : styles.buttonTextDark,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeader}>
      {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
      {detail && <Text style={styles.muted}>{detail}</Text>}
    </View>
  );
}

export function PokemonTile({
  pokemon,
  crossed,
  selected,
  interactive,
  reduceMotion,
  onPress,
}: {
  pokemon: PokemonCandidate;
  crossed: boolean;
  selected?: boolean;
  interactive: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const portraitSize = Math.max(38, Math.min(94, Math.round((Math.min(width, 720) - 42) * 0.15)));
  const progress = useRef(new Animated.Value(crossed ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(crossed ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: crossed ? 1 : 0,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [crossed, progress, reduceMotion]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pokemon.name}, ${crossed ? 'tachado' : selected ? 'seleccionado' : 'disponible'}`}
      accessibilityState={{ disabled: !interactive, selected: Boolean(selected) }}
      disabled={!interactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.tileSelected,
        crossed && styles.tileCrossed,
        pressed && styles.tilePressed,
      ]}
    >
      <Portrait pokemon={pokemon} variant={crossed ? 'sad' : 'happy'} size={portraitSize} />
      <Text numberOfLines={1} style={[styles.tileName, crossed && styles.tileNameCrossed]}>
        {pokemon.name}
      </Text>
      <Animated.View pointerEvents="none" style={[styles.crossOverlay, { opacity: progress, transform: [{ scale }] }]}>
        <View style={[styles.crossLine, styles.crossLineA]} />
        <View style={[styles.crossLine, styles.crossLineB]} />
      </Animated.View>
    </Pressable>
  );
}

export function CompactGrid({
  game,
  player,
  activePlayer,
  reduceMotion,
  onToggle,
  onSelect,
  selectionId,
}: {
  game: RoomGameState;
  player: PlayerId;
  activePlayer: PlayerId;
  reduceMotion: boolean;
  onToggle: (id: number) => void;
  onSelect?: (id: number) => void;
  selectionId?: number | null;
}) {
  const crossed = new Set(game.players[player].crossedIds);
  const selectionMode = Boolean(onSelect);
  const interactive = selectionMode || (game.phase === 'playing' && player === activePlayer);
  return (
    <View style={styles.grid}>
      {game.board.map((pokemon) => (
        <PokemonTile
          key={pokemon.id}
          pokemon={pokemon}
          crossed={!selectionMode && crossed.has(pokemon.id)}
          selected={selectionId === pokemon.id}
          interactive={interactive}
          reduceMotion={reduceMotion}
          onPress={() => (selectionMode ? onSelect?.(pokemon.id) : onToggle(pokemon.id))}
        />
      ))}
    </View>
  );
}

export function RetroPanelHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.retroPanelHeader}>
      <Text style={styles.retroPanelTitle}>{title}</Text>
      <View style={styles.retroPanelRule} />
      {detail && <Text style={styles.retroPanelDetail}>{detail}</Text>}
    </View>
  );
}

export function VersusPortrait({
  game,
  player,
  activePlayer,
}: {
  game: RoomGameState;
  player: PlayerId;
  activePlayer: PlayerId;
}) {
  const { width } = useWindowDimensions();
  const artSize = Math.max(82, Math.min(112, Math.round(width * 0.28)));
  const secret = getPokemon(game, game.players[player].secretId);
  const visible = player === activePlayer || game.phase === 'finished';
  return (
    <View style={styles.versusSide}>
      <View style={styles.versusLabel}>
        <Text style={styles.versusLabelText}>{player === activePlayer ? 'TÚ' : 'RIVAL'}</Text>
      </View>
      <View style={[styles.versusArt, { width: artSize, height: artSize, borderRadius: Math.round(artSize * 0.1) }]}>
        {visible && secret ? (
          <Portrait pokemon={secret} size={Math.round(artSize * 0.84)} />
        ) : (
          <Text style={styles.questionMark}>?</Text>
        )}
      </View>
      {visible && secret && <Text style={styles.versusName}>{secret.name}</Text>}
    </View>
  );
}

export function VersusStrip({ game, activePlayer }: { game: RoomGameState; activePlayer: PlayerId }) {
  return (
    <View style={styles.versusStrip}>
      <VersusPortrait game={game} player={activePlayer} activePlayer={activePlayer} />
      <View style={styles.vsMark}>
        <Text style={styles.vsMarkText}>VS</Text>
      </View>
      <VersusPortrait game={game} player={activePlayer === 'p1' ? 'p2' : 'p1'} activePlayer={activePlayer} />
    </View>
  );
}

export function BoardSection({
  game,
  player,
  activePlayer,
  reduceMotion,
  onToggle,
}: {
  game: RoomGameState;
  player: PlayerId;
  activePlayer: PlayerId;
  reduceMotion: boolean;
  onToggle: (id: number) => void;
}) {
  const isMine = player === activePlayer;
  const remaining = getRemainingCount(game, player);
  return (
    <View style={styles.boardSection}>
      <RetroPanelHeader title={isMine ? 'MI TABLERO' : 'TABLERO RIVAL'} detail={`${remaining} POKÉMON LIBRES`} />
      <View style={[styles.boardPanel, isMine && styles.boardPanelMine]}>
        <CompactGrid
          game={game}
          player={player}
          activePlayer={activePlayer}
          reduceMotion={reduceMotion}
          onToggle={onToggle}
        />
      </View>
      <Text style={styles.boardHint}>
        {isMine
          ? 'Tacha todos menos el secreto del rival para ganar. Puedes destachar.'
          : 'El tablero rival solo se puede consultar'}
      </Text>
    </View>
  );
}

export function PokeballCapture({ pokemon, reduceMotion }: { pokemon?: PokemonCandidate; reduceMotion: boolean }) {
  const pokeballSource = reduceMotion
    ? require('../../assets/pokeball-capture-static.png')
    : require('../../assets/pokeball-capture.gif');
  return (
    <View style={styles.captureStage}>
      <View style={styles.captureTarget}>
        <Text style={styles.captureTargetLabel}>TU SECRETO</Text>
        <View style={styles.captureSpriteFrame}>
          {pokemon ? (
            <Portrait pokemon={pokemon} variant="normal" size={64} />
          ) : (
            <Text style={styles.captureQuestion}>?</Text>
          )}
        </View>
        <Text numberOfLines={1} style={styles.captureTargetName}>
          {pokemon?.name ?? 'SECRETO GUARDADO'}
        </Text>
      </View>
      <View accessibilityLabel="Conexión de sala en espera" style={styles.captureConnector}>
        <View style={styles.captureSignalLine} />
        <View style={styles.captureSignalNode} />
        <View style={[styles.captureSignalNode, styles.captureSignalNodeActive]} />
        <View style={styles.captureSignalNode} />
        <View style={styles.captureSignalLine} />
      </View>
      <View style={styles.pokeballTrack}>
        <Image
          source={pokeballSource}
          accessibilityLabel="Poké Ball pixelada esperando al oponente"
          resizeMode="contain"
          style={styles.pokeballGif}
        />
      </View>
    </View>
  );
}

export function PokemonInfo({ pokemon, playerLabel }: { pokemon?: PokemonCandidate; playerLabel: string }) {
  if (!pokemon) return null;
  const description =
    pokemon.description ?? `${pokemon.name} es un Pokémon de tipo ${pokemon.types.join(' y ').toLowerCase()}.`;
  const facts = (
    pokemon.facts ?? [
      pokemon.funFact ??
        `Pesa ${pokemon.weightKg.toLocaleString('es-ES')} kg y ocupa el número ${pokemon.id} de la Pokédex Nacional.`,
    ]
  ).slice(0, 3);
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIdentity}>
        <Portrait pokemon={pokemon} size={58} />
        <View style={styles.infoName}>
          <Text style={styles.statusLabel}>{playerLabel}</Text>
          <Text style={styles.infoTitle}>{pokemon.name}</Text>
        </View>
      </View>
      <Text style={styles.infoDescription}>{description}</Text>
      {facts.map((fact, index) => (
        <Text key={`${pokemon.id}-info-fact-${index}`} style={styles.infoFact}>
          <Text style={styles.infoFactLabel}>{index === 0 ? 'DATOS: ' : '          '}</Text>
          {fact}
        </Text>
      ))}
    </View>
  );
}

export function ReconnectBanner({ game, player }: { game: RoomGameState; player: PlayerId }) {
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    if (!game.reconnectDeadline || !game.disconnectedPlayer) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((game.reconnectDeadline! - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [game.reconnectDeadline, game.disconnectedPlayer]);
  if (!game.disconnectedPlayer || game.abandonedPlayer || game.phase === 'finished') return null;
  const self = game.disconnectedPlayer === player;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.disconnectBanner}>
      <Text style={styles.disconnectTitle}>{self ? 'TE HAS DESCONECTADO' : 'EL RIVAL SE HA DESCONECTADO'}</Text>
      <Text style={styles.disconnectText}>
        {self ? `Reconectando… ${seconds} s` : `Le esperamos ${seconds} s. Si vuelve, la partida sigue donde estaba.`}
      </Text>
    </View>
  );
}
