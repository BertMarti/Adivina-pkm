import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const total = Number(process.env.POKEMON_CATALOG_LIMIT ?? 1025);
const output = process.env.POKEMON_CATALOG_OUTPUT ?? 'src/data/pokemonNationalCatalog.ts';
const typeNames = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};
const colorNames = {
  black: 'negro', blue: 'azul', brown: 'marrón', gray: 'gris', green: 'verde',
  pink: 'rosa', purple: 'morado', red: 'rojo', white: 'blanco', yellow: 'amarillo',
};
const habitatNames = {
  cave: 'cueva', forest: 'bosque', grassland: 'pradera', mountain: 'montaña', rare: 'raro',
  'rough-terrain': 'terreno accidentado', sea: 'mar', urban: 'ciudad', 'waters-edge': 'orilla del agua',
};

function generationNumber(value) {
  const match = String(value ?? '').match(/generation-(i+|iv|v|vi|vii|viii|ix)$/i);
  if (!match) return undefined;
  const roman = match[1].toLowerCase();
  return ({ i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 })[roman];
}
const legendaryIds = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 638, 639, 640, 641, 642, 643, 644,
  645, 646, 647, 648, 649, 716, 717, 718, 785, 786, 787, 788, 791, 792, 800, 807, 808, 809, 888, 889, 890,
  891, 892, 894, 895, 896, 897, 898, 905, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010, 1014, 1015,
  1016, 1020, 1021, 1022, 1023, 1024, 1025,
]);

function titleCase(value) {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function urls(id) {
  const folder = String(id).padStart(4, '0');
  const portrait = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${folder}`;
  return {
    portraitUrl: `${portrait}/Happy.png`,
    normalUrl: `${portrait}/Normal.png`,
    sadUrl: `${portrait}/Sad.png`,
    fallbackUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
  };
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function main() {
  const list = await getJson(`https://pokeapi.co/api/v2/pokemon?limit=${total}&offset=0`);
  const entries = [];
  const concurrency = 24;
  for (let offset = 0; offset < list.results.length; offset += concurrency) {
    const batch = list.results.slice(offset, offset + concurrency);
    const details = await Promise.all(batch.map(async (item) => {
      const pokemon = await getJson(item.url);
      const species = await getJson(pokemon.species.url);
      return { pokemon, species };
    }));
    for (const { pokemon, species } of details) {
      const name = titleCase(pokemon.name);
      const types = pokemon.types.map(({ type }) => typeNames[type.name] ?? titleCase(type.name));
      const weightKg = pokemon.weight / 10;
      const facts = [
        `${name} ocupa el número ${pokemon.id} de la Pokédex Nacional.`,
        `Su combinación de tipos es ${types.join(' y ').toLowerCase()}.`,
        `Su peso registrado es de ${weightKg.toLocaleString('es-ES')} kg.`,
      ];
      entries.push({
        id: pokemon.id,
        name,
        types,
        color: colorNames[species.color?.name] ?? species.color?.name ?? 'desconocido',
        shape: species.shape?.name ?? 'desconocida',
        generation: generationNumber(species.generation?.name),
        habitat: habitatNames[species.habitat?.name] ?? species.habitat?.name ?? 'desconocido',
        stage: 0,
        stageKnown: false,
        legendary: legendaryIds.has(pokemon.id),
        weightKg,
        ...urls(pokemon.id),
        description: `${name} es un Pokémon de tipo ${types.join(' y ').toLowerCase()}.`,
        funFact: facts[0],
        facts,
      });
    }
    console.log(`Catálogo local: ${Math.min(offset + concurrency, list.results.length)}/${list.results.length}`);
  }
  entries.sort((left, right) => left.id - right.id);
  if (entries.length !== total) throw new Error(`Se esperaban ${total} Pokémon y se obtuvieron ${entries.length}.`);
  const content = `// Generated from PokéAPI on ${new Date().toISOString().slice(0, 10)}.\n// This file is intentionally local so the board and solo mode work without a runtime API dependency.\nimport type { PokemonCandidate } from './pokemon';\n\nexport const NATIONAL_POKEMON_CATALOG: readonly PokemonCandidate[] = ${JSON.stringify(entries, null, 2)};\n`;
  const target = join(process.cwd(), output);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, content, 'utf8');
  console.log(JSON.stringify({ output, count: entries.length }));
}

void main();
