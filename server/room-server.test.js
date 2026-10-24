'use strict';

const assert = require('node:assert/strict');
const http = require('http');
const { test } = require('node:test');
const WebSocket = require('ws');

const { createRoomServer } = require('./room-server.js');

const SILENT_LOGGER = { info() {}, warn() {}, error() {}, log() {} };

function makeBoard(size = 25) {
  return Array.from({ length: size }, (_, index) => {
    const id = index + 1;
    return {
      id,
      name: `Pokémon de prueba ${id}`,
      types: ['normal'],
      portraitUrl: `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${String(id).padStart(4, '0')}/Happy.png`,
      normalUrl: `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${String(id).padStart(4, '0')}/Normal.png`,
      sadUrl: `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${String(id).padStart(4, '0')}/Sad.png`,
      fallbackUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
    };
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wrapClient(ws) {
  const messages = [];
  const messageWaiters = [];
  let closeEvent = null;
  const closeWaiters = [];
  ws.on('message', (data) => {
    const message = JSON.parse(String(data));
    if (messageWaiters.length > 0) messageWaiters.shift()(message);
    else messages.push(message);
  });
  ws.on('close', (code, reason) => {
    closeEvent = { code, reason: reason.toString() };
    while (closeWaiters.length > 0) closeWaiters.shift()(closeEvent);
  });
  // Los cortes de red se recogen mediante el evento 'close' en los tests.
  ws.on('error', () => {});
  return {
    ws,
    send(message) {
      ws.send(JSON.stringify(message));
    },
    sendRaw(raw) {
      ws.send(raw);
    },
    nextMessage(timeoutMs = 5000) {
      if (messages.length > 0) return Promise.resolve(messages.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Se agotó el tiempo esperando un mensaje del servidor.')), timeoutMs);
        messageWaiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    nextClose(timeoutMs = 5000) {
      if (closeEvent) return Promise.resolve(closeEvent);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Se agotó el tiempo esperando el cierre del socket.')), timeoutMs);
        closeWaiters.push((event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });
    },
    terminate() {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.terminate();
    },
  };
}

function createClientTracker() {
  const clients = [];
  return {
    async open(port, options = {}) {
      const client = wrapClient(new WebSocket(`ws://127.0.0.1:${port}`, options));
      clients.push(client);
      await new Promise((resolve, reject) => {
        client.ws.once('open', resolve);
        client.ws.once('error', reject);
      });
      return client;
    },
    connectRaw(port, options = {}) {
      const client = wrapClient(new WebSocket(`ws://127.0.0.1:${port}`, options));
      clients.push(client);
      return client;
    },
    closeAll() {
      for (const client of clients) client.terminate();
    },
  };
}

async function startServer(t, options = {}) {
  const server = createRoomServer({ logger: SILENT_LOGGER, ...options });
  const port = await server.listen(0);
  const tracker = createClientTracker();
  t.after(async () => {
    tracker.closeAll();
    await server.close();
  });
  return { server, port, tracker };
}

function httpRequest(port, { method = 'GET', path = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = http.request({ host: '127.0.0.1', port, method, path, headers, agent: false }, (response) => {
      let raw = '';
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve({ statusCode: response.statusCode, headers: response.headers, body: raw });
      };
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', settle);
      response.on('close', settle);
      response.on('error', settle);
    });
    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    if (body !== null) request.write(body);
    request.end();
  });
}

test('el servidor responde al health check GET / con {ok:true}', async (t) => {
  const { port } = await startServer(t);
  const response = await httpRequest(port, { method: 'GET', path: '/' });
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.ok, true);
});

test('flujo completo por WebSocket: crear, unirse, elegir, jugar y ganar', async (t) => {
  const { port, tracker } = await startServer(t);
  const roomCode = 'FLUJO234';
  const p1 = await tracker.open(port);
  p1.send({ type: 'create', roomCode, generation: 'all', board: makeBoard() });
  const created = await p1.nextMessage();
  assert.equal(created.type, 'state');
  assert.equal(created.player, 'p1');
  assert.equal(typeof created.sessionToken, 'string');
  assert.equal(created.state.phase, 'waiting-for-player');
  assert.equal(created.state.roomCode, roomCode);
  assert.equal(created.state.playerCount, 1);

  const p2 = await tracker.open(port);
  p2.send({ type: 'join', roomCode });
  const [p1Selecting, p2Selecting] = await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  assert.equal(p1Selecting.state.phase, 'selecting');
  assert.equal(p2Selecting.state.phase, 'selecting');
  assert.equal(p2Selecting.player, 'p2');
  assert.equal(p2Selecting.state.playerCount, 2);

  p1.send({ type: 'select', id: 1 });
  const [p1Waiting, p2Waiting] = await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  assert.equal(p1Waiting.state.phase, 'waiting-for-selection');
  assert.equal(p1Waiting.state.players.p1.secretId, 1);
  assert.equal(p2Waiting.state.players.p1.secretId, null);

  p2.send({ type: 'select', id: 2 });
  const [p1Playing, p2Playing] = await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  assert.equal(p1Playing.state.phase, 'playing');
  assert.equal(p2Playing.state.phase, 'playing');

  for (let id = 3; id <= 25; id += 1) {
    p1.send({ type: 'toggle', id });
    await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  }

  p1.send({ type: 'toggle', id: 1 });
  const [p1Finished, p2Finished] = await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  assert.equal(p1Finished.state.phase, 'finished');
  assert.equal(p1Finished.state.winner, 'p1');
  assert.equal(p2Finished.state.phase, 'finished');
  assert.equal(p2Finished.state.winner, 'p1');
  const remaining = p1Finished.state.board.filter(
    (pokemon) => !p1Finished.state.players.p1.crossedIds.includes(pokemon.id),
  );
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 2);
});

test('privacidad: el rival recibe secretId null al ver el estado', async (t) => {
  const { port, tracker } = await startServer(t);
  const roomCode = 'PRIV2345';
  const p1 = await tracker.open(port);
  p1.send({ type: 'create', roomCode, generation: 1, board: makeBoard() });
  await p1.nextMessage();
  const p2 = await tracker.open(port);
  p2.send({ type: 'join', roomCode });
  await Promise.all([p1.nextMessage(), p2.nextMessage()]);

  p1.send({ type: 'select', id: 7 });
  const [p1State, p2State] = await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  assert.equal(p1State.state.players.p1.secretId, 7);
  assert.equal(p2State.state.players.p1.secretId, null);
  assert.equal(p2State.state.players.p2.secretId, null);
});

test('responde {type:"error"} ante mensajes y situaciones inválidas', async (t) => {
  const { port, tracker } = await startServer(t);
  const board = makeBoard();
  const client = await tracker.open(port);

  client.sendRaw('esto no es json');
  const broken = await client.nextMessage();
  assert.equal(broken.type, 'error');
  assert.equal(broken.message, 'Mensaje no válido.');

  client.sendRaw('[1,2,3]');
  const array = await client.nextMessage();
  assert.equal(array.type, 'error');
  assert.equal(array.message, 'Mensaje no válido.');

  client.send({ type: 'accion-desconocida' });
  const unknownType = await client.nextMessage();
  assert.equal(unknownType.type, 'error');
  assert.equal(unknownType.message, 'Acción no reconocida.');

  client.send({ type: 'create', roomCode: 'corto', generation: 'all', board });
  const badCode = await client.nextMessage();
  assert.equal(badCode.type, 'error');
  assert.equal(badCode.message, 'El código de sala no es válido.');

  client.send({ type: 'create', roomCode: 'CORTA234', generation: 'all', board: makeBoard(24) });
  const shortBoard = await client.nextMessage();
  assert.equal(shortBoard.type, 'error');
  assert.equal(shortBoard.message, 'La sala necesita 25 Pokémon válidos y distintos.');

  client.send({ type: 'create', roomCode: 'GEN23456', generation: 99, board });
  const badGeneration = await client.nextMessage();
  assert.equal(badGeneration.type, 'error');
  assert.equal(badGeneration.message, 'La generación de la sala no es válida.');

  const roomCode = 'ERRO2345';
  client.send({ type: 'create', roomCode, generation: 'all', board });
  const created = await client.nextMessage();
  assert.equal(created.type, 'state');

  const p2 = await tracker.open(port);
  p2.send({ type: 'join', roomCode });
  await Promise.all([client.nextMessage(), p2.nextMessage()]);

  client.send({ type: 'select', id: 999 });
  const selectError = await client.nextMessage();
  assert.equal(selectError.type, 'error');
  assert.equal(selectError.message, 'Ese Pokémon no pertenece a esta sala.');

  client.send({ type: 'toggle', id: 1 });
  const toggleError = await client.nextMessage();
  assert.equal(toggleError.type, 'error');
  assert.equal(toggleError.message, 'La partida todavía no está en juego.');
});

test('no se puede tachar el último candidato del tablero', async (t) => {
  const { port, tracker } = await startServer(t);
  const roomCode = 'TACH2345';
  const p1 = await tracker.open(port);
  p1.send({ type: 'create', roomCode, generation: 'all', board: makeBoard() });
  await p1.nextMessage();
  const p2 = await tracker.open(port);
  p2.send({ type: 'join', roomCode });
  await Promise.all([p1.nextMessage(), p2.nextMessage()]);
  p1.send({ type: 'select', id: 1 });
  p2.send({ type: 'select', id: 2 });
  await Promise.all([p1.nextMessage(), p1.nextMessage(), p2.nextMessage(), p2.nextMessage()]);

  for (let id = 2; id <= 24; id += 1) {
    p1.send({ type: 'toggle', id });
    await p1.nextMessage();
  }
  p1.send({ type: 'toggle', id: 25 });
  const oneLeft = await p1.nextMessage();
  assert.equal(oneLeft.state.players.p1.crossedIds.length, 24);
  assert.equal(oneLeft.state.phase, 'playing');

  p1.send({ type: 'toggle', id: 1 });
  const blocked = await p1.nextMessage();
  assert.equal(blocked.type, 'error');
  assert.equal(blocked.message, 'Debe quedar al menos un Pokémon sin tachar.');

  p2.send({ type: 'toggle', id: 3 });
  const afterBlocked = await p1.nextMessage();
  assert.equal(afterBlocked.state.players.p1.crossedIds.length, 24);
  assert.equal(afterBlocked.state.phase, 'playing');
});

test('reconexión: el token incorrecto falla y el correcto recupera la sala', async (t) => {
  const { port, tracker } = await startServer(t);
  const roomCode = 'RECO2345';
  const p1 = await tracker.open(port);
  p1.send({ type: 'create', roomCode, generation: 'all', board: makeBoard() });
  const created = await p1.nextMessage();
  const sessionToken = created.sessionToken;

  p1.ws.close();
  await p1.nextClose();
  await sleep(50);

  const rejected = await tracker.open(port);
  rejected.send({ type: 'reconnect', roomCode, player: 'p1', sessionToken: '0'.repeat(sessionToken.length) });
  const error = await rejected.nextMessage();
  assert.equal(error.type, 'error');
  assert.equal(error.message, 'La sesión de jugador no es válida.');
  rejected.terminate();

  const recovered = await tracker.open(port);
  recovered.send({ type: 'reconnect', roomCode, player: 'p1', sessionToken });
  const state = await recovered.nextMessage();
  assert.equal(state.type, 'state');
  assert.equal(state.player, 'p1');
  assert.equal(state.sessionToken, sessionToken);
  assert.equal(state.state.phase, 'waiting-for-player');
  assert.equal(state.state.roomCode, roomCode);
});

test('cierra con 1008 al superar el límite de mensajes por ventana', async (t) => {
  const { port, tracker } = await startServer(t, { maxMessagesPerWindow: 3 });
  const client = await tracker.open(port);
  for (let index = 0; index < 3; index += 1) {
    client.send({ type: 'accion-desconocida', index });
    const error = await client.nextMessage();
    assert.equal(error.type, 'error');
  }
  client.send({ type: 'accion-desconocida', index: 3 });
  const closed = await client.nextClose();
  assert.equal(closed.code, 1008);
});

test('rechaza el origen no permitido y acepta el listado en allowedOrigins', async (t) => {
  const { port, tracker } = await startServer(t, { allowedOrigins: ['https://bertmarti.github.io'] });
  const rejected = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://malicioso.example' });
    ws.on('open', () => {
      ws.terminate();
      resolve({ connected: true, statusCode: null });
    });
    ws.on('error', () => resolve({ connected: false, statusCode: null }));
    ws.on('unexpected-response', (_request, response) => {
      response.resume();
      resolve({ connected: false, statusCode: response.statusCode });
    });
  });
  assert.equal(rejected.connected, false);

  const allowed = await tracker.open(port, { origin: 'https://bertmarti.github.io' });
  allowed.send({ type: 'create', roomCode: 'ORIG2345', generation: 'all', board: makeBoard() });
  const state = await allowed.nextMessage();
  assert.equal(state.type, 'state');
  assert.equal(state.state.phase, 'waiting-for-player');
});

