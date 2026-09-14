const http = require('http');
const { randomBytes } = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.ROOM_SERVER_PORT || 8787);
const rooms = new Map();
const VALID_GENERATIONS = new Set(['all', 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const RECONNECT_GRACE_MS = 60_000;
const ABANDONED_ROOM_RETENTION_MS = 5 * 60_000;

function createSessionToken() {
  return randomBytes(24).toString('hex');
}

function isPlayerId(value) {
  return value === 'p1' || value === 'p2';
}

function isValidPokemon(candidate) {
  return Boolean(candidate)
    && Number.isInteger(candidate.id)
    && candidate.id > 0
    && typeof candidate.name === 'string'
    && candidate.name.length > 0
    && Array.isArray(candidate.types)
    && candidate.types.length > 0
    && candidate.types.every((type) => typeof type === 'string')
    && typeof candidate.portraitUrl === 'string'
    && typeof candidate.normalUrl === 'string'
    && typeof candidate.sadUrl === 'string'
    && typeof candidate.fallbackUrl === 'string';
}

function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== 25 || !board.every(isValidPokemon)) return false;
  return new Set(board.map((pokemon) => pokemon.id)).size === board.length;
}

function send(socket, message) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function error(socket, message) {
  send(socket, { type: 'error', message });
}

function publicState(room, player) {
  const finished = room.phase === 'finished';
  return {
    phase: room.phase,
    roomCode: room.roomCode,
    generation: room.generation,
    board: room.board,
    playerCount: [room.players.p1.socket, room.players.p2.socket].filter(Boolean).length,
    presence: {
      p1: Boolean(room.players.p1.socket),
      p2: Boolean(room.players.p2.socket),
    },
    disconnectedPlayer: room.disconnectedPlayer,
    abandonedPlayer: room.abandonedPlayer,
    reconnectDeadline: room.reconnectDeadline,
    players: {
      p1: {
        secretId: player === 'p1' || finished ? room.players.p1.secretId : null,
        crossedIds: room.players.p1.crossedIds,
      },
      p2: {
        secretId: player === 'p2' || finished ? room.players.p2.secretId : null,
        crossedIds: room.players.p2.crossedIds,
      },
    },
    winner: room.winner,
  };
}

function broadcast(room) {
  for (const player of ['p1', 'p2']) {
    const socket = room.players[player].socket;
    if (socket) send(socket, { type: 'state', state: publicState(room, player), player, sessionToken: room.players[player].sessionToken });
  }
}

function clearDisconnectTimer(room, playerId) {
  const timer = room.disconnectTimers[playerId];
  if (timer) clearTimeout(timer);
  room.disconnectTimers[playerId] = null;
}

function markAbandoned(room, playerId) {
  if (!rooms.has(room.roomCode) || room.players[playerId].socket) return;
  room.abandonedPlayer = playerId;
  room.disconnectedPlayer = null;
  room.reconnectDeadline = null;
  room.phase = 'abandoned';
  room.winner = null;
  broadcast(room);
  setTimeout(() => {
    if (rooms.get(room.roomCode) === room && room.phase === 'abandoned' && !room.players.p1.socket && !room.players.p2.socket) rooms.delete(room.roomCode);
  }, ABANDONED_ROOM_RETENTION_MS);
}

function scheduleDisconnect(room, playerId) {
  clearDisconnectTimer(room, playerId);
  room.disconnectedPlayer = playerId;
  room.reconnectDeadline = Date.now() + RECONNECT_GRACE_MS;
  room.disconnectTimers[playerId] = setTimeout(() => markAbandoned(room, playerId), RECONNECT_GRACE_MS);
  broadcast(room);
}

function roomForSocket(socket) {
  return socket.roomCode ? rooms.get(socket.roomCode) : null;
}

// Cada jugador marca candidatos en su propio tablero. La victoria llega cuando
// su último candidato coincide con el secreto del rival; el secreto propio
// nunca debe usarse para resolver su tablero.
function winningPlayer(room) {
  for (const playerId of ['p1', 'p2']) {
    const opponentId = playerId === 'p1' ? 'p2' : 'p1';
    const opponentSecretId = room.players[opponentId].secretId;
    if (opponentSecretId === null) continue;
    const remaining = room.board.filter((pokemon) => !room.players[playerId].crossedIds.includes(pokemon.id));
    if (remaining.length === 1 && remaining[0].id === opponentSecretId) return playerId;
  }
  return null;
}

