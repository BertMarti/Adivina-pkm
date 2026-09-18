import { useAudioPlayer } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { PressStart2P_400Regular, useFonts } from '@expo-google-fonts/press-start-2p';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GENERATIONS,
  GenerationId,
  LOCAL_KANTO_ROSTER,
  PokemonCandidate,
  loadRoster,
} from './src/data/pokemon';
import { getPokemon, getRemainingCount, PlayerId } from './src/game/engine';
import { RoomClient, RoomGameState } from './src/game/roomClient';
import { CROSS_WAV } from './src/audio/sounds';
import { SinglePlayerScreen } from './src/singlePlayer/SinglePlayerScreen';

type Screen = 'home' | 'room' | 'selection' | 'waiting' | 'game' | 'single-player';
type SoundKind = 'select' | 'cross' | 'restore' | 'victory' | 'defeat';

const COLORS = {
  ink: '#111128',
  background: '#05070B',
  panel: '#1D1E2A',
  panelLight: '#262736',
  yellow: '#FFD000',
  orange: '#F06B00',
  cyan: '#4C6BE8',
  white: '#F6F5EF',
  muted: '#A7A8B2',
  danger: '#FF5F67',
  success: '#38D37D',
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRoomCode() {
  const values = new Uint32Array(8);
  const hasCrypto = Boolean(globalThis.crypto?.getRandomValues);
  if (hasCrypto) globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => ALPHABET[(hasCrypto ? value : Math.floor(Math.random() * 0xffffffff)) % ALPHABET.length]).join('');
}

function inviteLinkFor(roomCode: string) {
  const encodedCode = encodeURIComponent(roomCode);
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/?room=${encodedCode}`;
  return `pokequien://join?room=${encodedCode}`;
}

function roomCodeFromUrl(url: string | null) {
  if (!url) return '';
  const match = url.match(/[?&]room=([A-Za-z0-9]+)/i);
  return match?.[1]?.toUpperCase() ?? '';
}

function getScreenForState(state: RoomGameState, player: PlayerId): Screen {
  if (state.phase === 'abandoned') return 'home';
  if (state.phase === 'waiting-for-player') return 'room';
  if (state.phase === 'selecting') return 'selection';
  if (state.phase === 'waiting-for-selection') return state.players[player].secretId === null ? 'selection' : 'waiting';
  return 'game';
}

const PIXEL_FONT = 'PressStart2P_400Regular';

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduceMotion(value)).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduceMotion;
}

function useGameSounds() {
  const selectionReferencePlayer = useAudioPlayer(require('./assets/selection-reference.wav'));
  const crossPlayer = useAudioPlayer({ uri: `data:audio/wav;base64,${CROSS_WAV}` });
  const victoryPlayer = useAudioPlayer(require('./assets/victory-reference.wav'));
  const defeatPlayer = useAudioPlayer(require('./assets/defeat-reference.wav'));
  const webContext = useRef<any>(null);
  const lastVictoryAt = useRef(0);

  const playWebTone = (kind: SoundKind) => {
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
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
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
        gain.gain.exponentialRampToValueAtTime(0.1, start + 0.015);
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
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'cross' ? 0.14 : 0.1));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === 'cross' ? 0.15 : 0.11));
  };

  return (kind: SoundKind) => {
    if (kind === 'victory' || kind === 'defeat') {
      const now = Date.now();
      if (now - lastVictoryAt.current < 1800) return;
      lastVictoryAt.current = now;
    }
    const player = kind === 'cross' ? crossPlayer : kind === 'victory' ? victoryPlayer : kind === 'defeat' ? defeatPlayer : selectionReferencePlayer;
    const playNative = () => void player.seekTo(0).catch(() => {}).finally(() => player.play());
    try {
      playNative();
    } catch {
      playWebTone(kind);
    }
    if (Platform.OS === 'web') return;
    if (kind === 'victory') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (kind === 'defeat') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (kind === 'select' || kind === 'restore') void Haptics.selectionAsync().catch(() => {});
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
}

function RetroBackdrop() {
  return <View pointerEvents="none" style={styles.backdrop}><ImageBackground source={require('./assets/spritecollab-background.png')} style={styles.backdropImage} resizeMode="cover" /><View style={styles.backdropTint} /><View style={styles.scanlines}>{Array.from({ length: 80 }, (_, index) => <View key={index} style={styles.scanline} />)}</View></View>;
}

function Portrait({ pokemon, variant = 'happy', size = 52 }: { pokemon: PokemonCandidate; variant?: 'happy' | 'sad' | 'normal'; size?: number }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [pokemon.id, variant]);
  const sources = variant === 'sad'
    ? [pokemon.sadUrl, pokemon.normalUrl, pokemon.portraitUrl, pokemon.fallbackUrl]
    : variant === 'normal'
      ? [pokemon.normalUrl, pokemon.portraitUrl, pokemon.fallbackUrl]
      : [pokemon.portraitUrl, pokemon.normalUrl, pokemon.fallbackUrl];
  const uri = sources[Math.min(sourceIndex, sources.length - 1)];
  return <View pointerEvents="none" style={[styles.portraitFrame, { width: size, height: size }]}><Image accessibilityIgnoresInvertColors source={{ uri }} onError={() => setSourceIndex((current) => Math.min(current + 1, sources.length - 1))} style={{ width: size, height: size }} resizeMode="contain" /><Text style={styles.dexBadge}>#{String(pokemon.id).padStart(3, '0')}</Text></View>;
}

function Button({ label, onPress, variant = 'primary', disabled = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'orange' | 'gray' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, variant === 'primary' && styles.buttonPrimary, variant === 'secondary' && styles.buttonSecondary, variant === 'orange' && styles.buttonOrange, variant === 'gray' && styles.buttonGray, variant === 'ghost' && styles.buttonGhost, disabled && styles.buttonDisabled, pressed && !disabled && styles.pressed]}>
      <Text style={[styles.buttonText, variant === 'gray' || variant === 'secondary' ? styles.buttonTextLight : styles.buttonTextDark]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <View style={styles.sectionHeader}>{!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}<Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionRule} />{detail && <Text style={styles.muted}>{detail}</Text>}</View>;
}