test('cierra con 1008 la tercera conexión con maxConnectionsPerIp: 2', async (t) => {
  const { port, tracker } = await startServer(t, { maxConnectionsPerIp: 2 });
  await tracker.open(port);
  await tracker.open(port);
  const third = tracker.connectRaw(port);
  const closed = await third.nextClose();
  assert.equal(closed.code, 1008);
});

test('permite crear una sola sala por IP con maxRoomsPerIpPerWindow: 1', async (t) => {
  const { port, tracker } = await startServer(t, { maxRoomsPerIpPerWindow: 1 });
  const first = await tracker.open(port);
  first.send({ type: 'create', roomCode: 'PRIM2345', generation: 'all', board: makeBoard() });
  const created = await first.nextMessage();
  assert.equal(created.type, 'state');

  const second = await tracker.open(port);
  second.send({ type: 'create', roomCode: 'SEGU2345', generation: 'all', board: makeBoard() });
  const error = await second.nextMessage();
  assert.equal(error.type, 'error');
  assert.equal(error.message, 'Has creado demasiadas salas seguidas. Espera unos minutos.');
});

test('HTTP: crear sala, consultar estado con token y devolver 401 sin él', async (t) => {
  const { port } = await startServer(t);
  const roomCode = 'HTTP2345';
  const body = JSON.stringify({ roomCode, generation: 'all', board: makeBoard() });
  const created = await httpRequest(port, {
    method: 'POST',
    path: '/api/rooms',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  assert.equal(created.statusCode, 200);
  const payload = JSON.parse(created.body);
  assert.equal(payload.type, 'state');
  assert.equal(typeof payload.sessionToken, 'string');
  assert.equal(payload.state.phase, 'waiting-for-player');
  assert.equal(payload.state.roomCode, roomCode);

  const withToken = await httpRequest(port, {
    method: 'GET',
    path: `/api/rooms/${roomCode}/state`,
    headers: { 'x-player': 'p1', 'x-session-token': payload.sessionToken },
  });
  assert.equal(withToken.statusCode, 200);
  assert.equal(JSON.parse(withToken.body).state.roomCode, roomCode);

  const withoutToken = await httpRequest(port, {
    method: 'GET',
    path: `/api/rooms/${roomCode}/state`,
    headers: { 'x-player': 'p1' },
  });
  assert.equal(withoutToken.statusCode, 401);
});

test('HTTP: responde 413 con cuerpos de más de 64 KiB', async (t) => {
  const { port } = await startServer(t);
  const hugeBody = JSON.stringify({ pad: 'a'.repeat(70 * 1024) });
  const response = await httpRequest(port, {
    method: 'POST',
    path: '/api/rooms',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(hugeBody) },
    body: hugeBody,
  });
  assert.equal(response.statusCode, 413);
});

test('HTTP: responde 429 con Retry-After al superar httpRateLimit', async (t) => {
  const { port } = await startServer(t, { httpRateLimit: 3 });
  const headers = { 'Content-Type': 'application/json' };
  for (let index = 0; index < 3; index += 1) {
    const response = await httpRequest(port, { method: 'POST', path: '/api/rooms', headers, body: '{}' });
    assert.equal(response.statusCode, 200);
  }
  const limited = await httpRequest(port, { method: 'POST', path: '/api/rooms', headers, body: '{}' });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['retry-after'], '60');
});