function handleCreate(socket, message) {
  const roomCode = String(message.roomCode || '').toUpperCase();
  if (socket.roomCode) return error(socket, 'Esta conexión ya está dentro de una sala.');
  if (!/^[A-Z2-9]{8}$/.test(roomCode)) return error(socket, 'El código de sala no es válido.');
  if (rooms.has(roomCode)) return error(socket, 'Ese código de sala ya está ocupado.');
  if (!isValidBoard(message.board)) return error(socket, 'La sala necesita 25 Pokémon válidos y distintos.');
  if (!VALID_GENERATIONS.has(message.generation)) return error(socket, 'La generación de la sala no es válida.');

  const room = {
    roomCode,
    generation: message.generation || 'all',
    board: message.board,
    phase: 'waiting-for-player',
    winner: null,
    players: {
      p1: { socket, secretId: null, crossedIds: [] },
      p2: { socket: null, secretId: null, crossedIds: [] },
    },
    disconnectTimers: { p1: null, p2: null },
    disconnectedPlayer: null,
    abandonedPlayer: null,
    reconnectDeadline: null,
  };
  room.players.p1.sessionToken = createSessionToken();
  rooms.set(roomCode, room);
  socket.roomCode = roomCode;
  socket.player = 'p1';
  send(socket, { type: 'state', state: publicState(room, 'p1'), player: 'p1', sessionToken: room.players.p1.sessionToken });
}

function handleJoin(socket, message) {
  const roomCode = String(message.roomCode || '').toUpperCase();
  if (socket.roomCode) return error(socket, 'Esta conexión ya está dentro de una sala.');
  const room = rooms.get(roomCode);
  if (!room) return error(socket, 'No existe una sala con ese código.');
  if (room.phase === 'finished') return error(socket, 'Esa partida ya ha terminado.');
  if (room.phase === 'abandoned') return error(socket, 'Esa partida terminó porque un jugador abandonó.');
  if (room.players.p2.socket) return error(socket, 'La sala ya tiene dos jugadores.');
  if (room.players.p2.sessionToken && room.disconnectedPlayer === 'p2') return error(socket, 'El jugador 2 tiene 1 minuto para reconectarse.');
  room.players.p2.socket = socket;
  room.players.p2.sessionToken = createSessionToken();
  clearDisconnectTimer(room, 'p2');
  room.disconnectedPlayer = null;
  room.reconnectDeadline = null;
  socket.roomCode = roomCode;
  socket.player = 'p2';
  room.phase = 'selecting';
  broadcast(room);
}

function handleReconnect(socket, message) {
  if (socket.roomCode) return error(socket, 'Esta conexión ya está dentro de una sala.');
  const roomCode = String(message.roomCode || '').toUpperCase();
  const playerId = message.player;
  const room = rooms.get(roomCode);
  if (!room || !isPlayerId(playerId)) return error(socket, 'No se puede recuperar esa sala.');
  if (room.phase === 'abandoned') return error(socket, 'La partida terminó porque el rival abandonó.');
  const player = room.players[playerId];
  if (typeof message.sessionToken !== 'string' || message.sessionToken !== player.sessionToken) return error(socket, 'La sesión de jugador no es válida.');
  if (player.socket) return error(socket, 'Ese jugador ya está conectado.');
  if (room.reconnectDeadline && Date.now() >= room.reconnectDeadline) {
    markAbandoned(room, playerId);
    return error(socket, 'El tiempo de reconexión ha terminado.');
  }
  player.socket = socket;
  socket.roomCode = roomCode;
  socket.player = playerId;
  clearDisconnectTimer(room, playerId);
  room.disconnectedPlayer = room.players.p1.socket && room.players.p2.socket ? null : room.disconnectedPlayer;
  room.reconnectDeadline = room.disconnectedPlayer ? room.reconnectDeadline : null;
  broadcast(room);
}

