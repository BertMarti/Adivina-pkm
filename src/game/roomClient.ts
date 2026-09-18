import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { GenerationId, PokemonCandidate } from '../data/pokemon';
import { LocalGameState, PlayerId } from './engine';

export type RoomGameState = LocalGameState & {
  generation: GenerationId;
  presence: Record<PlayerId, boolean>;
  disconnectedPlayer: PlayerId | null;
  abandonedPlayer: PlayerId | null;
  reconnectDeadline: number | null;
};

type RoomRequest =
  | { type: 'create'; roomCode: string; generation: GenerationId; board: PokemonCandidate[] }
  | { type: 'join'; roomCode: string }
  | { type: 'reconnect'; roomCode: string; player: PlayerId; sessionToken: string }
  | { type: 'rematch' }
  | { type: 'select'; id: number }
  | { type: 'toggle'; id: number };

type RoomResponse =
  | { type: 'state'; state: RoomGameState; player: PlayerId; sessionToken?: string }
  | { type: 'error'; message: string };

type RoomSocket = WebSocket & {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
};

// The hosted room service is the safe default for physical phones and for
// release builds. Local development can still override it with
// EXPO_PUBLIC_ROOM_SERVER_URL=ws://localhost:8787 (or a LAN IP).
const DEFAULT_ROOM_SERVER_URL = 'wss://pokequien-rooms.onrender.com';
const ROOM_CONNECTION_TIMEOUT_MS = 12_000;

function getServerUrls() {
  const configured = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_ROOM_SERVER_URL : undefined;
  return Array.from(new Set([configured?.trim(), DEFAULT_ROOM_SERVER_URL].filter(Boolean))) as string[];
}

function connectionError() {
  return new Error('No se pudo conectar con el servidor de salas. Comprueba tu conexión e inténtalo de nuevo.');
}

type SavedRoomSession = Readonly<{ roomCode: string; player: PlayerId; sessionToken: string }>;
const SESSION_STORAGE_PREFIX = 'adivina-pkm:room-session:';

type SessionStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function getSessionStore(): SessionStore {
  // En web, cada pestaña representa una sesión de jugador distinta. Usar
  // localStorage aquí haría que J2 heredase el token de J1 al emular dos
  // jugadores en el mismo navegador. sessionStorage sigue sobreviviendo a
  // una recarga, pero queda aislado por pestaña.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    return {
      getItem: async (key) => window.sessionStorage.getItem(key),
      setItem: async (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: async (key) => window.sessionStorage.removeItem(key),
    };
  }
  // The reconnect token is a capability, not an account credential. Secure
  // Store keeps it out of plain app preferences on Android/iOS while the web
  // tab remains isolated through sessionStorage.
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

function sessionKey(roomCode: string) {
  return `${SESSION_STORAGE_PREFIX}${roomCode.toUpperCase()}`;
}

