---
name: publicar-pages
description: Publicar o depurar la versión web de PokéQuién en GitHub Pages (https://bertmarti.github.io/Adivina-pkm/). Úsalo cuando haya que cambiar la build web, la ruta base, la CSP o el workflow de Pages.
---

# Publicar PokéQuién en GitHub Pages

La web es la build de Expo (react-native-web) exportada como sitio estático.

## Cómo funciona
- `npm run build:web` → `scripts/build-web.mjs` pone `PAGES_BASE_URL=/Adivina-pkm` (si no viene dada),
  ejecuta `npx expo export --platform web --output-dir dist` y luego `scripts/add-web-csp.mjs dist`.
- `app.config.js` solo añade `experiments.baseUrl` cuando existe `PAGES_BASE_URL`; sin ella, móvil y
  `npm run web` no cambian. Ojo con las mayúsculas: el repo es `Adivina-pkm`.
- La plantilla HTML es `public/index.html` (idioma, metadatos, foco visible). La CSP NO va ahí porque rompería
  Metro y las IP de la LAN en desarrollo; se inyecta solo en `dist/index.html`.
- `.github/workflows/pages.yml` se lanza en cada push a `master` y a mano (`workflow_dispatch`); copia
  `index.html` a `404.html` y sube `dist/` con `actions/upload-pages-artifact` + `actions/deploy-pages`.
- Pages debe estar en modo «GitHub Actions»: `gh api -X POST repos/BertMarti/Adivina-pkm/pages -f build_type=workflow`
  (o `-X PUT` si ya existe).

## Probar en local antes de subir
```bash
npm run build:web
mkdir -p /tmp/pk-serve && ln -sfn "$PWD/dist" /tmp/pk-serve/Adivina-pkm
(cd /tmp/pk-serve && python3 -m http.server 8931 --bind 127.0.0.1)
# abre http://127.0.0.1:8931/Adivina-pkm/
```
Comprueba: carga sin errores de CSP, «Jugar contra la máquina» funciona sin servidor y el enlace de invitación
lleva `/Adivina-pkm/?room=...`.

## Duelo desde la web
El navegador conecta a `wss://pokequien-rooms.onrender.com`. El servidor solo acepta orígenes de
`ROOM_SERVER_ALLOWED_ORIGINS` (en `render.yaml`: `https://bertmarti.github.io`) y localhost. Si se cambia el dominio
de la web, hay que cambiar también esa variable en Render.
