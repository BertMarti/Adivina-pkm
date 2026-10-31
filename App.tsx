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
import { ConnectionAttempts, isRoomCodeTaken } from './src/game/roomSession';
import { useReduceMotion } from './src/hooks/useReduceMotion';
import { useGameSounds } from './src/hooks/useGameSounds';
import { RetroBackdrop } from './src/ui/components';
import { HomeScreen } from './src/screens/HomeScreen';
import { RoomScreen } from './src/screens/RoomScreen';
import { SelectionScreen } from './src/screens/SelectionScreen';
import { WaitingScreen } from './src/screens/WaitingScreen';
import { GameScreen } from './src/screens/GameScreen';
import { styles } from './src/ui/appStyles';
import { SettingsProvider } from './src/settings/SettingsContext';
import { SettingsModal, SettingsSection } from './src/ui/SettingsModal';

// Qué hacer en cada fase; se anuncia a los lectores de pantalla al cambiar de pantalla.
const PHASE_HINTS: Record<Screen, string> = {
  home: 'Crea una sala, únete con un código o juega contra la máquina.',
  room: 'Comparte el código o el enlace con tu rival.',
  selection: 'Elige tu Pokémon secreto.',
  waiting: 'Esperando a que tu rival elija.',
  game: 'Partida en curso: tacha los Pokémon que descartes.',
  'single-player': '', // El Solitario anuncia su propia entrada («Modo 1 jugador preparado»).
};

// Los ajustes (sonido, vibración, tachado visible) envuelven toda la app: los usan los sonidos y las cartas.
export default function App() {
  return (
    <SettingsProvider>
      <PokeQuienApp />
    </SettingsProvider>
  );
}