async function readSavedSession(roomCode: string): Promise<SavedRoomSession | null> {
  try {
    const raw = await getSessionStore().getItem(sessionKey(roomCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedRoomSession>;
    if ((parsed.player !== 'p1' && parsed.player !== 'p2') || typeof parsed.sessionToken !== 'string') return null;
    return { roomCode: roomCode.toUpperCase(), player: parsed.player, sessionToken: parsed.sessionToken };
  } catch {
    return null;
  }
}

async function saveSession(session: SavedRoomSession) {
  try { await getSessionStore().setItem(sessionKey(session.roomCode), JSON.stringify(session)); } catch { /* best effort */ }
}

async function clearSavedSession(roomCode: string | null) {
  if (!roomCode) return;
  try { await getSessionStore().removeItem(sessionKey(roomCode)); } catch { /* best effort */ }
}

export class RoomClient {
  private socket: RoomSocket | null = null;
  private readonly onState: (state: RoomGameState, player: PlayerId) => void;
  private readonly onError: (message: string) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDeadline = 0;
  private intentionalClose = false;
  private roomCode: string | null = null;
  private sessionToken: string | null = null;
  playerId: PlayerId | null = null;

  constructor(onState: (state: RoomGameState, player: PlayerId) => void, onError: (message: string) => void) {
    this.onState = onState;
    this.onError = onError;
  }

  async connect(request: Extract<RoomRequest, { type: 'create' | 'join' }>) {
    this.close({ forgetSession: false });
    const saved = request.type === 'join' ? await readSavedSession(request.roomCode) : null;
    if (saved) {
      this.roomCode = saved.roomCode;
      this.playerId = saved.player;
      this.sessionToken = saved.sessionToken;
      return this.open({ type: 'reconnect', roomCode: saved.roomCode, player: saved.player, sessionToken: saved.sessionToken });
    }
    return this.open(request);
  }

  private open(request: Extract<RoomRequest, { type: 'create' | 'join' | 'reconnect' }>, serverIndex = 0) {
    return new Promise<RoomGameState>((resolve, reject) => {
      let settled = false;
      let connected = false;
      const serverUrls = getServerUrls();
      const serverUrl = serverUrls[Math.min(serverIndex, serverUrls.length - 1)];
      const socket = new WebSocket(serverUrl) as RoomSocket;
      this.socket = socket;
      this.intentionalClose = false;
      const fallbackOrReject = (cause: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (serverIndex + 1 < serverUrls.length && !this.intentionalClose) {
          socket.close();
          this.open(request, serverIndex + 1).then(resolve, reject);
          return;
        }
        reject(cause);
      };
      const timeout = setTimeout(() => {
        fallbackOrReject(connectionError());
        socket.close();
      }, ROOM_CONNECTION_TIMEOUT_MS);

      socket.onopen = () => {
        connected = true;
        socket.send(JSON.stringify(request));
      };
      socket.onmessage = (event) => {
        let message: RoomResponse;
        try {
          message = JSON.parse(String(event.data)) as RoomResponse;
        } catch {
          return;
        }
        if (message.type === 'error') {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            reject(new Error(message.message));
          }
          this.onError(message.message);
          return;
        }
        clearTimeout(timeout);
        this.playerId = message.player;
        this.roomCode = message.state.roomCode;
        if (message.sessionToken) this.sessionToken = message.sessionToken;
        if (this.sessionToken && this.playerId) void saveSession({ roomCode: message.state.roomCode, player: this.playerId, sessionToken: this.sessionToken });
        if (message.state.reconnectDeadline) this.reconnectDeadline = message.state.reconnectDeadline;
        if (message.state.phase === 'abandoned') void clearSavedSession(message.state.roomCode);
        if (!settled) {
          settled = true;
          resolve(message.state);
        }
        this.onState(message.state, message.player);
      };
      socket.onerror = () => {
        if (!settled) return fallbackOrReject(connectionError());
        if (connected) this.onError('Se perdió la conexión. Intentando reconectar durante 1 minuto…');
      };
      socket.onclose = () => {
        if (!settled) fallbackOrReject(new Error('El servidor cerró la sala antes de responder.'));
        if (this.socket === socket) this.socket = null;
        if (this.intentionalClose || !this.sessionToken || !this.playerId || !this.roomCode) return;
        this.reconnectDeadline = this.reconnectDeadline || Date.now() + 60_000;
        this.scheduleReconnect();
      };
    });
  }

  create(roomCode: string, generation: GenerationId, board: PokemonCandidate[]) {
    return this.connect({ type: 'create', roomCode, generation, board });
  }

  join(roomCode: string) {
    return this.connect({ type: 'join', roomCode });
  }

  select(id: number) {
    this.send({ type: 'select', id });
  }

  toggle(id: number) {
    this.send({ type: 'toggle', id });
  }

  rematch() {
    this.send({ type: 'rematch' });
  }

  close(options: { forgetSession?: boolean } = {}) {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    if (options.forgetSession) void clearSavedSession(this.roomCode);
    this.playerId = null;
    this.sessionToken = null;
    this.roomCode = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.intentionalClose) return;
    const remaining = this.reconnectDeadline - Date.now();
    if (remaining <= 0) {
      this.onError('La partida ha terminado porque el jugador no se reconectó en 1 minuto.');
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.tryReconnect();
    }, Math.min(2_000, remaining));
  }

  private async tryReconnect() {
    if (this.intentionalClose || !this.roomCode || !this.playerId || !this.sessionToken) return;
    if (Date.now() >= this.reconnectDeadline) {
      this.onError('La partida ha terminado porque el jugador no se reconectó en 1 minuto.');
      return;
    }
    try {
      await this.open({ type: 'reconnect', roomCode: this.roomCode, player: this.playerId, sessionToken: this.sessionToken });
      this.reconnectDeadline = 0;
      this.onError('');
    } catch {
      this.onError('Se perdió la conexión. Intentando reconectar durante 1 minuto…');
      this.scheduleReconnect();
    }
  }

  private send(message: Extract<RoomRequest, { type: 'select' | 'toggle' | 'rematch' }>) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.onError('La sala no está conectada.');
      return;
    }
    this.socket.send(JSON.stringify(message));
  }
}
