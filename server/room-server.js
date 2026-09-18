const http = require('http');
const { randomBytes, timingSafeEqual } = require('crypto');
const { WebSocketServer } = require('ws');

// Render, Railway y otros PaaS inyectan PORT. ROOM_SERVER_PORT se conserva
// para el desarrollo local y para no romper los comandos existentes.
const PORT = Number(process.env.PORT || process.env.ROOM_SERVER_PORT || 8787);
const rooms = new Map();
const VALID_GENERATIONS = new Set(['all', 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const RECONNECT_GRACE_MS = 60_000;
const ABANDONED_ROOM_RETENTION_MS = 5 * 60_000;
const ROOM_IDLE_TTL_MS = 30 * 60_000;
const MAX_ROOMS = 500;
const MESSAGE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 40;
const MAX_TEXT_LENGTH = 512;
const HTTP_SESSION_TTL_MS = 60_000;
const allowedOrigins = String(process.env.ROOM_SERVER_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const httpSessions = new Map();

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
    && candidate.id <= 1025
    && typeof candidate.name === 'string'
    && candidate.name.length > 0
    && candidate.name.length <= MAX_TEXT_LENGTH
    && Array.isArray(candidate.types)
    && candidate.types.length > 0
    && candidate.types.every((type) => typeof type === 'string' && type.length <= MAX_TEXT_LENGTH)
    && [candidate.portraitUrl, candidate.normalUrl, candidate.sadUrl, candidate.fallbackUrl]
      .every((value) => typeof value === 'string' && value.length <= MAX_TEXT_LENGTH && /^(https?:\/\/|data:image\/)/i.test(value));
}

function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== 25 || !board.every(isValidPokemon)) return false;
  return new Set(board.map((pokemon) => pokemon.id)).size === board.length;
}

function send(socket, message) {
  if (socket.transport === 'http') {
    socket.lastMessage = message;
    if (message.sessionToken) {
      socket.sessionToken = message.sessionToken;
      httpSessions.set(message.sessionToken, socket);
    }
    return;
  }
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function error(socket, message) {
  send(socket, { type: 'error', message });
}

function publicState(room, player) {
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
        secretId: player === 'p1' ? room.players.p1.secretId : null,
        crossedIds: room.players.p1.crossedIds,
      },
      p2: {
        secretId: player === 'p2' ? room.players.p2.secretId : null,
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
  const room = socket.roomCode ? rooms.get(socket.roomCode) : null;
  if (room) {
    room.lastActivity = Date.now();
    if (socket.transport === 'http') socket.lastSeen = Date.now();
  }
  return room;
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
  if (rooms.size >= MAX_ROOMS) return error(socket, 'El servidor está lleno temporalmente. Inténtalo de nuevo en unos minutos.');
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
    lastActivity: Date.now(),
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
  if (typeof message.sessionToken !== 'string' || typeof player.sessionToken !== 'string' || message.sessionToken.length !== player.sessionToken.length) return error(socket, 'La sesión de jugador no es válida.');
  const providedToken = Buffer.from(message.sessionToken);
  const expectedToken = Buffer.from(player.sessionToken);
  if (providedToken.length !== expectedToken.length || !timingSafeEqual(providedToken, expectedToken)) return error(socket, 'La sesión de jugador no es válida.');
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

function makeHttpSession() {
  return {
    transport: 'http',
    readyState: 1,
    OPEN: 1,
    roomCode: null,
    player: null,
    sessionToken: null,
    lastSeen: Date.now(),
    lastMessage: null,
  };
}

function httpHeaders(request) {
  const origin = request.headers.origin;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return headers;
}

function sendHttpJson(request, response, statusCode, payload) {
  response.writeHead(statusCode, httpHeaders(request));
  response.end(JSON.stringify(payload));
}

function readHttpJson(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) reject(new Error('Payload demasiado grande.'));
    });
    request.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON no válido.')); }
    });
    request.on('error', reject);
  });
}

function httpRoomCode(pathname) {
  const match = pathname.match(/^\/api\/rooms\/([A-Z2-9]{8})(?:\/|$)/i);
  return match?.[1]?.toUpperCase() ?? '';
}