function handleSelect(socket, message) {
  const room = roomForSocket(socket);
  if (!room || !isPlayerId(socket.player)) return error(socket, 'No estás dentro de una sala.');
  if (room.phase !== 'selecting' && room.phase !== 'waiting-for-selection') return error(socket, 'La selección ya no está disponible.');
  const id = Number(message.id);
  if (!room.board.some((pokemon) => pokemon.id === id)) return error(socket, 'Ese Pokémon no pertenece a esta sala.');
  const player = room.players[socket.player];
  if (player.secretId !== null) return error(socket, 'Ya has elegido tu Pokémon secreto.');
  player.secretId = id;
  const bothSelected = room.players.p1.secretId !== null && room.players.p2.secretId !== null;
  room.phase = bothSelected ? 'playing' : 'waiting-for-selection';
  broadcast(room);
}

function handleRematch(socket) {
  const room = roomForSocket(socket);
  if (!room || !isPlayerId(socket.player)) return error(socket, 'No estás dentro de una sala.');
  if (room.phase !== 'finished' && room.phase !== 'selecting') return error(socket, 'La partida todavía no ha terminado.');
  room.phase = 'selecting';
  room.winner = null;
  room.abandonedPlayer = null;
  room.disconnectedPlayer = null;
  room.reconnectDeadline = null;
  room.players.p1.secretId = null;
  room.players.p1.crossedIds = [];
  room.players.p2.secretId = null;
  room.players.p2.crossedIds = [];
  broadcast(room);
}

function handleToggle(socket, message) {
  const room = roomForSocket(socket);
  if (!room || !isPlayerId(socket.player)) return error(socket, 'No estás dentro de una sala.');
  if (room.phase !== 'playing') return error(socket, 'La partida todavía no está en juego.');
  const id = Number(message.id);
  if (!room.board.some((pokemon) => pokemon.id === id)) return error(socket, 'Ese Pokémon no pertenece a esta sala.');
  const player = room.players[socket.player];
  const crossed = player.crossedIds.includes(id);
  const nextCrossedIds = crossed ? player.crossedIds.filter((candidateId) => candidateId !== id) : [...player.crossedIds, id];
  const remaining = room.board.filter((pokemon) => !nextCrossedIds.includes(pokemon.id));
  if (remaining.length === 0) return error(socket, 'Debe quedar al menos un Pokémon sin tachar.');
  player.crossedIds = nextCrossedIds;
  const winner = winningPlayer(room);
  if (winner) {
    room.phase = 'finished';
    room.winner = winner;
  }
  broadcast(room);
}

function handleMessage(socket, raw) {
  let message;
  try {
    message = JSON.parse(String(raw));
  } catch {
    return error(socket, 'Mensaje no válido.');
  }
  if (!message || typeof message.type !== 'string') return error(socket, 'Mensaje no válido.');
  if (message.type === 'create') return handleCreate(socket, message);
  if (message.type === 'join') return handleJoin(socket, message);
  if (message.type === 'reconnect') return handleReconnect(socket, message);
  if (message.type === 'select') return handleSelect(socket, message);
  if (message.type === 'toggle') return handleToggle(socket, message);
  if (message.type === 'rematch') return handleRematch(socket);
  error(socket, 'Acción no reconocida.');
}

function handleClose(socket) {
  const room = roomForSocket(socket);
  if (!room || !isPlayerId(socket.player)) return;
  const participant = room.players[socket.player];
  if (participant.socket !== socket) return;
  participant.socket = null;
  if (room.phase === 'abandoned') return;
  if (room.phase === 'finished') {
    broadcast(room);
    if (!room.players.p1.socket && !room.players.p2.socket) rooms.delete(room.roomCode);
    return;
  }
  scheduleDisconnect(room, socket.player);
}

const httpServer = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
});
const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });
wss.on('connection', (socket) => {
  socket.on('message', (message) => handleMessage(socket, message));
  socket.on('close', () => handleClose(socket));
});
let startupErrorReported = false;
function handleStartupError(error) {
  if (startupErrorReported) return;
  startupErrorReported = true;
  if (error && error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya está en uso. Cierra la instancia anterior o, en PowerShell, usa $env:ROOM_SERVER_PORT=18787; npm run room-server.`);
    process.exitCode = 1;
    return;
  }
  console.error('No se pudo iniciar el servidor de salas.', error);
  process.exitCode = 1;
}
httpServer.on('error', handleStartupError);
wss.on('error', handleStartupError);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Room server listening on ws://0.0.0.0:${PORT}`);
});
