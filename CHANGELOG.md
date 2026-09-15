# 📜 Changelog — PokéQuién

Todos los cambios notables del proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [Sin publicar]

> Cambios pendientes de incluir en la próxima versión.

- 🧠 El modo solitario usa una creencia tolerante a respuestas imperfectas,
  semilla por ronda y propuestas de confianza; se elimina la secuencia fija.
- 🚫 El banco de preguntas excluye Pokédex, peso, región y generación como
  atajos de identificación.
- 💾 Cada partida humana se guarda localmente con preguntas, respuestas,
  candidatos supervivientes y resultado; las escrituras rápidas se serializan.

---

## [1.0.0] — 2026-09-15

### ⚡ Lanzamiento inicial

Primera versión funcional de PokéQuién con ambos modos de juego.

### ✨ Añadido

- 🕹️ **Modo Duelo (2 jugadores)** — Partidas en tiempo real con tablero compartido 5×5
- 🤖 **Modo Solitario** — Juega contra la máquina que hace preguntas SÍ/NO inteligentes
- 🗺️ **9 generaciones + modo Todas** — Desde Kanto (#001–#151) hasta Paldea (#906–#1025), más el catálogo completo de 1.025 Pokémon
- 🏠 **Pantalla de inicio** — Selector de generación, creación de sala, enlace de invitación, código compartible y acceso directo al modo solitario
- 🔗 **Sistema de salas** — Códigos de 8 caracteres, enlace de invitación (web y deep link nativo), unirse por código
- 📋 **Copiar enlace y código** — Compartir sala por enlace o código directamente desde la app
- 🎨 **Estética pixel-art retro** — Fondo SpriteCollab con scanlines CRT, tipografía Press Start 2P, colores arcade
- 🖼️ **Retratos PMD** — Sprites Happy/Normal/Sad de SpriteCollab con cadena de fallback a PokéAPI
- 😊→😢 **Expresiones dinámicas** — Los retratos cambian de expresión al tachar (Happy → Sad)
- 🔊 **Audio contextual** — Sonidos de selección, tachado, destachado, victoria y derrota
- 📳 **Feedback háptico** — Vibraciones diferenciadas por tipo de acción en dispositivos móviles
- ♿ **Accesibilidad** — Roles, estados, etiquetas de accesibilidad, soporte para lectores de pantalla y `prefers-reduced-motion`
- 🔌 **Reconexión** — Ventana de 60 segundos para reconectar si un jugador se desconecta, con recuperación completa del estado
- 🔁 **Rematch** — Botón JUGAR DE NUEVO para repetir en la misma sala sin reconectar
- 🧠 **Motor de preguntas inteligente** — Selección por ganancia de información con exploración de preguntas y semilla por ronda
- 📊 **Historial de partidas solitario** — Guardado automático, exportación JSON y borrado del registro
- 🏗️ **Pokédex Nacional local** — 1.025 entradas con tipos, peso, color, silueta, descripción y curiosidades, sin depender de API en tiempo de juego
- 📱 **Responsive** — Diseño adaptable a móvil, tablet y web con ancho máximo de 720 px

### 🔐 Seguridad

- Validación de tablero en el servidor (25 Pokémon, ids únicos, generación válida)
- Secretos filtrados en la proyección de estado (cada jugador solo ve el suyo)
- Token de sesión para reconexión con comparación constante
- Límites de payload (64 KiB), rate de mensajes y número máximo de salas

---

<!--
## [X.Y.Z] — YYYY-MM-DD

### ✨ Añadido
- Nuevas funcionalidades

### 🔄 Cambiado
- Cambios en funcionalidades existentes

### ⚠️ Obsoleto
- Funcionalidades que serán eliminadas próximamente

### 🗑️ Eliminado
- Funcionalidades eliminadas

### 🐛 Corregido
- Correcciones de errores

### 🔐 Seguridad
- Correcciones de vulnerabilidades
-->
