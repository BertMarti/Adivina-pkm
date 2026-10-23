<p align="center">
  <a href="https://bertmarti.github.io/Adivina-pkm/"><img src="docs/img/banner.svg" alt="PokéQuién — duelo de deducción pixel-art: adivina el Pokémon secreto de tu rival" width="100%" /></a>
</p>

<p align="center">
  <a href="https://bertmarti.github.io/Adivina-pkm/"><img src="https://img.shields.io/badge/▶_Jugar_en_la_web-gratis-FFD000?style=for-the-badge&labelColor=1D1E2A" alt="Jugar en la web" /></a>
  <img src="https://img.shields.io/badge/🎮_Pokémon-1025_especies-E3350D?style=for-the-badge&labelColor=1D1E2A" alt="1025 especies" />
  <img src="https://img.shields.io/badge/🕹️_Modos-Duelo_·_Solitario-FFD000?style=for-the-badge&labelColor=1D1E2A" alt="Modos Duelo y Solitario" />
  <img src="https://img.shields.io/badge/📱_Plataforma-Web_·_Android_·_iOS-4C6BE8?style=for-the-badge&labelColor=1D1E2A" alt="Web, Android e iOS" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licencia-MIT-38D37D?style=for-the-badge&labelColor=1D1E2A" alt="Licencia MIT" /></a>
</p>

<p align="center"><b>Un duelo de deducción pixel-art inspirado en «¿Quién es Quién?»<br>pero con Pokémon. Descubre el secreto de tu rival… ¡antes de que él descubra el tuyo!</b></p>

<h2 align="center">
  🎮 <a href="https://bertmarti.github.io/Adivina-pkm/">Jugar ahora en el navegador →</a>
</h2>

<p align="center"><sub>Sin instalar nada y sin cuenta. Funciona en el ordenador y en el móvil.</sub></p>

---

## 📸 Capturas de pantalla

<p align="center">
  <img src="docs/img/captura-inicio.png" width="640" alt="Pantalla de inicio en el ordenador: crear partida con selector de generación, código de sala y botones Copiar enlace y Crear sala sobre un mapa pixel-art" />
</p>
<p align="center"><sub>🏠 Inicio: crea una sala, elige generación o únete con el código de tu rival.</sub></p>

<p align="center">
  <img src="docs/img/captura-solitario.png" width="640" alt="Modo solitario: la máquina pregunta si el Pokémon tiene una silueta parecida a la humana, con botones Sí y No y el Pokémon secreto elegido arriba" />
</p>
<p align="center"><sub>🤖 Solitario: piensa en un Pokémon y responde Sí o No; la máquina intenta adivinarlo.</sub></p>

<p align="center">
  <img src="docs/img/captura-movil.png" width="280" alt="Pantalla de inicio en un móvil, con los paneles Crear partida y Unirse a partida" />
</p>
<p align="center"><sub>📱 Pensado primero para el móvil.</sub></p>

---

## 📖 Tabla de contenido

