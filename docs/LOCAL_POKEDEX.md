# 📚 Pokédex local

## Alcance

`src/data/pokemonNationalCatalog.ts` contiene las 1.025 entradas nacionales disponibles en PokéAPI en la fecha de generación. Kanto ya no es un recorte de 25: `LOCAL_KANTO_ROSTER` expone sus 151 Pokémon.

Cada entrada conserva:

- número y nombre;
- tipos en español;
- peso y marca de legendario;
- color dominante y silueta pública para las pistas visuales;
- tres datos cortos para el resultado;
- retratos `Happy`, `Normal` y `Sad` de SpriteCollab PMD;
- fallback de arte oficial de PokéAPI.

## Por qué es local

El tablero normal y el modo solitario no dependen de que PokéAPI responda durante la partida. La red solo es necesaria para descargar las imágenes remotas cuando el dispositivo todavía no las tiene en caché.

## Regenerar

Si PokéAPI incorpora nuevas especies o cambia el catálogo, desde la raíz del proyecto:

```text
node scripts/generate-local-pokemon-catalog.mjs
```

El script comprueba que recibe exactamente el número solicitado (`POKEMON_CATALOG_LIMIT`, 1.025 por defecto), ordena por Dex y genera el módulo TypeScript. No sobrescribe el catálogo con una respuesta incompleta.

## Preguntas nacionales

El motor combina los 18 tipos, rasgos especiales y pistas que una persona puede
contestar mirando el retrato: colores, animal de inspiración, manos, brazos,
patas, dos/cuatro patas, flotación, silueta, aspecto acuático, pelo, armadura,
calor, frío, mascota, ciudad y miedo nocturno. No existen preguntas de número
de Pokédex, rango nacional ni peso. Todas las respuestas son deterministas y
derivadas del registro local; la máquina no recibe ni consulta el Pokémon
elegido por el jugador.

El color procede del color dominante de especie de PokéAPI y la silueta de su
categoría de forma. Las categorías de animal son aproximaciones jugables (por
ejemplo, tipo Agua + silueta de pez se pregunta como animal acuático), no una
afirmación científica sobre el diseño.