function PokemonTile({ pokemon, crossed, selected, interactive, reduceMotion, onPress }: { pokemon: PokemonCandidate; crossed: boolean; selected?: boolean; interactive: boolean; reduceMotion: boolean; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const portraitSize = Math.max(38, Math.min(94, Math.round((Math.min(width, 720) - 42) * 0.15)));
  const progress = useRef(new Animated.Value(crossed ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(crossed ? 1 : 0);
      return;
    }
    Animated.timing(progress, { toValue: crossed ? 1 : 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [crossed, progress, reduceMotion]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${pokemon.name}, ${crossed ? 'tachado' : selected ? 'seleccionado' : 'disponible'}`} accessibilityState={{ disabled: !interactive, selected: Boolean(selected) }} disabled={!interactive} onPress={onPress} style={({ pressed }) => [styles.tile, selected && styles.tileSelected, crossed && styles.tileCrossed, pressed && styles.tilePressed]}>
      <Portrait pokemon={pokemon} variant={crossed ? 'sad' : 'happy'} size={portraitSize} />
      <Text numberOfLines={1} style={[styles.tileName, crossed && styles.tileNameCrossed]}>{pokemon.name}</Text>
      <Animated.View pointerEvents="none" style={[styles.crossOverlay, { opacity: progress, transform: [{ scale }] }]}>
        <View style={[styles.crossLine, styles.crossLineA]} />
        <View style={[styles.crossLine, styles.crossLineB]} />
      </Animated.View>
    </Pressable>
  );
}

function CompactGrid({ game, player, activePlayer, reduceMotion, onToggle, onSelect, selectionId }: { game: RoomGameState; player: PlayerId; activePlayer: PlayerId; reduceMotion: boolean; onToggle: (id: number) => void; onSelect?: (id: number) => void; selectionId?: number | null }) {
  const crossed = new Set(game.players[player].crossedIds);
  const selectionMode = Boolean(onSelect);
  const interactive = selectionMode || (game.phase === 'playing' && player === activePlayer);
  return <View style={styles.grid}>{game.board.map((pokemon) => <PokemonTile key={pokemon.id} pokemon={pokemon} crossed={!selectionMode && crossed.has(pokemon.id)} selected={selectionId === pokemon.id} interactive={interactive} reduceMotion={reduceMotion} onPress={() => selectionMode ? onSelect?.(pokemon.id) : onToggle(pokemon.id)} />)}</View>;
}

function RetroPanelHeader({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.retroPanelHeader}><Text style={styles.retroPanelTitle}>{title}</Text><View style={styles.retroPanelRule} />{detail && <Text style={styles.retroPanelDetail}>{detail}</Text>}</View>;
}

function VersusPortrait({ game, player, activePlayer }: { game: RoomGameState; player: PlayerId; activePlayer: PlayerId }) {
  const { width } = useWindowDimensions();
  const artSize = Math.max(82, Math.min(112, Math.round(width * 0.28)));
  const secret = getPokemon(game, game.players[player].secretId);
  const visible = player === activePlayer || game.phase === 'finished';
  return <View style={styles.versusSide}><View style={styles.versusLabel}><Text style={styles.versusLabelText}>{player === activePlayer ? 'TÚ' : 'RIVAL'}</Text></View><View style={[styles.versusArt, { width: artSize, height: artSize, borderRadius: Math.round(artSize * 0.1) }]}>{visible && secret ? <Portrait pokemon={secret} size={Math.round(artSize * 0.84)} /> : <Text style={styles.questionMark}>?</Text>}</View>{visible && secret && <Text style={styles.versusName}>{secret.name}</Text>}</View>;
}

function VersusStrip({ game, activePlayer }: { game: RoomGameState; activePlayer: PlayerId }) {
  return <View style={styles.versusStrip}><VersusPortrait game={game} player={activePlayer} activePlayer={activePlayer} /><View style={styles.vsMark}><Text style={styles.vsMarkText}>VS</Text></View><VersusPortrait game={game} player={activePlayer === 'p1' ? 'p2' : 'p1'} activePlayer={activePlayer} /></View>;
}

function BoardSection({ game, player, activePlayer, reduceMotion, onToggle }: { game: RoomGameState; player: PlayerId; activePlayer: PlayerId; reduceMotion: boolean; onToggle: (id: number) => void }) {
  const isMine = player === activePlayer;
  const remaining = getRemainingCount(game, player);
  return <View style={styles.boardSection}><RetroPanelHeader title={isMine ? 'MI TABLERO' : 'TABLERO RIVAL'} detail={`${remaining} POKÉMON LIBRES`} /><View style={[styles.boardPanel, isMine && styles.boardPanelMine]}><CompactGrid game={game} player={player} activePlayer={activePlayer} reduceMotion={reduceMotion} onToggle={onToggle} /></View><Text style={styles.boardHint}>{isMine ? 'Tacha todos menos el secreto del rival para ganar. Puedes destachar.' : 'El tablero rival solo se puede consultar'}</Text></View>;
}

function HomeScreen({ generation, setGeneration, onCreate, onJoin, onDemo, onCopyInvite, onSolo, inviteCode, joinCode, setJoinCode, loading, error, reduceMotion }: { generation: GenerationId; setGeneration: (generation: GenerationId) => void; onCreate: () => void; onJoin: () => void; onDemo: () => void; onCopyInvite: () => void; onSolo: () => void; inviteCode: string; joinCode: string; setJoinCode: (value: string) => void; loading: boolean; error: string; reduceMotion: boolean }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      float.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(float, { toValue: 0, duration: 1700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [float, reduceMotion]);
  const logoY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  return <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><Animated.Text style={[styles.logo, { transform: [{ translateY: logoY }] }]} accessibilityRole="header">POKÉ{`\n`}QUIÉN</Animated.Text><Text style={styles.heroSubtitle}>ADIVINA EL SECRETO · DUELO PIXEL</Text></View>
    <View style={styles.panel}><RetroPanelHeader title="CREAR PARTIDA" /><Text style={styles.fieldLabel}>Generación:</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.generationRow}>{GENERATIONS.map((item) => <Pressable key={String(item.id)} accessibilityRole="radio" accessibilityLabel={`Generación ${item.label}`} accessibilityState={{ selected: generation === item.id }} onPress={() => setGeneration(item.id)} style={[styles.generationChip, generation === item.id && styles.generationChipActive]}><Text style={[styles.generationText, generation === item.id && styles.generationTextActive]}>{item.id === 'all' ? '🎲  Todas (Aleatorio)' : item.label}</Text></Pressable>)}</ScrollView><Text style={styles.codeLabel}>TU CÓDIGO DE SALA:</Text><View style={styles.codeInput}><Text selectable style={styles.roomCode}>{inviteCode}</Text></View><Button label="COPIAR ENLACE" onPress={onCopyInvite} variant="orange" disabled={loading} /><Button label={loading ? 'CARGANDO POKÉDEX…' : 'CREAR SALA'} onPress={onCreate} disabled={loading} /></View>
    <View style={styles.panel}><RetroPanelHeader title="UNIRSE A PARTIDA" /><Text style={styles.fieldLabel}>Introduce el código de tu rival:</Text><TextInput accessibilityLabel="Código de sala" autoCapitalize="characters" autoCorrect={false} maxLength={8} onChangeText={(value) => setJoinCode(value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} placeholder="EJ. A1B2C" placeholderTextColor="#777986" style={styles.input} value={joinCode} /><Button label={loading ? 'CONECTANDO…' : 'CONECTAR'} onPress={onJoin} variant="primary" disabled={loading} /></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Jugar contra la máquina" onPress={onSolo} style={({ pressed }) => [styles.soloCta, pressed && styles.pressed]}>
      <Text style={styles.soloCtaKicker}>MODO SOLITARIO</Text>
      <Text style={styles.soloCtaTitle}>JUGAR CONTRA LA MÁQUINA</Text>
      <Text style={styles.soloCtaText}>Responde solo SÍ o NO y deja que la Pokédex te descubra.</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onDemo} style={styles.demoLink}><Text style={styles.demoLinkText}>▶  CREAR SALA DE PRUEBA KANTO</Text><Text style={styles.muted}>Crea una sala rápida para abrirla en dos pestañas.</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Text style={styles.credits}>Inspirado por Checo_512 · Retratos: SpriteCollab PMD{`\n`}Fan project no oficial · Datos: PokéAPI</Text>
  </ScrollView>;
}

function RoomScreen({ game, player, onShare, onCopyCode, onBack }: { game: RoomGameState; player: PlayerId; onShare: () => void; onCopyCode: () => void; onBack: () => void }) {
  const generationLabel = GENERATIONS.find((item) => item.id === game.generation)?.label ?? 'Todas';
  const ready = game.playerCount === 2;
  return <ScrollView contentContainerStyle={styles.scrollContent}><Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹  VOLVER</Text></Pressable><View style={styles.panel}><RetroPanelHeader title={ready ? 'PARTIDA LISTA' : 'CREAR PARTIDA'} /><Text style={styles.fieldLabel}>Generación: {generationLabel}</Text><Text style={styles.codeLabel}>TU CÓDIGO DE SALA:</Text><View style={styles.codeInput}><Text selectable style={styles.roomCode}>{game.roomCode}</Text></View><View style={styles.roomActions}><Button label="COPIAR CÓDIGO" onPress={onCopyCode} variant="gray" /><Button label="COPIAR ENLACE" onPress={onShare} variant="orange" /></View></View>{ready ? <View style={styles.readyPanel}><Text style={styles.readyTitle}>¡SALA COMPLETA!</Text><Text style={styles.readyText}>Los dos jugadores verán ahora la misma cuadrícula 5×5 y elegirán directamente su secreto.</Text></View> : <View style={styles.waitRoomPanel}><Text style={styles.waitRoomTitle}>ESPERANDO AL OPONENTE…</Text><Text style={styles.waitRoomText}>Comparte el código con tu rival. Cuando entre, ambos pasaréis automáticamente a la elección.</Text><View style={styles.waitDots}><Text style={styles.waitDotGlyph}>●</Text><Text style={styles.waitDotGlyph}>●</Text><Text style={styles.waitDotGlyph}>●</Text></View></View>}<Text style={styles.mutedCenter}>JUGADOR {player === 'p1' ? '1' : '2'} · {ready ? '2 / 2 CONECTADOS' : '1 / 2 CONECTADOS'}</Text></ScrollView>;
}

function PokeballCapture({ pokemon, reduceMotion }: { pokemon?: PokemonCandidate; reduceMotion: boolean }) {
  const pokeballSource = reduceMotion
    ? require('./assets/pokeball-capture-static.png')
    : require('./assets/pokeball-capture.gif');
  return <View style={styles.captureStage}>
    <View style={styles.captureTarget}>
      <View style={styles.captureTargetGlow} />
      {pokemon ? <Portrait pokemon={pokemon} variant="normal" size={76} /> : <Text style={styles.captureQuestion}>?</Text>}
    </View>
    <View style={styles.captureConnector}>
      <View style={styles.captureLine} />
      <Text style={styles.captureArrow}>›</Text>
    </View>
    <View style={styles.pokeballTrack}>
      <Image
        source={pokeballSource}
        accessibilityLabel="Poké Ball pixelada esperando al oponente"
        resizeMode="contain"
        style={styles.pokeballGif}
      />
    </View>
  </View>;
}

function SelectionScreen({ game, player, reduceMotion, onSelect }: { game: RoomGameState; player: PlayerId; reduceMotion: boolean; onSelect: (id: number) => void }) {
  return <ScrollView contentContainerStyle={styles.selectionContent}><View style={styles.selectionHeader}><Text style={styles.selectionTitle}>¡ELIGE TU POKÉMON{`\n`}SECRETO!</Text><Text style={styles.selectionPlayer}>JUGADOR {player === 'p1' ? '1' : '2'} · SALA CONECTADA</Text><Text style={styles.muted}>Toca una casilla de la cuadrícula 5×5. La elección se guarda al instante.</Text></View><View style={styles.selectionBoard}><CompactGrid game={game} player={player} activePlayer={player} reduceMotion={reduceMotion} onToggle={() => {}} onSelect={onSelect} selectionId={game.players[player].secretId} /></View><Text style={styles.selectionFootnote}>Cuando los dos elijáis, comenzará la partida automáticamente.</Text></ScrollView>;
}

function WaitingScreen({ game, player, reduceMotion }: { game: RoomGameState; player: PlayerId; reduceMotion: boolean }) {
  const pokemon = getPokemon(game, game.players[player].secretId);
  return <ScrollView contentContainerStyle={styles.waitingContent}>
    <View style={styles.waitingPanel}>
      <View style={styles.waitingTopline}>
        <Text style={styles.waitingEyebrow}>SALA · LISTA</Text>
        <View style={styles.waitingLivePill}><View style={styles.waitingLiveDot} /><Text style={styles.waitingLiveText}>EN ESPERA</Text></View>
      </View>
      <Text style={styles.waitingTitle}>ESPERANDO{`\n`}AL OPONENTE…</Text>
      <Text style={styles.waitingText}>Tu elección está guardada. El otro jugador todavía debe elegir su Pokémon secreto.</Text>
      <View style={styles.waitingDivider} />
      <PokeballCapture pokemon={pokemon} reduceMotion={reduceMotion} />
      <View style={styles.waitingSecret}>
        <Text style={styles.statusLabel}>TU POKÉMON SECRETO</Text>
        <View style={styles.waitingSecretRow}>
          {pokemon ? <Portrait pokemon={pokemon} variant="normal" size={54} /> : <Text style={styles.captureQuestion}>?</Text>}
          <Text style={styles.waitingSecretName}>{pokemon?.name ?? 'Secreto guardado'}</Text>
          <Text accessibilityLabel="Elección guardada" style={styles.waitingSecretCheck}>✓</Text>
        </View>
      </View>
      <View style={styles.waitingTip}>
        <Text style={styles.waitingTipTitle}>CUANDO AMBOS ESTÉIS LISTOS</Text>
        <Text style={styles.waitingHint}>La partida comenzará automáticamente.</Text>
      </View>
      <Image source={require('./assets/pikachu-flight.gif')} accessibilityLabel="Pikachu volando mientras espera al rival" resizeMode="contain" style={styles.pikachuWaiting} />
    </View>
  </ScrollView>;
}

function PokemonInfo({ pokemon, playerLabel }: { pokemon?: PokemonCandidate; playerLabel: string }) {
  if (!pokemon) return null;
  const description = pokemon.description ?? `${pokemon.name} es un Pokémon de tipo ${pokemon.types.join(' y ').toLowerCase()}.`;
  const facts = (pokemon.facts ?? [pokemon.funFact ?? `Pesa ${pokemon.weightKg.toLocaleString('es-ES')} kg y ocupa el número ${pokemon.id} de la Pokédex Nacional.`]).slice(0, 3);
  return <View style={styles.infoCard}><View style={styles.infoIdentity}><Portrait pokemon={pokemon} size={58} /><View style={styles.infoName}><Text style={styles.statusLabel}>{playerLabel}</Text><Text style={styles.infoTitle}>{pokemon.name}</Text></View></View><Text style={styles.infoDescription}>{description}</Text>{facts.map((fact, index) => <Text key={`${pokemon.id}-info-fact-${index}`} style={styles.infoFact}><Text style={styles.infoFactLabel}>{index === 0 ? 'DATOS: ' : '          '}</Text>{fact}</Text>)}</View>;
}

function ReconnectBanner({ game, player }: { game: RoomGameState; player: PlayerId }) {
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    if (!game.reconnectDeadline || !game.disconnectedPlayer) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((game.reconnectDeadline! - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [game.reconnectDeadline, game.disconnectedPlayer]);
  if (!game.disconnectedPlayer || game.abandonedPlayer || game.phase === 'finished') return null;
  const disconnectedLabel = game.disconnectedPlayer === player ? 'TÚ' : 'EL RIVAL';
  return <View accessibilityLiveRegion="polite" style={styles.disconnectBanner}><Text style={styles.disconnectTitle}>{disconnectedLabel} DESCONECTADO</Text><Text style={styles.disconnectText}>Esperando una reconexión… {seconds}s</Text></View>;
}

function VictoryModal({ game, player, onRematch }: { game: RoomGameState; player: PlayerId; onRematch: () => void }) {
  const winner = game.winner;
  const ownPokemon = getPokemon(game, game.players[player].secretId);
  const facts = ownPokemon ? (ownPokemon.facts ?? [ownPokemon.funFact ?? '']).filter(Boolean).slice(0, 3) : [];
  const won = winner === player;
  return <Modal visible={game.phase === 'finished'} transparent animationType="fade" onRequestClose={() => {}}>
    <View style={styles.resultModalBackdrop}>
      <ScrollView contentContainerStyle={styles.resultModalScroll}>
        <View style={styles.resultPanel}>
          <Text style={styles.resultEmoji}>{won ? '✦' : '×'}</Text>
          <Text style={styles.resultTitle}>{won ? 'VICTORIA' : 'HAS PERDIDO'}</Text>
          <Text style={styles.resultText}>{won ? 'Has dejado una sola opción válida en tu tablero.' : 'El rival ha dejado una sola opción válida antes que tú.'}</Text>
          {ownPokemon && <View style={styles.victoryHero}><Portrait pokemon={ownPokemon} size={118} /><Text style={styles.victoryPokemonName}>TU POKÉMON · {ownPokemon.name}</Text>{facts.map((fact, index) => <Text key={`${ownPokemon.id}-hero-fact-${index}`} style={styles.victoryFact}>{fact}</Text>)}</View>}
          <Text style={styles.resultText}>{won ? 'El secreto rival ha sido descubierto.' : 'Tu Pokémon secreto ha sido descubierto.'}</Text>
          <View style={styles.winnerFact}><Text style={styles.winnerFactTitle}>DATOS DE TU POKÉMON</Text>{ownPokemon?.description && <Text style={styles.winnerFactText}>{ownPokemon.description}</Text>}{facts.map((fact, index) => <Text key={`${ownPokemon?.id ?? 'own'}-fact-${index}`} style={styles.winnerFactText}><Text style={styles.winnerFactStrong}>{index === 0 ? 'DATO CURIOSO: ' : '                 '}</Text>{fact}</Text>)}</View>
          <Button label="JUGAR DE NUEVO" onPress={onRematch} />
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

function GameScreen({ game, player, reduceMotion, onToggle, onBack, onRematch }: { game: RoomGameState; player: PlayerId; reduceMotion: boolean; onToggle: (player: PlayerId, id: number) => void; onBack: () => void; onRematch: () => void }) {
  return <>
    <ScrollView contentContainerStyle={styles.gameContent}>
      <View style={styles.gameTopbar}><Pressable accessibilityRole="button" onPress={onBack} style={styles.topbarButton}><Text style={styles.backText}>‹ SALIR</Text></Pressable><Text style={styles.gameRoom}>SALA {game.roomCode}</Text><View style={[styles.turnPill, game.phase === 'finished' && styles.turnPillFinished]}><Text style={styles.turnText}>{game.phase === 'finished' ? 'FINAL' : 'EN JUEGO'}</Text></View></View>
      <ReconnectBanner game={game} player={player} />
      <BoardSection game={game} player={player} activePlayer={player} reduceMotion={reduceMotion} onToggle={(id) => onToggle(player, id)} />
      <VersusStrip game={game} activePlayer={player} />
      <BoardSection game={game} player={player === 'p1' ? 'p2' : 'p1'} activePlayer={player} reduceMotion={reduceMotion} onToggle={(id) => onToggle(player === 'p1' ? 'p2' : 'p1', id)} />
      <Text style={styles.credits}>Tachado: sonido local · Retratos: SpriteCollab PMD · No oficial</Text>
    </ScrollView>
    <VictoryModal game={game} player={player} onRematch={onRematch} />
  </>;
}

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const [screen, setScreen] = useState<Screen>('home');
  const [generation, setGeneration] = useState<GenerationId>('all');
  const [inviteCode, setInviteCode] = useState(() => createRoomCode());
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [game, setGame] = useState<RoomGameState | null>(null);
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [roster, setRoster] = useState<PokemonCandidate[]>(LOCAL_KANTO_ROSTER);
  const reduceMotion = useReduceMotion();
  const playSound = useGameSounds();
  const roomClientRef = useRef<RoomClient | null>(null);
  const previousPhaseRef = useRef<RoomGameState['phase'] | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'PokéQuién · Duelo Pixel';
    }
  }, []);

  const applyState = (nextGame: RoomGameState, nextPlayer: PlayerId) => {
    setGame(nextGame);
    setPlayer(nextPlayer);
    setGeneration(nextGame.generation);
    setScreen(getScreenForState(nextGame, nextPlayer));
  };

  const getClient = () => {
    if (!roomClientRef.current) {
      roomClientRef.current = new RoomClient((nextGame, nextPlayer) => {
        setError(nextGame.phase === 'abandoned'
          ? `La partida terminó: ${nextGame.abandonedPlayer === nextPlayer ? 'has abandonado la sala' : 'el rival abandonó la partida'}.`
          : '');
        applyState(nextGame, nextPlayer);
      }, (message) => {
        setError(message);
        if (message.includes('no se reconectó') || message.includes('reconexión ha terminado')) {
          roomClientRef.current?.close({ forgetSession: true });
          roomClientRef.current = null;
          setGame(null);
          setPlayer(null);
          setScreen('home');
        }
      });
    }
    return roomClientRef.current;
  };

  useEffect(() => () => roomClientRef.current?.close(), []);

  useEffect(() => {
    const phase = game?.phase ?? null;
    if (phase === 'finished' && previousPhaseRef.current !== 'finished' && game?.winner && player) {
      playSound(game.winner === player ? 'victory' : 'defeat');
    }
    previousPhaseRef.current = phase;
  }, [game?.phase, playSound]);

  const createRoom = async (nextGeneration = generation): Promise<RoomGameState | null> => {
    setError('');
    setLoading(true);
    try {
      const nextRoster = await loadRoster(nextGeneration);
      setRoster(nextRoster);
      const nextCode = inviteCode;
      const nextGame = await getClient().create(nextCode, nextGeneration, nextRoster);
      setInviteCode(createRoomCode());
      applyState(nextGame, getClient().playerId ?? 'p1');
      return nextGame;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la sala.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const joinRoomByCode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Escribe un identificador de sala de al menos 4 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const nextGame = await getClient().join(code);
      setRoster(nextGame.board);
      applyState(nextGame, getClient().playerId ?? 'p2');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo entrar en la sala.');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => void joinRoomByCode(joinCode);

  useEffect(() => {
    const joinFromUrl = (url: string | null) => {
      const code = roomCodeFromUrl(url);
      if (!code) return;
      setJoinCode(code);
      void joinRoomByCode(code);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      joinFromUrl(window.location.href);
      return;
    }
    let active = true;
    void Linking.getInitialURL().then((url) => { if (active) joinFromUrl(url); }).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => joinFromUrl(url));
    return () => { active = false; subscription.remove(); };
  }, []);

  const shareRoom = () => {
    if (!game) return;
    void Share.share({ message: `Únete a mi partida de PokéQuién con el identificador ${game.roomCode}: ${inviteLinkFor(game.roomCode)}` });
  };

  const copyInvite = async () => {
    if (loading) return;
    const room = game ?? await createRoom();
    if (room) await Clipboard.setStringAsync(inviteLinkFor(room.roomCode));
  };

  const copyCode = () => {
    if (!game) return;
    void Clipboard.setStringAsync(game.roomCode);
  };

  const leaveRoom = () => {
    roomClientRef.current?.close();
    roomClientRef.current = null;
    setGame(null);
    setPlayer(null);
    setScreen('home');
    setError('');
  };

  const select = (id: number) => {
    if (!game || !player || (game.phase !== 'selecting' && game.phase !== 'waiting-for-selection')) return;
    if (game.players[player].secretId !== null) return;
    playSound('select');
    getClient().select(id);
  };

  const toggle = (boardPlayer: PlayerId, id: number) => {
    if (!game || !player || boardPlayer !== player || game.phase !== 'playing') return;
    const wasCrossed = game.players[boardPlayer].crossedIds.includes(id);
    playSound(wasCrossed ? 'restore' : 'cross');
    getClient().toggle(id);
  };

  const rematch = () => {
    if (!game || !player) return;
    getClient().rematch();
  };

  const screenTitle = useMemo(() => screen === 'home' ? 'Inicio' : screen === 'room' ? 'Sala' : screen === 'selection' ? 'Elección' : screen === 'waiting' ? 'Esperando' : screen === 'single-player' ? 'Modo 1 jugador' : 'Partida', [screen]);

  if (!fontsLoaded) return <SafeAreaProvider><SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}><View style={styles.fontLoading}><Text style={styles.fontLoadingText}>CARGANDO…</Text></View></SafeAreaView></SafeAreaProvider>;

  return <SafeAreaProvider><SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}><StatusBar style="light" /><RetroBackdrop /><View accessible={false} style={styles.appRoot}>
    {screen === 'home' && <HomeScreen generation={generation} setGeneration={setGeneration} onCreate={() => void createRoom()} onJoin={joinRoom} onDemo={() => void createRoom(1)} onCopyInvite={() => void copyInvite()} onSolo={() => setScreen('single-player')} inviteCode={inviteCode} joinCode={joinCode} setJoinCode={setJoinCode} loading={loading} error={error} reduceMotion={reduceMotion} />}
    {screen === 'room' && game && player && <RoomScreen game={game} player={player} onShare={shareRoom} onCopyCode={copyCode} onBack={leaveRoom} />}
    {screen === 'selection' && game && player && <SelectionScreen game={game} player={player} reduceMotion={reduceMotion} onSelect={select} />}
    {screen === 'waiting' && game && player && <WaitingScreen game={game} player={player} reduceMotion={reduceMotion} />}
    {screen === 'game' && game && player && <GameScreen game={game} player={player} reduceMotion={reduceMotion} onToggle={toggle} onBack={leaveRoom} onRematch={rematch} />}
    {screen === 'single-player' && <SinglePlayerScreen reduceMotion={reduceMotion} onBack={() => setScreen('home')} onSound={(kind) => playSound(kind)} />}
    <Text style={styles.srOnly}>{screenTitle}</Text>
  </View></SafeAreaView></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  appRoot: { flex: 1, maxWidth: 720, width: '100%', alignSelf: 'center', zIndex: 1 },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: COLORS.background },
  backdropImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.88 },
  backdropTint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(4, 8, 18, 0.58)' },
  scanlines: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.13 },
  scanline: { height: 2, backgroundColor: '#C2D8FF' },
  fontLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fontLoadingText: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 12 },
  scrollContent: { padding: 18, paddingTop: 30, paddingBottom: 48, gap: 18 },
  selectionContent: { padding: 10, paddingTop: 30, paddingBottom: 48, gap: 16 },
  gameContent: { padding: 12, paddingTop: 20, paddingBottom: 48, gap: 17 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  logoMark: { display: 'none' },
  logoMarkText: { display: 'none' },
  logo: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 27, lineHeight: 34, textAlign: 'center', letterSpacing: 1, textShadowColor: '#1B2C86', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  heroSubtitle: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 1.2, marginTop: 14 },
  tag: { display: 'none' },
  tagText: { display: 'none' },
  panel: { backgroundColor: 'rgba(28, 29, 39, 0.94)', borderRadius: 18, padding: 15, gap: 14, borderWidth: 2, borderColor: '#6F6A67', shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  sectionHeader: { gap: 6 },
  eyebrow: { color: COLORS.orange, fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 1.1 },
  sectionTitle: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 17, lineHeight: 25, textTransform: 'uppercase', textAlign: 'center' },
  sectionRule: { height: 2, backgroundColor: '#6C6B70', width: '92%', alignSelf: 'center', marginVertical: 2 },
  muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  portraitFrame: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  dexBadge: { position: 'absolute', right: 0, bottom: 0, color: COLORS.white, backgroundColor: 'rgba(5, 7, 11, 0.84)', fontFamily: PIXEL_FONT, fontSize: 6, lineHeight: 9, paddingHorizontal: 2, borderRadius: 2 },
  fieldLabel: { color: '#B4B4BB', fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 18 },
  generationRow: { gap: 7, paddingVertical: 2 },
  generationChip: { borderWidth: 2, borderColor: '#5B5D66', backgroundColor: '#171820', paddingHorizontal: 10, minHeight: 44, justifyContent: 'center', borderRadius: 8 },
  generationChipActive: { backgroundColor: '#161821', borderColor: COLORS.yellow },
  generationText: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 16 },
  generationTextActive: { color: COLORS.yellow },
  button: { minHeight: 51, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 2, borderBottomWidth: 5, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } },
  buttonPrimary: { backgroundColor: '#4059D2', borderColor: '#79A2FF', borderBottomColor: '#283B9D' },
  buttonSecondary: { backgroundColor: '#4059D2', borderColor: '#79A2FF', borderBottomColor: '#283B9D' },
  buttonOrange: { backgroundColor: COLORS.orange, borderColor: '#FF994A', borderBottomColor: '#A94100' },
  buttonGray: { backgroundColor: '#505158', borderColor: '#74757A', borderBottomColor: '#2E2F34' },
  buttonGhost: { backgroundColor: 'transparent', borderColor: '#645B96', borderBottomColor: '#373052' },
  soloCta: { minHeight: 92, borderRadius: 14, borderWidth: 2, borderBottomWidth: 6, borderColor: '#FFDF44', borderBottomColor: '#9C6500', backgroundColor: 'rgba(17, 21, 48, 0.96)', paddingHorizontal: 16, paddingVertical: 13, gap: 5, shadowColor: COLORS.yellow, shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } },
  soloCtaKicker: { color: COLORS.success, fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 0.9, textAlign: 'center' },
  soloCtaTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  soloCtaText: { color: COLORS.white, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  buttonDisabled: { opacity: 0.42 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
  buttonText: { fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 16, letterSpacing: 0.2, textAlign: 'center' },
  buttonTextDark: { color: COLORS.ink },
  buttonTextLight: { color: COLORS.ink },
  input: { backgroundColor: '#101116', borderWidth: 2, borderColor: '#67686F', color: COLORS.white, minHeight: 53, borderRadius: 8, paddingHorizontal: 14, fontFamily: PIXEL_FONT, fontSize: 11, letterSpacing: 1.2 },
  demoLink: { alignItems: 'center', gap: 3, paddingVertical: 7 },
  demoLinkText: { color: COLORS.yellow, fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
  error: { color: COLORS.white, backgroundColor: '#8D394F', padding: 11, borderRadius: 8, lineHeight: 17 },
  credits: { color: '#A2A2A9', fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 15, textAlign: 'center', marginTop: 6 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: 6, paddingRight: 14 },
  topbarButton: { minHeight: 44, minWidth: 58, justifyContent: 'center' },
  backText: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 9, letterSpacing: 0.8 },
  codePanel: { backgroundColor: 'rgba(20, 21, 29, 0.92)', borderRadius: 8, padding: 16, alignItems: 'stretch', gap: 9, borderWidth: 2, borderColor: '#6F6A67' },
  codeLabel: { color: COLORS.muted, fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 1.1, textAlign: 'center' },
  codeInput: { backgroundColor: '#101116', borderWidth: 2, borderColor: '#67686F', borderRadius: 8, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  roomCode: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 21, letterSpacing: 3 },
  roomActions: { flexDirection: 'column', gap: 8 },
  codeMeta: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  liveDot: { color: COLORS.success, fontSize: 11, fontWeight: '900' },
  waitDot: { color: COLORS.orange, fontSize: 11, fontWeight: '900' },
  readyPanel: { backgroundColor: 'rgba(23, 48, 42, 0.94)', borderRadius: 8, padding: 16, gap: 6, borderWidth: 2, borderColor: COLORS.success },
  readyTitle: { color: COLORS.success, fontFamily: PIXEL_FONT, fontSize: 10, letterSpacing: 0.7 },
  readyText: { color: COLORS.white, fontSize: 14, lineHeight: 20 },
  waitRoomPanel: { backgroundColor: 'rgba(17, 18, 24, 0.94)', borderRadius: 8, padding: 16, gap: 7, borderWidth: 2, borderColor: '#5C5D64' },
  waitRoomTitle: { color: COLORS.success, fontFamily: PIXEL_FONT, fontSize: 10, letterSpacing: 0.7 },
  waitRoomText: { color: COLORS.white, fontSize: 14, lineHeight: 20 },
  waitDots: { flexDirection: 'row', gap: 5, marginTop: 4 },
  waitDotGlyph: { color: COLORS.yellow, fontSize: 13 },
  mutedCenter: { color: COLORS.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 8 },
  selectionHeader: { gap: 8, paddingTop: 18, paddingBottom: 9, alignItems: 'center' },
  selectionTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 18, lineHeight: 30, textAlign: 'center', textShadowColor: '#453A00', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  selectionPlayer: { color: COLORS.success, fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 0.6 },
  selectionBoard: { backgroundColor: 'rgba(0, 0, 0, 0.64)', borderRadius: 9, borderWidth: 3, borderColor: '#292B33', padding: 7 },
  selectionFootnote: { color: COLORS.muted, fontSize: 10, textAlign: 'center', lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 5 },
  tile: { width: '18.4%', aspectRatio: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#22242C', borderRadius: 8, borderWidth: 3, borderColor: '#393B44', paddingHorizontal: 1, overflow: 'hidden', position: 'relative', shadowColor: '#000', shadowOpacity: 0.65, shadowRadius: 2, shadowOffset: { width: 0, height: 3 } },
  tileSelected: { borderColor: COLORS.yellow, backgroundColor: '#30333B', transform: [{ scale: 1.04 }] },
  tileCrossed: { borderColor: '#686970', backgroundColor: '#25262B' },
  tilePressed: { transform: [{ scale: 0.96 }] },
  tileName: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 5, lineHeight: 8, maxWidth: '100%' },
  tileNameCrossed: { color: '#B2B2B6', textDecorationLine: 'line-through' },
  crossOverlay: { position: 'absolute', left: 1, right: 1, top: 1, bottom: 1, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  crossLine: { position: 'absolute', width: '128%', height: 7, backgroundColor: COLORS.danger, borderRadius: 4, shadowColor: '#4A0710', shadowOpacity: 0.9, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  crossLineA: { transform: [{ rotate: '45deg' }] },
  crossLineB: { transform: [{ rotate: '-45deg' }] },
  waitingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: 'rgba(0, 0, 0, 0.78)' },
  waitingContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.78)' },
  waitingPanel: { width: '100%', maxWidth: 460, alignItems: 'center', backgroundColor: 'rgba(17, 18, 29, 0.96)', borderRadius: 16, borderWidth: 3, borderColor: COLORS.yellow, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 12, gap: 11, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  waitingTopline: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waitingEyebrow: { color: COLORS.cyan, fontFamily: PIXEL_FONT, fontSize: 7, letterSpacing: 0.6 },
  waitingLivePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(56, 211, 125, 0.65)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(23, 71, 51, 0.6)' },
  waitingLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  waitingLiveText: { color: COLORS.success, fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 0.5 },
  waitingTitle: { color: COLORS.success, fontFamily: PIXEL_FONT, fontSize: 17, lineHeight: 27, textAlign: 'center', textShadowColor: '#0A4A31', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  waitingText: { color: COLORS.white, fontSize: 13, lineHeight: 21, maxWidth: 380, textAlign: 'center' },
  waitingDivider: { width: '88%', height: 2, backgroundColor: '#4D4D58', marginTop: 1 },
  captureStage: { width: '100%', maxWidth: 410, minHeight: 146, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  captureTarget: { width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.panelLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#5A538A', overflow: 'visible', shadowColor: COLORS.cyan, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  captureTargetGlow: { position: 'absolute', width: 86, height: 86, borderRadius: 43, borderWidth: 1, borderColor: 'rgba(121, 162, 255, 0.48)' },
  captureQuestion: { color: COLORS.yellow, fontSize: 42, fontWeight: '900' },
  captureConnector: { flex: 1, minWidth: 28, maxWidth: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  captureLine: { flex: 1, height: 2, borderTopWidth: 2, borderTopColor: 'rgba(255, 208, 0, 0.7)', borderStyle: 'dashed' },
  captureArrow: { color: COLORS.yellow, fontSize: 28, lineHeight: 30, marginTop: -2 },
  pokeballTrack: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  pokeballGif: { width: 108, height: 98 },
  waitingSecret: { width: '100%', maxWidth: 300, alignItems: 'center', gap: 6, backgroundColor: COLORS.panelLight, borderRadius: 12, paddingHorizontal: 17, paddingVertical: 9, borderWidth: 1, borderColor: '#505167' },
  waitingSecretRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  waitingSecretName: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 10, lineHeight: 18 },
  waitingSecretCheck: { color: COLORS.success, fontSize: 23, fontWeight: '900' },
  waitingTip: { alignItems: 'center', gap: 3 },
  waitingTipTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 0.4, textAlign: 'center' },
  waitingHint: { color: COLORS.muted, fontSize: 11, textAlign: 'center', maxWidth: 340, lineHeight: 17 },
  pikachuWaiting: { width: 124, height: 72, marginTop: -3 },
  gameTopbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: 2 },
  gameRoom: { color: COLORS.muted, fontFamily: PIXEL_FONT, fontSize: 7, letterSpacing: 0.4 },
  disconnectBanner: { backgroundColor: 'rgba(96, 50, 29, 0.94)', borderRadius: 8, borderWidth: 2, borderColor: COLORS.orange, padding: 11, gap: 4, alignItems: 'center' },
  disconnectTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 8, textAlign: 'center' },
  disconnectText: { color: COLORS.white, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  turnPill: { backgroundColor: COLORS.success, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: COLORS.white },
  turnPillFinished: { backgroundColor: COLORS.orange },
  turnText: { color: COLORS.ink, fontFamily: PIXEL_FONT, fontSize: 7 },
  gameIntro: { display: 'none' },
  panelKicker: { color: COLORS.cyan, fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 0.8 },
  viewerTitle: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 13, lineHeight: 21, marginTop: 2 },
  secretBox: { minHeight: 64, backgroundColor: COLORS.panelLight, borderRadius: 12, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  secretArt: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  questionMark: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 28 },
  secretCopy: { flex: 1, gap: 3 },
  statusLabel: { color: COLORS.muted, fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 0.5 },
  secretName: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 9 },
  boardSection: { gap: 8 },
  retroPanelHeader: { alignSelf: 'center', minWidth: '68%', backgroundColor: 'rgba(5, 11, 24, 0.9)', borderRadius: 8, borderWidth: 3, borderColor: '#4B4B4F', paddingHorizontal: 14, paddingVertical: 11, gap: 7, shadowColor: '#000', shadowOpacity: 0.65, shadowRadius: 4, shadowOffset: { width: 0, height: 4 } },
  retroPanelTitle: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 23, textAlign: 'center' },
  retroPanelRule: { height: 2, backgroundColor: '#5E5D61', width: '90%', alignSelf: 'center' },
  retroPanelDetail: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 6, textAlign: 'center' },
  boardPanel: { backgroundColor: 'rgba(5, 9, 13, 0.92)', borderRadius: 10, padding: 7, gap: 8, borderWidth: 4, borderColor: '#24262B', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 5 } },
  boardPanelMine: { borderColor: '#3B3E48' },
  boardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boardKicker: { color: COLORS.orange, fontFamily: PIXEL_FONT, fontSize: 7, letterSpacing: 0.7 },
  boardTitle: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 18, marginTop: 2 },
  countPill: { alignItems: 'center', backgroundColor: COLORS.panelLight, borderRadius: 9, minWidth: 48, paddingVertical: 4 },
  countNumber: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 13, lineHeight: 19 },
  countLabel: { color: COLORS.muted, fontFamily: PIXEL_FONT, fontSize: 6 },
  boardHint: { color: COLORS.muted, fontFamily: PIXEL_FONT, fontSize: 6, lineHeight: 12, textAlign: 'center' },
  versusStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5, paddingVertical: 6 },
  versusSide: { flex: 1, alignItems: 'center', gap: 7 },
  versusLabel: { borderWidth: 2, borderColor: COLORS.yellow, backgroundColor: 'rgba(5, 5, 8, 0.9)', borderRadius: 6, minWidth: 82, paddingVertical: 8, paddingHorizontal: 7 },
  versusLabelText: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 10, textAlign: 'center' },
  versusArt: { width: 104, height: 104, borderRadius: 10, backgroundColor: '#161820', borderWidth: 5, borderColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.yellow, shadowOpacity: 0.24, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  versusName: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 7, textAlign: 'center' },
  vsMark: { width: 55, alignItems: 'center', justifyContent: 'center' },
  vsMarkText: { color: COLORS.danger, fontFamily: PIXEL_FONT, fontSize: 18, textShadowColor: COLORS.white, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  resultPanel: { backgroundColor: 'rgba(29, 30, 42, 0.96)', borderRadius: 10, padding: 14, alignItems: 'center', gap: 8, borderWidth: 3, borderColor: COLORS.yellow, shadowColor: COLORS.yellow, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  resultModalBackdrop: { flex: 1, backgroundColor: 'rgba(3, 5, 10, 0.82)', justifyContent: 'center', padding: 14 },
  resultModalScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 14 },
  resultEmoji: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 21 },
  resultTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 16, lineHeight: 25, textAlign: 'center' },
  resultText: { color: COLORS.white, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  victoryHero: { width: '100%', alignItems: 'center', gap: 5, backgroundColor: '#FFF3D2', borderRadius: 8, padding: 10, borderWidth: 2, borderColor: COLORS.yellow },
  victoryPokemonName: { color: COLORS.ink, fontFamily: PIXEL_FONT, fontSize: 11, textAlign: 'center' },
  victoryFact: { color: COLORS.ink, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  revealRow: { width: '100%', flexDirection: 'column', gap: 7 },
  infoCard: { width: '100%', backgroundColor: '#FFF3D2', borderRadius: 5, padding: 8, gap: 6, borderWidth: 2, borderColor: '#3A3B42' },
  infoIdentity: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoName: { flex: 1, gap: 2 },
  infoTitle: { color: COLORS.ink, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 14 },
  infoDescription: { color: COLORS.ink, fontSize: 10, lineHeight: 14 },
  infoFact: { color: COLORS.ink, fontSize: 9, lineHeight: 13 },
  infoFactLabel: { fontWeight: '900' },
  winnerFact: { width: '100%', backgroundColor: '#E86B4C', borderRadius: 11, padding: 10, gap: 5 },
  winnerFactTitle: { color: COLORS.ink, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 13, letterSpacing: 0.5 },
  winnerFactText: { color: COLORS.ink, fontSize: 11, lineHeight: 15 },
  winnerFactStrong: { fontWeight: '900' },
  srOnly: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', opacity: 0 },
});