- [📸 Capturas de pantalla](#-capturas-de-pantalla)
- [🌍 ¿Qué es PokéQuién?](#-qué-es-pokéquién)
- [🚀 Cómo empezar](#-cómo-empezar)
- [🕹️ Modo Duelo (2 jugadores)](#️-modo-duelo-2-jugadores)
- [🤖 Modo Solitario (1 jugador)](#-modo-solitario-1-jugador)
- [🗺️ Generaciones disponibles](#️-generaciones-disponibles)
- [🎨 Interfaz y estética](#-interfaz-y-estética)
- [🔊 Sonidos y sensaciones](#-sonidos-y-sensaciones)
- [📱 Compatibilidad](#-compatibilidad)
- [❓ Preguntas frecuentes](#-preguntas-frecuentes)
- [🌟 Créditos](#-créditos)

---

## 🌍 ¿Qué es PokéQuién?

<img align="right" src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0001/Happy.png" width="64" alt="Bulbasaur" />

**PokéQuién** es un juego de deducción donde cada jugador elige un Pokémon en secreto y, mediante preguntas y descartes, intenta averiguar cuál escogió el rival.

La partida se juega sobre un tablero de **25 Pokémon** distribuidos en una cuadrícula **5×5**, con retratos pixel-art al estilo **Pokémon Mystery Dungeon**, fondo con scanlines CRT y tipografía arcade.

> 🎯 **Objetivo:** Deja un solo Pokémon en tu tablero y que sea el secreto de tu rival. ¡Gana el más rápido!

---

## 🚀 Cómo empezar

| | En el navegador | En el móvil Android |
|:--|:--|:--|
| 1️⃣ | Abre **[bertmarti.github.io/Adivina-pkm](https://bertmarti.github.io/Adivina-pkm/)** | Instala la APK que te pase quien organiza la partida |
| 2️⃣ | Pulsa **Jugar contra la máquina** para el Solitario… | Abre **PokéQuién** |
| 3️⃣ | …o **Crear sala** y envía el enlace a un amigo | Crea una sala o pega el código de tu rival |

> 💡 El modo **Solitario** no necesita el servidor de salas. El **Duelo** necesita internet porque los dos jugadores se conectan a una sala compartida.

---

## 🕹️ Modo Duelo (2 jugadores)

<img align="right" src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0004/Happy.png" width="56" alt="Charmander" />

El modo principal de PokéQuién. Dos entrenadores se enfrentan en tiempo real.

### 📌 Paso 1 · Crear la sala

```
┌──────────────────────────────────────┐
│  🏠 PANTALLA DE INICIO               │
│                                      │
│  ◉ Elige generación: Kanto / Todas…  │
│                                      │
│  Código: A1B2C3D4                    │
│  [ 📋 COPIAR ENLACE ]               │
│  [ ⚡ CREAR SALA ]                   │
│                                      │
│  ─── o conectar con código ───       │
│  [ CÓDIGO RIVAL ] [ 🔗 CONECTAR ]   │
└──────────────────────────────────────┘
```

1. Selecciona la **generación** con la que quieres jugar
2. Pulsa **CREAR SALA** — se genera un código de 8 caracteres
3. **Comparte el enlace** (o el código) con tu rival
4. Tu rival abre el enlace y entra directamente a la sala

> <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0007/Happy.png" width="28" alt="Squirtle" /> **Tip:** También puedes pegar un código que te hayan enviado y pulsar **CONECTAR**.

---

### 📌 Paso 2 · Elegir tu Pokémon secreto

<img align="right" src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0133/Happy.png" width="56" alt="Eevee" />

Cuando ambos jugadores están dentro, aparece la cuadrícula **5×5** con 25 Pokémon idénticos para los dos.

```
┌────┬────┬────┬────┬────┐
│ 🌱 │ 🔥 │ 💧 │ ⚡ │ 🌙 │
├────┼────┼────┼────┼────┤
│ 🐉 │ 🐾 │ 🦋 │ 🌊 │ 🌿 │
├────┼────┼────┼────┼────┤
│ ⭐ │ 👻 │ 🧊 │ 🪨 │ 🪽 │
├────┼────┼────┼────┼────┤
│ 🐸 │ 🐯 │ 🐢 │ 🦊 │ 🐙 │
├────┼────┼────┼────┼────┤
│ 🐭 │ 🐲 │ 🐝 │ 🌸 │ ❄️ │
└────┴────┴────┴────┴────┘
```

- **Toca una casilla** para elegir tu secreto — ¡la elección es instantánea e irreversible!
- Si tu rival aún no eligió, verás tu Pokémon y una **Poké Ball animada** de espera
- Nadie puede ver el secreto del otro

---

### 📌 Paso 3 · ¡El duelo!

```
        ┌──────────┐          ┌──────────┐
        │  TÚ  ⚔️  │    VS    │  RIVAL 🔮│
        │ [sprite] │          │   [ ? ]  │
        ├──────────┤          ├──────────┤
        │ Tu tablero│         │Su tablero│
        │  25 mons  │         │ 25 mons  │
        └──────────┘          └──────────┘
```

Solo puedes actuar sobre **tu propio tablero**:

| Acción | Descripción |
|:------:|:-----------|
| 👆 **Tachar** | Pulsa un Pokémon → aparece una **X roja** y su retrato cambia a expresión triste 😢 |
| 🔄 **Destachar** | Pulsa otra vez el mismo Pokémon → se recupera con expresión feliz 😊 |
| 👀 **Consultar** | Mira el tablero rival para ver qué ha descartado (¡pero no puedes tocar!) |

> <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0054/Happy.png" width="28" alt="Psyduck" /> El número Dex y el nombre aparecen en cada casilla para ayudarte a identificar a cada Pokémon.

---

### 📌 Paso 4 · ¡Victoria!

```
  24 tachados  ✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕✕
                    +
  1 candidato libre  =  ⭐ ¡¡VICTORIA!! ⭐
```

Cuando quede **un único Pokémon** en tu tablero y ese Pokémon **sea el secreto de tu rival**, ¡ganas!

Al finalizar:
- 🏆 El ganador escucha una **fanfarria de victoria**
- 💀 El perdedor escucha un **tono de derrota**
- 📊 Se muestra tu Pokémon con su retrato, descripción y hasta **3 curiosidades**
- 🔁 Pulsa **JUGAR DE NUEVO** para otra ronda en la misma sala

---

### 🔌 Desconexiones

<img align="right" src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0092/Happy.png" width="48" alt="Gastly" />

Si un jugador se desconecta durante la partida:

- ⏳ La sala **espera 60 segundos** para que vuelva
- ✅ Si reconecta a tiempo → recupera su tablero y continúa
- ❌ Si no vuelve → la partida se marca como **abandono** y se vuelve al menú

---

## 🤖 Modo Solitario (1 jugador)

<img align="right" src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0025/Happy.png" width="56" alt="Pikachu" />

¡Pon a prueba a la máquina! Accede desde el botón **MODO SOLITARIO · JUGAR CONTRA LA MÁQUINA** en la pantalla principal.

### ¿Cómo funciona?

```
  1. TÚ eliges un Pokémon en secreto 🤫
                 │
                 ▼
  2. ❓ La máquina pregunta: "¿Es de tipo Agua?"
              [ SÍ ]    [ NO ]
                 │
                 ▼
  3. ❓ "¿Predomina el color azul?"
              [ SÍ ]    [ NO ]
                 │
                 ▼
  4. ❓ "¿Tiene manos?"  …y así hasta adivinar…
                 │
                 ▼
  5. 🎯 "¡Tu Pokémon es Squirtle!"
           [ ✅ SÍ ]    [ ❌ NO ]
```

### 📜 Reglas del Modo Solitario

| Regla | Detalle |
|:------|:--------|
| 🔐 **Secreto real** | La máquina **NUNCA** ve tu elección. Solo conoce tus respuestas SÍ/NO |
| ❓ **Máximo 30 preguntas** | Si la máquina no adivina en 30 preguntas, **¡tú ganas!** |
| 🧠 **Preguntas inteligentes** | Usa ganancia de información para elegir la pregunta que mejor divide los candidatos |
| 🔍 **Tipos de preguntas** | Tipos, colores, animal inspirador, forma del cuerpo, silueta, patas, manos, alas… |
| 🚫 **Sin trampas** | No pregunta por número de Pokédex ni por peso exacto |
| ↩️ **Rechazar propuesta** | Si la máquina propone un Pokémon incorrecto, dile NO y continuará buscando |

### 📊 Historial y exportación

- 📜 Cada partida se guarda automáticamente en tu historial local
- 📋 **COPIAR JSON** para exportar tus sesiones
- 🗑️ **BORRAR** para limpiar el historial cuando quieras

### 🎮 Catálogos disponibles

| Catálogo | Pokémon | Descripción |
|:---------|:-------:|:------------|
| 🔴 **Kanto** | 151 | Los clásicos de la primera generación |
| 🌐 **Nacional** | 1.025 | ¡Toda la Pokédex conocida! |

---

## 🗺️ Generaciones disponibles

<p align="center">
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0025/Happy.png" width="40" alt="Pikachu" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0155/Happy.png" width="40" alt="Cyndaquil" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0252/Happy.png" width="40" alt="Treecko" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0387/Happy.png" width="40" alt="Turtwig" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0495/Happy.png" width="40" alt="Snivy" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0650/Happy.png" width="40" alt="Chespin" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0722/Happy.png" width="40" alt="Rowlet" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0810/Happy.png" width="40" alt="Grookey" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0906/Happy.png" width="40" alt="Sprigatito" />
</p>

Elige con qué Pokémon jugar en el modo Duelo:

| Gen | Región | Rango Dex | Pokémon |
|:---:|:------:|:---------:|:-------:|
| 🌐 | **Todas** | #001 – #1025 | 1.025 |
| 1️⃣ | **Kanto** | #001 – #151 | 151 |
| 2️⃣ | **Johto** | #152 – #251 | 100 |
| 3️⃣ | **Hoenn** | #252 – #386 | 135 |
| 4️⃣ | **Sinnoh** | #387 – #493 | 107 |
| 5️⃣ | **Unova** | #494 – #649 | 156 |
| 6️⃣ | **Kalos** | #650 – #721 | 72 |
| 7️⃣ | **Alola** | #722 – #809 | 88 |
| 8️⃣ | **Galar** | #810 – #905 | 96 |
| 9️⃣ | **Paldea** | #906 – #1025 | 120 |

> De los Pokémon de la generación elegida, se seleccionan **25 al azar** para formar el tablero de cada partida.

---

## 🎨 Interfaz y estética

<img align="right" src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0143/Happy.png" width="56" alt="Snorlax" />

PokéQuién está diseñado con una estética **pixel-art retro** inspirada en Pokémon Mystery Dungeon:

- 🖥️ **Fondo CRT** con scanlines horizontales y mapa pixel-art
- 🔤 **Tipografía arcade** `Press Start 2P` en toda la interfaz
- 🟡 **Colores clásicos**: amarillos, azules, naranjas sobre fondo oscuro
- 🖼️ **Marcos gruesos** con sombras y botones con relieve
- 😊→😢 Los retratos cambian de expresión al tachar (Happy → Sad)
- ✨ Animaciones suaves que se reducen si el dispositivo pide menos movimiento

---

## 🔊 Sonidos y sensaciones

| Acción | Feedback sonoro | Feedback háptico |
|:-------|:---------------|:-----------------|
| ◉ Elegir Pokémon | 🔊 Sonido de selección | 📳 Vibración suave |
| ✕ Tachar | 🔊 Confirmación corta | 📳 Vibración de aviso |
| ↺ Destachar | 🔊 Sonido de selección | 📳 Vibración suave |
| ⭐ Ganar | 🎵 Fanfarria de victoria | 📳 Vibración de éxito |
| ☁️ Perder | 🎵 Tono de derrota | 📳 Vibración de error |

> Los sonidos y vibraciones funcionan en móvil. En web se reproduce un tono sintetizado como respaldo.

---

## 📱 Compatibilidad

```
  📱 Móvil (Android / iOS)  ──────  💻 Web  ──────  📱 Tablet
          Cuadrícula 5×5 responsive · Retratos siempre visibles
```

La interfaz se adapta al tamaño de pantalla. Los retratos escalan automáticamente y el tablero mantiene un ancho máximo de 720 px para pantallas grandes.

---

## ❓ Preguntas frecuentes

<details>
<summary><b>¿Es gratis?</b></summary>
<br>
Sí. Es un proyecto de fans sin anuncios ni compras. La web está alojada en GitHub Pages y el servidor de salas en un plan gratuito.
</details>

<details>
<summary><b>¿Necesito crear una cuenta?</b></summary>
<br>
No. Para jugar un Duelo solo compartes un código de sala de 8 caracteres o el enlace que genera la app.
</details>

<details>
<summary><b>¿Funciona en el móvil?</b></summary>
<br>
Sí. La web se adapta a la pantalla del móvil y además existe una app para Android. Toda la interfaz está pensada primero para pantallas pequeñas y dedos (botones grandes).
</details>

<details>
<summary><b>¿Por qué tarda en conectar el Duelo?</b></summary>
<br>
El servidor gratuito «se duerme» cuando nadie juega. La primera conexión puede tardar hasta unos 45 segundos mientras despierta; después va fluido. Si falla, pulsa <b>REINTENTAR</b>.
</details>

<details>
<summary><b>¿Qué pasa si se corta la conexión?</b></summary>
<br>
Tienes 1 minuto para volver: la app intenta reconectarte sola a la misma sala. Si pasa ese tiempo, la partida termina por abandono.
</details>

<details>
<summary><b>¿Se guardan mis datos?</b></summary>
<br>
No hay cuentas ni datos personales. En un Duelo tu dispositivo guarda solo un código temporal para poder reconectarte. El historial del Solitario se queda en tu dispositivo y puedes borrarlo con el botón <b>BORRAR</b>.
</details>

<details>
<summary><b>¿Puedo jugar sin internet?</b></summary>
<br>
El Solitario no usa servidor, así que sigue funcionando con una conexión mala; eso sí, los retratos se descargan de internet y sin red puede que no se vean. El Duelo necesita conexión.
</details>

<details>
<summary><b>¿Es un juego oficial de Pokémon?</b></summary>
<br>
No. Es un fan project no oficial y sin ánimo de lucro. Pokémon y sus nombres son marcas de Nintendo, Game Freak y The Pokémon Company.
</details>

---

## 🌟 Créditos

<p align="center">
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0151/Happy.png" width="56" alt="Mew" />
</p>

Inspirado por **Checo_512** y su juego [Adivina Quién Pokémon](https://adivina-quien-pokemon.vercel.app/).

| Recurso | Fuente |
|:--------|:-------|
| 🖼️ Retratos pixel-art | [SpriteCollab (PMD)](https://github.com/PMDCollab/SpriteCollab) |
| 📊 Datos de Pokémon | [PokéAPI](https://pokeapi.co/) |
| 🔤 Tipografía | [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) |

---

<p align="center">
  <sub>
    Fan project no oficial, creado con cariño para la comunidad Pokémon 💛<br>
    Pokémon y todos los nombres relacionados son marcas registradas de Nintendo / Game Freak / The Pokémon Company.
  </sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0025/Happy.png" width="40" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0039/Happy.png" width="40" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0035/Happy.png" width="40" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0052/Happy.png" width="40" />
  <img src="https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0063/Happy.png" width="40" />
</p>

---

<p align="center">🛠️ ¿Quieres programar o desplegar PokéQuién? Mira <a href="docs/DESARROLLO.md">docs/DESARROLLO.md</a>.</p>