function httpSessionFor(request, roomCode) {
  const room = rooms.get(roomCode);
  const playerId = String(request.headers['x-player'] || '');
  const providedToken = String(request.headers['x-session-token'] || '');
  if (!room || !isPlayerId(playerId) || !providedToken) return null;
  const player = room.players[playerId];
  const expectedToken = typeof player.sessionToken === 'string' ? player.sessionToken : '';
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  if (!player.socket || player.socket.transport !== 'http' || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  player.socket.lastSeen = Date.now();
  room.lastActivity = Date.now();
  return player.socket;
}

function httpResponseForSession(request, response, session) {
  const room = rooms.get(session.roomCode);
  const message = session.lastMessage || (room
    ? { type: 'state', state: publicState(room, session.player), player: session.player, sessionToken: session.sessionToken }
    : { type: 'error', message: 'La sala ya no está disponible.' });
  sendHttpJson(request, response, 200, message);
}

async function handleHttpRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  if (request.method === 'OPTIONS') {
    response.writeHead(204, httpHeaders(request));
    response.end();
    return;
  }
  if (request.method === 'GET' && pathname === '/') {
    sendHttpJson(request, response, 200, { ok: true, rooms: rooms.size, transports: ['websocket', 'https-polling'] });
    return;
  }

  try {
    if (request.method === 'POST' && pathname === '/api/rooms') {
      const session = makeHttpSession();
      handleCreate(session, await readHttpJson(request));
      httpResponseForSession(request, response, session);
      return;
    }

    const roomCode = httpRoomCode(pathname);
    if (!roomCode) {
      sendHttpJson(request, response, 404, { type: 'error', message: 'Ruta no encontrada.' });
      return;
    }

    const action = pathname.slice(`/api/rooms/${roomCode}`.length).replace(/^\//, '');
    if (request.method === 'POST' && action === 'join') {
      const session = makeHttpSession();
      handleJoin(session, { roomCode });
      httpResponseForSession(request, response, session);
      return;
    }
    if (request.method === 'POST' && action === 'reconnect') {
      const message = await readHttpJson(request);
      const session = makeHttpSession();
      handleReconnect(session, { ...message, roomCode });
      httpResponseForSession(request, response, session);
      return;
    }

    const session = httpSessionFor(request, roomCode);
    if (!session) {
      sendHttpJson(request, response, 401, { type: 'error', message: 'La sesión de sala no es válida o ha caducado.' });
      return;
    }
    session.lastMessage = null;

    if (request.method === 'GET' && action === 'state') {
      httpResponseForSession(request, response, session);
      return;
    }
    if (request.method === 'DELETE' && action === '') {
      handleClose(session);
      if (session.sessionToken) httpSessions.delete(session.sessionToken);
      sendHttpJson(request, response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && ['select', 'toggle', 'rematch'].includes(action)) {
      const message = await readHttpJson(request);
      handleMessage(session, JSON.stringify({ ...message, type: action }));
      httpResponseForSession(request, response, session);
      return;
    }
    sendHttpJson(request, response, 404, { type: 'error', message: 'Acción no reconocida.' });
  } catch (error) {
    sendHttpJson(request, response, 400, { type: 'error', message: error instanceof Error ? error.message : 'Solicitud no válida.' });
  }
}

const httpServer = http.createServer((request, response) => {
  void handleHttpRequest(request, response);
});
function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return true;
  if (allowedOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 64 * 1024,
  verifyClient: (info, done) => done(isAllowedOrigin(info.origin)),
});
wss.on('connection', (socket) => {
  socket.messageWindowStartedAt = Date.now();
  socket.messageCount = 0;
  socket.on('message', (message) => {
    const now = Date.now();
    if (now - socket.messageWindowStartedAt >= MESSAGE_WINDOW_MS) {
      socket.messageWindowStartedAt = now;
      socket.messageCount = 0;
    }
    socket.messageCount += 1;
    if (socket.messageCount > MAX_MESSAGES_PER_WINDOW) {
      socket.close(1008, 'Demasiados mensajes');
      return;
    }
    handleMessage(socket, message);
  });
  socket.on('close', () => handleClose(socket));
});
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [sessionToken, session] of httpSessions) {
    if (now - session.lastSeen <= HTTP_SESSION_TTL_MS) continue;
    if (session.roomCode) handleClose(session);
    httpSessions.delete(sessionToken);
  }
  for (const [roomCode, room] of rooms) {
    if (!room.players.p1.socket && !room.players.p2.socket && now - room.lastActivity > ROOM_IDLE_TTL_MS) rooms.delete(roomCode);
  }
}, 60_000);
cleanupTimer.unref?.();
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
