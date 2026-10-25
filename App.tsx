import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, Platform, Share, Text, View } from 'react-native';
import { GenerationId, LOCAL_KANTO_ROSTER, PokemonCandidate, loadRoster } from './src/data/pokemon';
import { PlayerId } from './src/game/engine';
import { RoomClient, RoomGameState } from './src/game/roomClient';
import { SinglePlayerScreen } from './src/singlePlayer/SinglePlayerScreen';
import { PIXEL_FONT } from './src/ui/theme';
import { isRoomServerError, normalizeRoomCodeInput, roomCodeFromUrl, validateRoomCode } from './src/game/roomErrors';
import { Screen, createRoomCode, getScreenForState, inviteLinkFor } from './src/game/roomNavigation';
import { useReduceMotion } from './src/hooks/useReduceMotion';
import { useGameSounds } from './src/hooks/useGameSounds';
import { RetroBackdrop } from './src/ui/components';
import { HomeScreen } from './src/screens/HomeScreen';
import { RoomScreen } from './src/screens/RoomScreen';
import { SelectionScreen } from './src/screens/SelectionScreen';
import { WaitingScreen } from './src/screens/WaitingScreen';
import { GameScreen } from './src/screens/GameScreen';
import { styles } from './src/ui/appStyles';

// Qué hacer en cada fase; se anuncia a los lectores de pantalla al cambiar de pantalla.
const PHASE_HINTS: Record<Screen, string> = {
  home: 'Crea una sala, únete con un código o juega contra la máquina.',
  room: 'Comparte el código o el enlace con tu rival.',
  selection: 'Elige tu Pokémon secreto.',
  waiting: 'Esperando a que tu rival elija.',
  game: 'Partida en curso: tacha los Pokémon que descartes.',
  'single-player': 'Modo 1 jugador.',
};

