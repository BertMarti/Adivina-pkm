// Añade la Content-Security-Policy al index.html exportado para GitHub Pages.
// No va en public/index.html porque en `expo start --web` bloquearía Metro y las IP de la LAN.
// Uso: node scripts/add-web-csp.mjs [carpeta-dist]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = process.argv[2] ?? 'dist';
const indexPath = join(distDir, 'index.html');
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://raw.githubusercontent.com",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const html = readFileSync(indexPath, 'utf8');
if (html.includes('Content-Security-Policy')) {
  console.log('La CSP ya estaba en', indexPath);
} else {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  if (!html.includes('<meta charset="utf-8" />')) throw new Error(`No encuentro <meta charset> en ${indexPath}`);
  writeFileSync(indexPath, html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    ${meta}`));
  console.log('CSP añadida a', indexPath);
}
