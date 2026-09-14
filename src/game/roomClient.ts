import { Platform } from 'react-native';
import { GenerationId, PokemonCandidate } from '../data/pokemon';
import { LocalGameState, PlayerId } from './engine';

export type RoomGameState = LocalGameState & {
  generation: GenerationId;
};

type RoomRequest =
  | { type: 'create'; roomCode: string; generation: GenerationId; board: PokemonCandidate[] }
  | { type: 'join'; roomCode: string }
  | { type: 'select'; id: number }
  | { type: 'toggle'; id: number };

type RoomResponse =
  | { type: 'state'; state: RoomGameState; player: PlayerId }
  | { type: 'error'; message: string };

type RoomSocket = WebSocket & {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
};

function getServerUrl() {
  const configured = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_ROOM_SERVER_URL : undefined;
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `ws://${window.location.hostname}:8787`;
  }
  return 'ws://10.0.2.2:8787';
}

export class RoomClient {
  private socket: RoomSocket | null = null;
  private readonly onState: (state: RoomGameState, player: PlayerId) => void;
  private readonly onError: (message: string) => void;
  playerId: PlayerId | null = null;

  constructor(onState: (state: RoomGameState, player: PlayerId) => void, onError: (message: string) => void) {
    this.onState = onState;
    this.onError = onError;
  }

  connect(request: Extract<RoomRequest, { type: 'create' | 'join' }>) {
    this.close();
    return new Promise<RoomGameState>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(getServerUrl()) as RoomSocket;
      this.socket = socket;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.close();
          reject(new Error('No se pudo conectar con la sala local. Arranca el servidor con npm run room-server.'));
        }
      }, 5000);

      socket.onopen = () => socket.send(JSON.stringify(request));
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
        if (!settled) {
          settled = true;
          resolve(message.state);
        }
        this.onState(message.state, message.player);
      };
      socket.onerror = () => {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          reject(new Error('No se pudo conectar con el servidor de salas.'));
        }
        this.onError('Se perdió la conexión con la sala.');
      };
      socket.onclose = () => {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          reject(new Error('El servidor cerró la sala antes de responder.'));
        }
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

  close() {
    this.socket?.close();
    this.socket = null;
    this.playerId = null;
  }

  private send(message: Extract<RoomRequest, { type: 'select' | 'toggle' }>) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.onError('La sala no está conectada.');
      return;
    }
    this.socket.send(JSON.stringify(message));
  }
}
