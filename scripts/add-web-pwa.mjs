// Convierte la build web de Pages en una PWA instalable que funciona sin red en el Solitario.
// - manifest.webmanifest + iconos (public/pwa/), con scope y start_url dentro de la ruta base.
// - sw.js generado con la lista de archivos de la build (precaché) y caché de retratos remotos.
// - registrar-sw.js (archivo aparte: la CSP no permite scripts en línea).
// Todas las webs de BertMarti comparten el origen https://bertmarti.github.io: el service worker queda limitado a
// la carpeta del proyecto y solo crea, usa y borra cachés con el prefijo «pokequien-».
// Uso: node scripts/add-web-pwa.mjs [carpeta-dist]   (ruta base: PAGES_BASE_URL, por defecto /Adivina-pkm)
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const distDir = process.argv[2] ?? 'dist';
const basePath = `${(process.env.PAGES_BASE_URL ?? '/Adivina-pkm').replace(/\/+$/, '')}/`;
if (!/^\/[A-Za-z0-9._-]+\/$/.test(basePath)) throw new Error(`Ruta base no válida para la PWA: ${basePath}`);
const indexPath = join(distDir, 'index.html');
if (!existsSync(indexPath)) throw new Error(`No encuentro ${indexPath}: ejecuta antes expo export`);

// Iconos: `expo export` (sin expo-router) no copia public/pwa a dist/, así que se copian aquí.
if (!existsSync(join(distDir, 'pwa', 'icon-512.png'))) cpSync('public/pwa', join(distDir, 'pwa'), { recursive: true });

const manifest = {
  name: 'PokéQuién · Duelo Pixel',
  short_name: 'PokéQuién',
  description: 'Adivina el Pokémon secreto antes que tu rival. Fan project no oficial.',
  lang: 'es-ES',
  id: basePath,
  start_url: basePath,
  scope: basePath,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#05070B',
  theme_color: '#10162C',
  icons: [
    { src: `${basePath}pwa/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${basePath}pwa/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};
writeFileSync(join(distDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

// Precaché: todo lo que sirve la build salvo lo que no hace falta sin red.
const SKIP = new Set(['404.html', 'metadata.json', '.nojekyll', 'sw.js', 'registrar-sw.js']);
const listFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? listFiles(path) : [path];
});
const files = listFiles(distDir)
  .map((path) => relative(distDir, path).split(sep).join('/'))
  .filter((path) => !SKIP.has(path))
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(readFileSync(join(distDir, file)));
const version = hash.digest('hex').slice(0, 12);
const precache = [basePath, ...files.filter((file) => file !== 'index.html').map((file) => `${basePath}${encodeURI(file)}`)];

// Retratos que usa la app (src/data/pokemon.ts). Solo esas rutas de raw.githubusercontent.com se guardan.
const PORTRAIT_PREFIXES = [
  'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/',
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/',
];

const sw = `// Generado por scripts/add-web-pwa.mjs. No editar a mano.
'use strict';
const BASE = ${JSON.stringify(basePath)};
const APP_CACHE = 'pokequien-app-${version}';
const PORTRAIT_CACHE = 'pokequien-retratos-v1';
const MAX_PORTRAITS = 400;
const PRECACHE = ${JSON.stringify(precache)};
const PORTRAIT_PREFIXES = ${JSON.stringify(PORTRAIT_PREFIXES)};

self.addEventListener('install', (event) => {
  // cache: 'reload' salta la caché HTTP de Pages (max-age=600): si no, la versión nueva guardaría el index viejo.
  event.waitUntil(caches.open(APP_CACHE)
    .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Solo se borran cachés propias (prefijo pokequien-): el origen es compartido con otras webs.
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('pokequien-app-') && key !== APP_CACHE)
      .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

async function trimPortraits(cache) {
  const keys = await cache.keys();
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_PORTRAITS))) await cache.delete(request);
}

async function portrait(request) {
  const cache = await caches.open(PORTRAIT_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  // Petición CORS (raw.githubusercontent.com la permite): así no se guardan respuestas opacas que inflan la cuota.
  const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  if (response.ok && response.type === 'cors') {
    await cache.put(request.url, response.clone());
    void trimPortraits(cache);
  }
  return response;
}

async function navigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    // Solo la entrada de la app (BASE o BASE + index.html) y solo si es HTML: navegar a /pwa/icon-512.png no debe
    // sustituir la app guardada por un PNG.
    const { pathname } = new URL(request.url);
    const isAppEntry = pathname === BASE || pathname === BASE + 'index.html';
    if (response.ok && isAppEntry && (response.headers.get('content-type') || '').includes('text/html')) {
      const cache = await caches.open(APP_CACHE);
      await cache.put(BASE, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(BASE, { cacheName: APP_CACHE });
    if (cached) return cached;
    throw error;
  }
}

async function appFile(request) {
  const cached = await caches.match(request, { cacheName: APP_CACHE });
  return cached ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Peticiones con Range (audio en Safari): exigen 206 y la caché guarda 200; se dejan pasar a la red.
  if (request.headers.has('range')) return;
  const url = new URL(request.url);
  if (PORTRAIT_PREFIXES.some((prefix) => request.url.startsWith(prefix))) {
    event.respondWith(portrait(request).catch(() => fetch(request)));
    return;
  }
  // Fuera de la carpeta del proyecto (otras webs del mismo origen, servidor de salas…) no se intercepta nada.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }
  event.respondWith(appFile(request));
});
`;
writeFileSync(join(distDir, 'sw.js'), sw);

writeFileSync(join(distDir, 'registrar-sw.js'), `// Registra el service worker de PokéQuién (generado por scripts/add-web-pwa.mjs).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(${JSON.stringify(`${basePath}sw.js`)}, { scope: ${JSON.stringify(basePath)} }).catch(function () {});
  });
}
`);

const html = readFileSync(indexPath, 'utf8');
if (html.includes('rel="manifest"')) {
  console.log('La PWA ya estaba en', indexPath);
} else {
  const tags = [
    `<link rel="manifest" href="${basePath}manifest.webmanifest" />`,
    `<link rel="apple-touch-icon" href="${basePath}pwa/apple-touch-icon.png" />`,
    `<script src="${basePath}registrar-sw.js" defer></script>`,
  ].join('\n    ');
  if (!html.includes('</head>')) throw new Error(`No encuentro </head> en ${indexPath}`);
  writeFileSync(indexPath, html.replace('</head>', `    ${tags}\n  </head>`));
  console.log(`PWA añadida a ${indexPath}: ${precache.length} archivos en precaché (versión ${version})`);
}