function PokeQuienApp() {
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
  // Dónde se ve el error en el inicio: junto al panel que lo provocó (si no, en móvil quedaba fuera de pantalla).
  const [errorSlot, setErrorSlot] = useState<'create' | 'join' | 'top'>('top');
  // Cada intento de crear/unirse lleva un número; cancelar lo invalida y su resultado tardío se descarta.
  const attemptsRef = useRef(new ConnectionAttempts());
  // Copias síncronas de la pantalla y de la sala para los callbacks del cliente (el estado de React llega tarde).
  const screenRef = useRef<Screen>('home');
  const gameRef = useRef<RoomGameState | null>(null);
  const [game, setGame] = useState<RoomGameState | null>(null);
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [roster, setRoster] = useState<PokemonCandidate[]>(LOCAL_KANTO_ROSTER);
  const reduceMotion = useReduceMotion();
  const playSound = useGameSounds();
  const roomClientRef = useRef<RoomClient | null>(null);
  const previousPhaseRef = useRef<RoomGameState['phase'] | null>(null);
  // Ajustes abiertos (y en qué sección) y contador para que el Solitario relea su historial si se borra desde Ajustes.
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'PokéQuién · Duelo Pixel';
    }
  }, []);

  const showScreen = (next: Screen) => {
    screenRef.current = next;
    setScreen(next);
  };

  const setRoomGame = (next: RoomGameState | null) => {
    gameRef.current = next;
    setGame(next);
  };

  const applyState = (nextGame: RoomGameState, nextPlayer: PlayerId) => {
    setRoomGame(nextGame);
    setPlayer(nextPlayer);
    setGeneration(nextGame.generation);
    showScreen(getScreenForState(nextGame, nextPlayer));
  };

  const getClient = () => {
    if (!roomClientRef.current) {
      // Los avisos de un cliente ya cerrado (cancelado o de una sala abandonada) no deben cambiar la pantalla.
      const client: RoomClient = new RoomClient(
        (nextGame, nextPlayer) => {
          if (roomClientRef.current !== client) return;
          if (nextGame.phase === 'abandoned') {
            // La partida terminó: este cliente ya no sirve. Si siguiera vivo, un corte posterior de la conexión
            // («no se reconectó») sacaría al jugador de donde esté, incluso del Solitario.
            client.close({ forgetSession: true });
            roomClientRef.current = null;
          }
          setErrorSlot('top');
          setError(
            nextGame.phase === 'abandoned'
              ? `La partida terminó: ${nextGame.abandonedPlayer === nextPlayer ? 'has abandonado la sala' : 'el rival abandonó la partida'}. Crea otra sala o juega al Solitario.`
              : '',
          );
          setOfferSolo(nextGame.phase === 'abandoned');
          applyState(nextGame, nextPlayer);
        },
        (message) => {
          if (roomClientRef.current !== client) return;
          setError(message);
          if (!message) setOfferSolo(false);
          if (message.includes('no se reconectó') || message.includes('reconexión ha terminado')) {
            client.close({ forgetSession: true });
            roomClientRef.current = null;
            setRoomGame(null);
            setPlayer(null);
            // Quien ya está en el Solitario se queda allí; el aviso se verá al volver al inicio.
            if (screenRef.current !== 'single-player') showScreen('home');
            setErrorSlot('top');
            setOfferSolo(true);
          }
        },
        (message) => {
          if (roomClientRef.current === client) setProgress(message);
        },
      );
      roomClientRef.current = client;
    }
    return roomClientRef.current;
  };

  // CANCELAR mientras se conecta (o ir al Solitario): cierra el cliente y descarta lo que llegue después.
  const cancelConnection = () => {
    // Si la sala ya llegó (y sigue viva), no hay nada que cancelar: se está en ella.
    if (gameRef.current && gameRef.current.phase !== 'abandoned' && roomClientRef.current) return;
    attemptsRef.current.cancel();
    roomClientRef.current?.close({ forgetSession: true });
    roomClientRef.current = null;
    // Un «create» cancelado pudo llegar al servidor y dejar ocupado este código: el siguiente intento usa otro.
    setInviteCode(createRoomCode());
    setLoading(false);
    setLoadingLabel('');
    setProgress('');
    setRetryAction(null);
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
    const attempt = attemptsRef.current.start();
    setError('');
    setErrorSlot('create');
    setOfferSolo(false);
    setLoadingLabel('CARGANDO POKÉDEX…');
    setRetryAction('create');
    setLoading(true);
    try {
      const nextRoster = await loadRoster(nextGeneration);
      if (!attemptsRef.current.isCurrent(attempt)) return null;
      setLoadingLabel('CREANDO SALA…');
      setRoster(nextRoster);
      const nextCode = inviteCode;
      const client = getClient();
      const nextGame = await client.create(nextCode, nextGeneration, nextRoster);
      if (!attemptsRef.current.isCurrent(attempt)) {
        client.close({ forgetSession: true });
        return null;
      }
      setInviteCode(createRoomCode());
      setRetryAction(null);
      applyState(nextGame, client.playerId ?? 'p1');
      return nextGame;
    } catch (cause) {
      if (!attemptsRef.current.isCurrent(attempt)) return null;
      if (isRoomCodeTaken(cause)) {
        // El código ya existe en el servidor (p. ej. de un intento cancelado): REINTENTAR usará uno nuevo.
        setInviteCode(createRoomCode());
        showFailure(cause, 'No se pudo crear la sala.', ' Hemos preparado un código nuevo: pulsa REINTENTAR.');
      } else {
        showFailure(cause, 'No se pudo crear la sala.');
      }
      return null;
    } finally {
      if (attemptsRef.current.isCurrent(attempt)) {
        setLoading(false);
        setLoadingLabel('');
      }
    }
  };

  const joinRoomByCode = async (rawCode: string, fromLink = false) => {
    const code = normalizeRoomCodeInput(rawCode);
    const invalid = validateRoomCode(code);
    setOfferSolo(false);
    // Con un enlace de invitación el panel de unirse queda fuera de la pantalla: el estado se ve arriba.
    setErrorSlot(fromLink ? 'top' : 'join');
    if (invalid) {
      setRetryAction(null);
      setError(invalid);
      return;
    }
    const attempt = attemptsRef.current.start();
    setError('');
    setRetryAction('join');
    setLoadingLabel(`ENTRANDO EN ${code}…`);
    setLoading(true);
    try {
      const client = getClient();
      const nextGame = await client.join(code);
      if (!attemptsRef.current.isCurrent(attempt)) {
        client.close({ forgetSession: true });
        return;
      }
      setRoster(nextGame.board);
      setRetryAction(null);
      applyState(nextGame, client.playerId ?? 'p2');
    } catch (cause) {
      if (!attemptsRef.current.isCurrent(attempt)) return;
      const missing = cause instanceof Error && cause.message.startsWith('No hay ninguna sala');
      showFailure(
        cause,
        'No se pudo entrar en la sala.',
        missing && fromLink ? ' Puede que el enlace haya caducado: pide a tu rival uno nuevo.' : '',
      );
    } finally {
      if (attemptsRef.current.isCurrent(attempt)) {
        setLoading(false);
        setLoadingLabel('');
      }
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
    setRoomGame(null);
    setPlayer(null);
    showScreen('home');
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
                // Siempre: también cierra un cliente que siguiera vivo tras una partida terminada.
                cancelConnection();
                setError('');
                setOfferSolo(false);
                showScreen('single-player');
              }}
              onRetry={() => (retryAction === 'join' ? joinRoom() : void createRoom())}
              onCancel={cancelConnection}
              errorSlot={errorSlot}
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
              onOpenSettings={() => setSettingsSection('all')}
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
            <SelectionScreen game={game} player={player} reduceMotion={reduceMotion} onSelect={select} onLeave={leaveRoom} />
          )}
          {screen === 'waiting' && game && player && (
            <WaitingScreen game={game} player={player} reduceMotion={reduceMotion} onLeave={leaveRoom} />
          )}
          {screen === 'game' && game && player && (
            <GameScreen
              game={game}
              player={player}
              reduceMotion={reduceMotion}
              onToggle={toggle}
              onBack={leaveRoom}
              onRematch={rematch}
              onOpenSettings={() => setSettingsSection('all')}
            />
          )}
          {screen === 'single-player' && (
            <SinglePlayerScreen
              reduceMotion={reduceMotion}
              onBack={() => showScreen('home')}
              onSound={(kind) => playSound(kind)}
              onOpenStats={() => setSettingsSection('stats')}
              historyRevision={historyRevision}
            />
          )}
          <SettingsModal
            visible={settingsSection !== null}
            section={settingsSection ?? 'all'}
            onClose={() => setSettingsSection(null)}
            onTestSound={() => playSound('select', { sound: true })}
            onTestVibration={() => playSound('victory', { vibration: true })}
            onStatsCleared={() => setHistoryRevision((value) => value + 1)}
          />
          {/* Región viva: lectores de pantalla en web y Android anuncian cada cambio de fase. */}
          <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.srOnly}>
            {/* Vacía en el Solitario (se anuncia él mismo); el Text sigue montado para no perder la región. */}
            {screen === 'single-player' ? '' : `${screenTitle}. ${PHASE_HINTS[screen]}`}
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
