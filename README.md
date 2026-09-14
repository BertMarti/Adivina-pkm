# 🎮 ADIVINA QUIÉN · POKÉMON

```text
        ✦  ✦  ✦  ✦  ✦
      ╔══════════════════╗
      ║   ADIVINA QUIÉN   ║
      ║     POKÉMON       ║
      ╚══════════════════╝
        ◓  VS  ◓
```

Un duelo de deducción pixel-art para descubrir el Pokémon secreto de tu rival antes de que él descubra el tuyo.

## 🏠 Entra, crea y comparte

La aventura empieza con una sala lista para compartir:

```text
┌────────────────────────────┐
│  CÓDIGO:  A1B2C3D4         │
│  [ COPIAR ENLACE ]         │
└────────────────────────────┘
```

Envía el enlace a tu amigo. Al abrirlo, entrará directamente en la misma sala.

## 🧩 Elige tu secreto

Cada jugador recibe una tabla de **25 Pokémon** en una cuadrícula perfecta de **5 × 5**.

```text
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

Toca una casilla para guardar tu Pokémon secreto. Si tu rival todavía está eligiendo, una Poké Ball te acompañará durante la espera.

## ⚔️ El duelo

Después de la elección aparecen los dos tableros:

```text
          TÚ       VS       RIVAL
       [ sprite ]          [  ?  ]

       MI TABLERO       TABLERO RIVAL
       25 retratos       25 retratos
```

Solo puedes modificar **tu tablero**:

- Pulsa un Pokémon para tacharlo con una **X roja**.
- Su retrato cambia a una expresión triste.
- Pulsa otra vez para destacharlo.
- El número Dex y el nombre te ayudan a reconocer cada casilla.

## 🏆 Cómo ganar

La partida termina cuando en tu tablero queda un único Pokémon libre y ese Pokémon es el secreto de tu rival.

```text
24 tachados  +  1 posible rival  =  ¡VICTORIA!
```

Al final descubrirás los dos secretos, escucharás el tono de victoria y verás una curiosidad del Pokémon descubierto. Después puedes pulsar **JUGAR DE NUEVO** para empezar otra ronda en la misma sala.

## 🤖 Modo solitario

También puedes jugar contra la máquina:

```text
        TÚ eliges un Pokémon
                 │
                 ▼
       ❓ ¿Es de tipo Agua?
          [ SÍ ]   [ NO ]
                 │
                 ▼
       ❓ ¿Vuela?  ¿Es legendario?
                 │
                 ▼
          ¡La máquina adivina!
```

Solo necesitas responder **SÍ** o **NO**. Tu elección permanece secreta: la máquina únicamente conoce tus respuestas.

## 🎨 Una aventura que se adapta

La interfaz está pensada para jugar cómodamente en:

```text
📱 móvil pequeño  ────────  📱 móvil grande  ────────  tablet
       cuadrícula 5 × 5 responsive y retratos siempre visibles
```

El fondo pixel-art, los marcos, las scanlines y la tipografía arcade mantienen el ambiente de exploración PMD. Las animaciones son suaves y se reducen si el dispositivo pide menos movimiento.

## 🔊 Feedback que se siente

◉ Elegir Pokémon · sonido de selección<br>
✕ Tachar · confirmación corta y háptica<br>
↺ Destachar · sonido de selección<br>
★ Ganar · tono de victoria una sola vez

## 🛟 Si tu rival se desconecta

La sala conserva la partida durante un minuto para que pueda volver. Si regresa a tiempo, recupera su tablero y continúa. Si no vuelve, la partida se cierra mostrando el abandono.

## 🌟 Créditos

Inspirado por **Checo_512** y su juego [Adivina Quién Pokémon](https://adivina-quien-pokemon.vercel.app/).<br>
Retratos de [SpriteCollab (PMD)](https://github.com/PMDCollab/SpriteCollab).<br>
Datos de [PokéAPI](https://pokeapi.co/).

> Fan project no oficial, creado con cariño para la comunidad.