test('HTTP: trustProxy usa x-forwarded-for y da prioridad a cf-connecting-ip', async (t) => {
  const { port } = await startServer(t, { trustProxy: true, httpRateLimit: 1 });
  const post = (headers, roomCode) =>
    httpRequest(port, {
      method: 'POST',
      path: '/api/rooms',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ roomCode, generation: 'all', board: makeBoard() }),
    });
  // Sin cf-connecting-ip se usa la primera IP de x-forwarded-for.
  assert.equal((await post({ 'x-forwarded-for': '203.0.113.10' }, 'PROX2345')).statusCode, 200);
  assert.equal((await post({ 'x-forwarded-for': '203.0.113.11' }, 'PROX2346')).statusCode, 200);
  // Con cf-connecting-ip, cambiar x-forwarded-for no sirve para esquivar el límite.
  assert.equal((await post({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.20' }, 'PROX2347')).statusCode, 200);
  assert.equal((await post({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.21' }, 'PROX2348')).statusCode, 429);
  assert.equal((await post({ 'cf-connecting-ip': '198.51.100.8', 'x-forwarded-for': '203.0.113.21' }, 'PROX2349')).statusCode, 200);
});

test('HTTP: una cabecera Host inválida no tumba el servidor (se atiende y GET / sigue en 200)', async (t) => {
  const { port } = await startServer(t);
  const raw = await new Promise((resolve, reject) => {
    const net = require('node:net');
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write('GET /api/rooms/ABCDEFGH/state HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n');
    });
    let data = '';
    socket.on('data', (chunk) => (data += chunk));
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
  // Antes: TypeError no capturado en new URL() y el proceso moría. Ahora la petición se atiende (401: sin sesión).
  assert.match(raw, /^HTTP\/1\.1 401/);
  const health = await httpRequest(port, { method: 'GET', path: '/' });
  assert.equal(health.statusCode, 200);
});

test('las conexiones cerradas liberan el cupo por IP', async (t) => {
  const { port, tracker } = await startServer(t, { maxConnectionsPerIp: 1 });
  const first = await tracker.open(port);
  first.terminate();
  await first.nextClose();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const second = await tracker.open(port);
  second.send({ type: 'join', roomCode: 'ZZZZZZZZ' });
  const reply = await second.nextMessage();
  assert.equal(reply.type, 'error');
});

test('un marco WebSocket mayor que maxPayload cierra esa conexión con 1009 pero no tumba el servidor', async (t) => {
  const { port, tracker } = await startServer(t);
  const client = await tracker.open(port);
  client.sendRaw('x'.repeat(70 * 1024));
  const closed = await client.nextClose();
  assert.equal(closed.code, 1009);
  const health = await httpRequest(port, { method: 'GET', path: '/' });
  assert.equal(health.statusCode, 200);
  const other = await tracker.open(port);
  other.send({ type: 'join', roomCode: 'ZZZZZZZZ' });
  assert.equal((await other.nextMessage()).type, 'error');
});

test('health check: CORS abierto y originAllowed indica si se admite el origen', async (t) => {
  const { port } = await startServer(t, { allowedOrigins: ['https://bertmarti.github.io'] });
  const allowed = await httpRequest(port, { headers: { Origin: 'https://bertmarti.github.io' } });
  assert.equal(allowed.headers['access-control-allow-origin'], '*');
  assert.equal(JSON.parse(allowed.body).originAllowed, true);
  const rejected = await httpRequest(port, { headers: { Origin: 'https://otra-web.example' } });
  assert.equal(rejected.headers['access-control-allow-origin'], '*');
  assert.equal(JSON.parse(rejected.body).originAllowed, false);
  const noOrigin = await httpRequest(port);
  assert.equal(JSON.parse(noOrigin.body).originAllowed, null);
  // El resto de la API sigue sin CORS para orígenes no permitidos.
  const api = await httpRequest(port, { method: 'OPTIONS', path: '/api/rooms', headers: { Origin: 'https://otra-web.example' } });
  assert.equal(api.headers['access-control-allow-origin'], undefined);
});

test('rechaza tableros con imágenes fuera de SpriteCollab/PokéAPI (evita rastrear al rival)', async (t) => {
  const { port, tracker } = await startServer(t);
  const client = await tracker.open(port);
  const board = makeBoard();
  board[3] = { ...board[3], portraitUrl: 'https://rastreo.example/pixel.png' };
  client.send({ type: 'create', roomCode: 'TRAK2345', generation: 'all', board });
  const reply = await client.nextMessage();
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /25 Pokémon válidos/);
  client.send({ type: 'create', roomCode: 'TRAK2346', generation: 'all', board: makeBoard() });
  assert.equal((await client.nextMessage()).type, 'state');
});

test('mensajes de sala claros: código inexistente y sala llena', async (t) => {
  const { port, tracker } = await startServer(t);
  const host = await tracker.open(port);
  host.send({ type: 'create', roomCode: 'LLEN2345', generation: 'all', board: makeBoard() });
  await host.nextMessage();
  const guest = await tracker.open(port);
  guest.send({ type: 'join', roomCode: 'LLEN2345' });
  await guest.nextMessage();
  await host.nextMessage();
  const third = await tracker.open(port);
  third.send({ type: 'join', roomCode: 'LLEN2345' });
  assert.match((await third.nextMessage()).message, /La sala está llena/);
  const lost = await tracker.open(port);
  lost.send({ type: 'join', roomCode: 'NADA2345' });
  assert.match((await lost.nextMessage()).message, /No hay ninguna sala con ese código/);
});
