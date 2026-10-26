import { createServer, request as httpRequest } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { existsSync, readFileSync, rmSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Prueba de humo de la web (build de Pages): carga, entra en el Solitario, responde «SÍ», comprueba que el Duelo
// se puede cancelar y explica que el servidor no responde (sin colgarse) y, si la build trae service worker,
// comprueba que vuelve a cargar y deja jugar sin red. Sin dependencias: Chromium + CDP.
// Uso: npm run build:web && npm run test:web   (SMOKE_DIST=carpeta, CHROME_PATH=ejecutable, SMOKE_SCREENSHOT=png)
const root = resolve(process.env.SMOKE_DIST ?? fileURLToPath(new URL('../dist/', import.meta.url)));
const prefix = '/Adivina-pkm/';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const textOf = (value) => String(value ?? '');
const normalise = (value) => textOf(value).toLocaleUpperCase('es-ES');
let server;
let roomServerStub;
let browser;
let profile;
let socket;
const consoleErrors = [];

function sendFile(request, response) {
  if (!request.url) return response.writeHead(404).end();
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { return response.writeHead(404).end(); }
  if (!pathname.startsWith(prefix)) return response.writeHead(404).end();
  const relative = pathname.slice(prefix.length);
  const candidate = resolve(root, relative || 'index.html');
  if (!(candidate === root || candidate.startsWith(root + sep))) return response.writeHead(404).end();
  let file = candidate;
  try {
    if (!statSync(file).isFile()) throw new Error('no es un archivo');
  } catch {
    file = join(root, 'index.html');
  }
  try {
    response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(readFileSync(file));
  } catch { response.writeHead(404).end(); }
}

function findChrome() {
  const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : ['chromium', 'chromium-browser', 'google-chrome'];
  for (const candidate of candidates) {
    if (candidate.includes(sep) && existsSync(candidate)) return candidate;
    for (const directory of (process.env.PATH ?? '').split(':')) {
      const full = join(directory, candidate);
      if (existsSync(full)) return full;
    }
  }
  throw new Error('No se ha encontrado Chromium');
}

// Servidor de salas falso: el dominio de Render se redirige aquí (--host-resolver-rules) para no depender de la red.
// En modo «colgado» acepta la conexión y no contesta nunca (servidor dormido); en modo «caído» la corta al momento.
const ROOM_SERVER_HOST = 'pokequien-rooms.onrender.com';
let roomServerMode = 'hang';
const roomServerSockets = new Set();
function startRoomServerStub() {
  roomServerStub = createTcpServer((connection) => {
    if (roomServerMode === 'down') return connection.destroy();
    roomServerSockets.add(connection);
    connection.on('error', () => {});
    connection.on('close', () => roomServerSockets.delete(connection));
  });
  return new Promise((resolvePromise) => roomServerStub.listen(0, '127.0.0.1', () => resolvePromise(roomServerStub.address().port)));
}
function setRoomServerDown() {
  roomServerMode = 'down';
  for (const connection of roomServerSockets) connection.destroy();
}

function launchChrome(executable, roomServerPort) {
  profile = mkdtempSync(join(tmpdir(), 'adivina-pkm-smoke-'));
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=390,844', `--host-resolver-rules=MAP ${ROOM_SERVER_HOST} 127.0.0.1:${roomServerPort}`, 'about:blank'];
  return new Promise((resolvePromise, reject) => {
    // En Linux, con prioridad mínima de CPU y disco (la Raspberry de desarrollo tiene poca memoria).
    const lowPriority = process.platform === 'linux' && existsSync('/usr/bin/ionice');
    const [command, commandArgs] = lowPriority ? ['nice', ['-n', '19', 'ionice', '-c3', executable, ...args]] : [executable, args];
    browser = spawn(command, commandArgs, { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error('Chromium no ha anunciado DevTools')), 15000);
    browser.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolvePromise(match[1]); }
    });
    browser.once('error', reject);
    browser.once('exit', (code) => { if (!browser?.killed && code !== null) reject(new Error(`Chromium terminó con código ${code}`)); });
  });
}

function httpJson(port, path) {
  return new Promise((resolvePromise, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => { try { resolvePromise(JSON.parse(body)); } catch (error) { reject(error); } });
    });
    request.on('error', reject).end();
  });
}

