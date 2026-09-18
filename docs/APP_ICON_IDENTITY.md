# ⚡ Identidad del icono de PokéQuién

## Dirección visual

El icono anterior era un recorte de un retrato de Pikachu sobre una ilustración
de fondo. En un launcher móvil perdía legibilidad, tenía demasiado ruido visual
y no comunicaba el juego de deducción.

El nuevo emblema se ha dibujado como pixel-art propio sobre una cuadrícula de
128 píxeles y se escala con vecino más cercano:

```text
┌──────────────────┐
│                  │
│       ?          │
│                  │
│       ◓          │
└──────────────────┘
```

- ❔ **Pregunta amarilla:** representa directamente la deducción de “¿quién es
  quién?” y se reconoce incluso en 48 px.
- ◓ **Poké Ball como punto:** conecta la pregunta con el universo Pokémon sin
  añadir personajes, texto ni ruido visual.
- 🟦 **Marco azul noche:** mantiene la lectura pixelada y funciona tanto con
  máscara cuadrada como circular.

## Variantes generadas

| Archivo | Uso |
|---|---|
| `assets/icon.png` | Icono principal para iOS, Android y Expo. |
| `assets/android-icon-foreground.png` | Emblema transparente para adaptive icon. |
| `assets/android-icon-background.png` | Fondo azul noche del adaptive icon. |
| `assets/android-icon-monochrome.png` | Variante monocroma para Android. |
| `assets/favicon.png` | Favicon web. |
| `assets/splash-icon.png` | Marca de la pantalla de arranque. |
| `scripts/generate-app-icon.py` | Generador reproducible de todas las variantes. |

Android conserva su propia capa foreground/background para que el sistema
pueda aplicar máscara circular, cuadrada o squircle. iOS utiliza el icono
cuadrado y aplica su redondeo automáticamente.

## Criterios de calidad

- Sin texto: el nombre ya aparece debajo en el launcher.
- Contraste alto entre fondo, rojo, blanco y amarillo.
- Formas grandes, sin detalles que desaparezcan a 48 px.
- Bordes pixelados nítidos, sin interpolación borrosa.
- Zona segura central para evitar recortes de las máscaras adaptativas.