export default function App() {
  const [fontsLoaded] = useFonts({ [PIXEL_FONT]: require('./assets/fonts/PokeQuienPixel-Regular.ttf') });
  const [screen, setScreen] = useState<Screen>('home');
  const [generation, setGeneration] = useState<GenerationId>('all');
  const [inviteCode, setInviteCode] = useState(() => createRoomCode());
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offerSolo, setOfferSolo] = useState(false);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('');
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryAction, setRetryAction] = useState<'create' | 'join' | null>(null);
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
      roomClientRef.current = new RoomClient(
        (nextGame, nextPlayer) => {
          setError(
            nextGame.phase === 'abandoned'
              ? `La partida terminó: ${nextGame.abandonedPlayer === nextPlayer ? 'has abandonado la sala' : 'el rival abandonó la partida'}. Crea otra sala o juega al Solitario.`
              : '',
          );
          setOfferSolo(nextGame.phase === 'abandoned');
          applyState(nextGame, nextPlayer);
        },
        (message) => {
          setError(message);
          if (!message) setOfferSolo(false);
          if (message.includes('no se reconectó') || message.includes('reconexión ha terminado')) {
            roomClientRef.current?.close({ forgetSession: true });
            roomClientRef.current = null;
            setGame(null);
            setPlayer(null);
            setScreen('home');
            setOfferSolo(true);
          }
        },
        setProgress,
      );
    }
    return roomClientRef.current;
  };

  useEffect(
    () => () => {
      roomClientRef.current?.close();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), 3_500);
  };

  const showFailure = (cause: unknown, fallback: string, extra = '') => {
    setOfferSolo(isRoomServerError(cause));
    setError(`${cause instanceof Error && cause.message ? cause.message : fallback}${extra}`);
  };

  useEffect(() => {
    const phase = game?.phase ?? null;
    if (phase === 'finished' && previousPhaseRef.current !== 'finished' && game?.winner && player) {
      playSound(game.winner === player ? 'victory' : 'defeat');
    }
    previousPhaseRef.current = phase;
  }, [game?.phase, playSound]);

  const createRoom = async (nextGeneration = generation): Promise<RoomGameState | null> => {
    setError('');
    setOfferSolo(false);
    setLoadingLabel('');
    setRetryAction('create');
    setLoading(true);
    try {
      const nextRoster = await loadRoster(nextGeneration);
      setRoster(nextRoster);
      const nextCode = inviteCode;
      const nextGame = await getClient().create(nextCode, nextGeneration, nextRoster);
      setInviteCode(createRoomCode());
      setRetryAction(null);
      applyState(nextGame, getClient().playerId ?? 'p1');
      return nextGame;
    } catch (cause) {
      showFailure(cause, 'No se pudo crear la sala.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const joinRoomByCode = async (rawCode: string, fromLink = false) => {
    const code = normalizeRoomCodeInput(rawCode);
    const invalid = validateRoomCode(code);
    setOfferSolo(false);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setRetryAction('join');
    setLoadingLabel(`ENTRANDO EN ${code}…`);
    setLoading(true);
    try {
      const nextGame = await getClient().join(code);
      setRoster(nextGame.board);
      setRetryAction(null);
      applyState(nextGame, getClient().playerId ?? 'p2');
    } catch (cause) {
      const missing = cause instanceof Error && cause.message.startsWith('No hay ninguna sala');
      showFailure(
        cause,
        'No se pudo entrar en la sala.',
        missing && fromLink ? ' Puede que el enlace haya caducado: pide a tu rival uno nuevo.' : '',
      );
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  const joinRoom = () => void joinRoomByCode(joinCode);

  useEffect(() => {
    const joinFromUrl = (url: string | null) => {
      const code = roomCodeFromUrl(url);
      if (!code) return;
      setJoinCode(code);
      void joinRoomByCode(code, true);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const href = window.location.href;
      // Se quita ?room= de la barra (conservando /Adivina-pkm/) para que recargar no reintente una sala vieja.
      if (/[?&]room=/i.test(window.location.search)) {
        try {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
        } catch {
          /* best effort */
        }
      }
      joinFromUrl(href);
      return;
    }
    let active = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (active) joinFromUrl(url ?? null);
      })
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => joinFromUrl(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const LINK_COPIED = '¡Enlace copiado! Pégalo en WhatsApp, Telegram o donde habléis.';

  const copyLink = async (roomCode: string) => {
    try {
      await Clipboard.setStringAsync(inviteLinkFor(roomCode));
      showNotice(LINK_COPIED);
    } catch {
      showNotice(`No se pudo copiar. Envía este enlace: ${inviteLinkFor(roomCode)}`);
    }
  };

  // En móvil abre el menú de compartir; en un navegador sin navigator.share copia el enlace. Siempre hay aviso visible.
  const inviteRival = async () => {
    if (!game) return;
    const link = inviteLinkFor(game.roomCode);
    const message = `¡Te reto a un duelo de PokéQuién! Entra con este enlace (sala ${game.roomCode}): ${link}`;
    if (Platform.OS === 'web') {
      const nav =
        typeof navigator !== 'undefined'
          ? (navigator as Navigator & {
              share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
            })
          : undefined;
      if (nav?.share) {
        try {
          await nav.share({ title: 'PokéQuién', text: message, url: link });
          showNotice('Invitación lista. Cuando tu rival abra el enlace, entraréis los dos.');
          return;
        } catch (cause) {
          if (cause instanceof Error && cause.name === 'AbortError') return;
        }
      }
      await copyLink(game.roomCode);
      return;
    }
    try {
      await Share.share({ message });
    } catch {
      await copyLink(game.roomCode);
    }
  };

  const copyInvite = async () => {
    if (loading) return;
    const room = game ?? (await createRoom());
    if (room) await copyLink(room.roomCode);
  };

  const copyCode = async () => {
    if (!game) return;
    try {
      await Clipboard.setStringAsync(game.roomCode);
      showNotice(`Código ${game.roomCode} copiado.`);
    } catch {
      showNotice(`Tu código es ${game.roomCode}.`);
    }
  };

  const leaveRoom = () => {
    roomClientRef.current?.close();
    roomClientRef.current = null;
    setGame(null);
    setPlayer(null);
    setScreen('home');
    setError('');
    setOfferSolo(false);
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

  const screenTitle = useMemo(
    () =>
      screen === 'home'
        ? 'Inicio'
        : screen === 'room'
          ? 'Sala'
          : screen === 'selection'
            ? 'Elección'
            : screen === 'waiting'
              ? 'Esperando'
              : screen === 'single-player'
                ? 'Modo 1 jugador'
                : 'Partida',
    [screen],
  );

  // iOS no tiene regiones vivas: anuncia la fase al cambiar de pantalla (no en el primer render).
  const firstScreenRef = useRef(true);
  useEffect(() => {
    if (firstScreenRef.current) {
      firstScreenRef.current = false;
      return;
    }
    // El Solitario ya anuncia «Modo 1 jugador preparado»: no se duplica.
    if (Platform.OS === 'ios' && screen !== 'single-player') {
      AccessibilityInfo.announceForAccessibility(`${screenTitle}. ${PHASE_HINTS[screen]}`);
    }
  }, [screen, screenTitle]);

  if (!fontsLoaded)
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.fontLoading}>
            <Text style={styles.fontLoadingText}>CARGANDO…</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar style="light" />
        <RetroBackdrop />
        <View accessible={false} style={styles.appRoot}>
          {screen === 'home' && (
            <HomeScreen
              generation={generation}
              setGeneration={setGeneration}
              onCreate={() => void createRoom()}
              onJoin={joinRoom}
              onDemo={() => void createRoom(1)}
              onCopyInvite={() => void copyInvite()}
              onSolo={() => {
                setError('');
                setOfferSolo(false);
                setScreen('single-player');
              }}
              onRetry={() => (retryAction === 'join' ? joinRoom() : void createRoom())}
              inviteCode={inviteCode}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              loading={loading}
              loadingLabel={loadingLabel}
              error={error}
              offerSolo={offerSolo}
              progress={progress}
              notice={notice}
              retryAction={retryAction}
              reduceMotion={reduceMotion}
            />
          )}
          {screen === 'room' && game && player && (
            <RoomScreen
              game={game}
              player={player}
              onShare={() => void inviteRival()}
              onCopyCode={() => void copyCode()}
              onBack={leaveRoom}
              notice={notice}
            />
          )}
          {screen === 'selection' && game && player && (
            <SelectionScreen game={game} player={player} reduceMotion={reduceMotion} onSelect={select} />
          )}
          {screen === 'waiting' && game && player && (
            <WaitingScreen game={game} player={player} reduceMotion={reduceMotion} />
          )}
          {screen === 'game' && game && player && (
            <GameScreen
              game={game}
              player={player}
              reduceMotion={reduceMotion}
              onToggle={toggle}
              onBack={leaveRoom}
              onRematch={rematch}
            />
          )}
          {screen === 'single-player' && (
            <SinglePlayerScreen
              reduceMotion={reduceMotion}
              onBack={() => setScreen('home')}
              onSound={(kind) => playSound(kind)}
            />
          )}
          {/* Región viva: lectores de pantalla en web y Android anuncian cada cambio de fase. */}
          <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.srOnly}>
            {`${screenTitle}. ${PHASE_HINTS[screen]}`}
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