class Cdp {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); this.events = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolvePromise, reject) => { this.ws.addEventListener('open', resolvePromise); this.ws.addEventListener('error', reject); });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result); }
      for (const listener of this.events.get(message.method) ?? []) listener(message.params);
    });
  }
  command(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => { this.pending.set(id, { resolve: resolvePromise, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(method, listener) { this.events.set(method, [...(this.events.get(method) ?? []), listener]); }
  close() { this.ws?.close(); }
}

async function evaluate(cdp, expression) {
  const result = await cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Evaluación fallida');
  return result.result?.value;
}

async function waitFor(cdp, condition, description) {
  const end = Date.now() + 30000;
  while (Date.now() < end) { if (await evaluate(cdp, condition)) return; await sleep(250); }
  throw new Error(`tiempo agotado: ${description}`);
}

async function clickText(cdp, text) {
  const value = JSON.stringify(normalise(text));
  if (!await evaluate(cdp, `(() => { const wanted = ${value}; const el = [...document.querySelectorAll('[role="button"]')].find((node) => (node.innerText || '').toLocaleUpperCase('es-ES').includes(wanted)); if (!el) return false; el.click(); return true; })()`)) throw new Error(`no se encuentra el botón «${text}»`);
}

function innerText(cdp) { return evaluate(cdp, 'document.body?.innerText || ""'); }

async function stopBrowser() {
  if (socket) socket.close();
  if (roomServerStub) { setRoomServerDown(); roomServerStub.close(); roomServerStub = undefined; }
  if (browser?.pid) { try { process.kill(-browser.pid, 'SIGTERM'); } catch {} await new Promise((resolvePromise) => { browser.once('exit', resolvePromise); setTimeout(resolvePromise, 3000); }); }
  if (profile) rmSync(profile, { recursive: true, force: true });
}

async function main() {
  currentStep = 'a';
  server = createServer(sendFile);
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const port = server.address().port;
  const devtools = await launchChrome(findChrome(), await startRoomServerStub());
  const targetList = await httpJson(new URL(devtools).port, '/json/list');
  const target = targetList.find((item) => item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('No se ha encontrado la página de Chromium');
  socket = new Cdp(target.webSocketDebuggerUrl);
  await socket.connect();
  socket.on('Runtime.exceptionThrown', ({ exceptionDetails }) => consoleErrors.push(exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'Excepción JavaScript'));
  socket.on('Runtime.consoleAPICalled', ({ type, args }) => { if (type === 'error') consoleErrors.push(args?.map((arg) => arg.value ?? arg.description ?? '').join(' ')); });
  await socket.command('Runtime.enable');
  await socket.command('Page.enable');
  await socket.command('Page.navigate', { url: `http://127.0.0.1:${port}${prefix}` });
  await waitFor(socket, `document.body && document.body.innerText.length > 0`, 'carga de la página');
  const guide = await evaluate(socket, `!![...document.querySelectorAll('[role="button"]')].find((node) => (node.innerText || '').toLocaleUpperCase('es-ES').includes('ENTENDIDO'))`);
  if (guide) await clickText(socket, 'ENTENDIDO');
  await waitFor(socket, `((document.body.innerText || '').toLocaleUpperCase('es-ES').includes('JUGAR CONTRA LA MÁQUINA') || (document.body.innerText || '').toLocaleUpperCase('es-ES').includes('MODO 1 JUGADOR'))`, 'pantalla inicial');
  console.log('✔ paso a: carga de la página');
  currentStep = 'b';
  await clickText(socket, 'JUGAR CONTRA LA MÁQUINA');
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('MODO 1 JUGADOR')`, 'entrada en Solitario');
  console.log('✔ paso b: entrada en Solitario');
  currentStep = 'c';
  await waitFor(socket, `document.querySelectorAll('[role="button"]').length > 0 && (document.body.innerText || '').toLocaleUpperCase('es-ES').includes('ELIGE UN POKÉMON')`, 'selección de Pokémon');
  if (!await evaluate(socket, `(() => { const el = [...document.querySelectorAll('[role="button"]')].find((node) => (node.innerText || '').trim() && !(node.innerText || '').toLocaleUpperCase('es-ES').includes('VOLVER') && !(node.innerText || '').toLocaleUpperCase('es-ES').includes('POKÉDEX')); if (!el) return false; el.click(); return true; })()`)) throw new Error('no se encuentra un Pokémon para empezar');
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('PREGUNTA 1')`, 'inicio de partida');
  console.log('✔ paso c: inicio de partida');
  currentStep = 'd';
  const before = await innerText(socket);
  await clickText(socket, 'SÍ');
  await waitFor(socket, `((document.body.innerText || '') !== ${JSON.stringify(before)})`, 'respuesta a la pregunta');
  console.log('✔ paso d: respuesta SÍ');
  currentStep = 'e';
  if (process.env.SMOKE_SCREENSHOT) { const shot = await socket.command('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.env.SMOKE_SCREENSHOT, Buffer.from(shot.data, 'base64')); }
  if (consoleErrors.some((error) => !normalise(error).includes('NOTALLOWEDERROR'))) throw new Error('errores de consola');
  console.log('✔ paso e: captura y consola');
  currentStep = 'f';
  // Duelo con el servidor dormido: el enlace de invitación intenta entrar, avisa y se puede CANCELAR sin esperar.
  await socket.command('Page.navigate', { url: `http://127.0.0.1:${port}${prefix}?room=K7XQ2MPA` });
  await waitFor(socket, `document.body && document.body.innerText.length > 0`, 'recarga con enlace de invitación');
  if (await evaluate(socket, `!![...document.querySelectorAll('[role="button"]')].find((node) => (node.innerText || '').toLocaleUpperCase('es-ES').includes('ENTENDIDO'))`)) await clickText(socket, 'ENTENDIDO');
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('DESPERTANDO EL SERVIDOR')`, 'aviso de servidor dormido');
  await clickText(socket, 'CANCELAR');
  await waitFor(socket, `(() => { const text = (document.body.innerText || '').toLocaleUpperCase('es-ES'); return !text.includes('CANCELAR') && !text.includes('ENTRANDO EN') && !text.includes('NO HEMOS PODIDO'); })()`, 'cancelación del intento de conexión');
  console.log('✔ paso f: el Duelo avisa de que el servidor despierta y se puede cancelar');
  currentStep = 'g';
  // Servidor caído: el error lo explica junto al panel, ofrece REINTENTAR y el Solitario funciona.
  setRoomServerDown();
  await clickText(socket, 'CONECTAR');
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('NO HEMOS PODIDO CONTACTAR CON EL SERVIDOR DE DUELOS')`, 'mensaje de servidor inaccesible');
  if (!await evaluate(socket, `['REINTENTAR', 'JUGAR AL SOLITARIO'].every((wanted) => [...document.querySelectorAll('[role="button"]')].some((node) => (node.innerText || '').toLocaleUpperCase('es-ES').includes(wanted)))`)) throw new Error('faltan REINTENTAR o JUGAR AL SOLITARIO');
  await clickText(socket, 'JUGAR AL SOLITARIO');
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('MODO 1 JUGADOR')`, 'Solitario tras el fallo del Duelo');
  if (consoleErrors.some((error) => !normalise(error).includes('NOTALLOWEDERROR'))) throw new Error('errores de consola');
  console.log('✔ paso g: servidor caído explicado, sin colgarse, y Solitario disponible');
  if (!existsSync(join(root, 'sw.js'))) return;
  currentStep = 'h';
  // PWA: espera a que el service worker controle la página, apaga el servidor (sin red) y recarga.
  await waitFor(socket, `Promise.race([navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller), new Promise((ok) => setTimeout(() => ok(false), 1000))])`, 'service worker activo');
  // Navegar a un recurso que no es la app (un PNG) no debe sustituir la copia guardada de la app.
  await socket.command('Page.navigate', { url: `http://127.0.0.1:${port}${prefix}pwa/icon-512.png` });
  await waitFor(socket, `document.contentType === 'image/png'`, 'navegación a un PNG');
  server.closeAllConnections();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  await socket.command('Page.navigate', { url: `http://127.0.0.1:${port}${prefix}` });
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('JUGAR CONTRA LA MÁQUINA')`, 'carga sin red');
  await clickText(socket, 'JUGAR CONTRA LA MÁQUINA');
  await waitFor(socket, `(document.body.innerText || '').toLocaleUpperCase('es-ES').includes('MODO 1 JUGADOR')`, 'Solitario sin red');
  console.log('✔ paso h: sin red, la PWA carga y abre el Solitario');
}

const globalTimeout = setTimeout(() => { void stopBrowser().finally(() => process.exit(1)); }, 120000);
let currentStep = 'preparación';
try { await main(); clearTimeout(globalTimeout); await stopBrowser(); server?.close(); process.exitCode = 0; console.log('Prueba de humo superada.'); }
catch (error) { clearTimeout(globalTimeout); let body = ''; try { if (socket) body = await innerText(socket); } catch {} console.error(`FALLO en el paso ${currentStep}: ${error.message}`); console.error(body.slice(-500)); if (consoleErrors.length) console.error(consoleErrors.join('\n')); await stopBrowser(); server?.close(); process.exitCode = 1; }
