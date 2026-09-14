import type { PokemonCandidate } from './pokemon';

/**
 * Three short, player-facing facts for the local board. National entries use
 * the deterministic fallback below, so every candidate always has at least
 * three facts available when the victory panel is shown.
 */
export const CURATED_POKEMON_FACTS: Readonly<Record<number, readonly string[]>> = Object.freeze({
  1: ['Nace con una semilla plantada en el lomo.', 'La semilla crece junto a él durante toda su vida.', 'Su cuerpo almacena energía mientras duerme.'],
  2: ['La flor de su lomo se prepara para abrirse.', 'Necesita absorber luz solar para evolucionar.', 'Su aroma puede calmar a otros Pokémon.'],
  3: ['La flor gigante de su lomo absorbe energía solar.', 'Puede liberar un aroma que calma a otros Pokémon.', 'Tras evolucionar, la flor puede alcanzar un tamaño enorme.'],
  4: ['La llama de su cola refleja su estado vital.', 'Prefiere los lugares cálidos.', 'Si su llama se apaga, su vida corre peligro.'],
  5: ['Su llama se vuelve más intensa al emocionarse.', 'Es más agresivo que Charmander.', 'Usa sus garras y su cola ardiente para combatir.'],
  6: ['Sus alas le permiten surcar los cielos.', 'Expulsa llamas capaces de fundir grandes rocas.', 'Aunque es de tipo Fuego, no es un dragón en los juegos principales.'],
  7: ['Puede ocultarse dentro de su caparazón.', 'Lanza agua a presión desde su boca.', 'Su caparazón se forma poco después de nacer.'],
  8: ['Sus orejas y su cola le ayudan a nadar.', 'Se protege cerrando su caparazón.', 'La cola peluda se considera un símbolo de longevidad.'],
  9: ['Sus cañones de agua están integrados en el caparazón.', 'Puede disparar chorros muy potentes.', 'Su diseño está inspirado en una tortuga con cañones.'],
  10: ['Su antena libera un olor defensivo.', 'Come hojas de forma casi constante.', 'Sus colores le ayudan a camuflarse entre la vegetación.'],
  11: ['Su caparazón es muy duro.', 'Mientras evoluciona apenas puede moverse.', 'Su cuerpo se prepara dentro del capullo para la siguiente fase.'],
  12: ['Sus alas están cubiertas de escamas.', 'Es un gran recolector de néctar y polen.', 'Sus polvos pueden producir distintos efectos en combate.'],
  13: ['Su cuerno contiene veneno.', 'Las antenas le ayudan a orientarse.', 'Las púas de su cuerpo disuaden a los depredadores.'],
  14: ['Permanece casi inmóvil mientras cambia de forma.', 'Su caparazón se endurece durante la evolución.', 'Conserva parte de la seda creada cuando era Weedle.'],
  15: ['Sus aguijones de brazos y abdomen son venenosos.', 'Suele proteger su territorio en enjambre.', 'Sus alas le permiten desplazarse con gran rapidez.'],
  16: ['Es un Pokémon ave muy común en Kanto.', 'Tiene un sentido de la orientación excepcional.', 'Puede levantar polvo para desorientar a sus rivales.'],
  17: ['Defiende con firmeza su territorio.', 'Sus garras son más fuertes que las de Pidgey.', 'Sus alas le permiten recorrer largas distancias.'],
  18: ['Puede volar a gran altura.', 'Sus plumas tienen colores muy llamativos.', 'Su vista le permite localizar presas desde el cielo.'],
  19: ['Sus incisivos crecen continuamente.', 'Necesita roer objetos para desgastarlos.', 'Puede adaptarse a muchos entornos distintos.'],
  20: ['Sus patas palmeadas le permiten nadar.', 'Sus bigotes le ayudan a orientarse en el agua.', 'Sus incisivos son todavía más grandes que los de Rattata.'],
  21: ['Es ruidoso y de temperamento agresivo.', 'Puede recorrer grandes distancias volando.', 'Su pico afilado es una de sus principales armas.'],
  22: ['Tiene un pico y un cuello muy largos.', 'Su resistencia le permite volar durante mucho tiempo.', 'Puede elevarse con rapidez aprovechando las corrientes de aire.'],
  23: ['Se desplaza silenciosamente por la hierba.', 'Puede enrollarse alrededor de sus presas.', 'Su cuerpo se parece a una serpiente de cascabel.'],
  24: ['Su capucha muestra patrones intimidantes.', 'Usa su cuerpo para constreñir a sus rivales.', 'El patrón de su capucha cambia según su estado de ánimo.'],
  25: ['Almacena electricidad en las bolsas de sus mejillas.', 'Es el Pokémon más conocido de la franquicia.', 'Sus mejillas pueden descargar electricidad cuando se siente amenazado.'],
});

function fallbackFacts(candidate: Pick<PokemonCandidate, 'id' | 'name' | 'types' | 'weightKg'>): readonly string[] {
  return [
    `${candidate.name} ocupa el número ${candidate.id} de la Pokédex Nacional.`,
    `Su tipo es ${candidate.types.join(' y ').toLowerCase()}.`,
    `Su peso registrado es de ${candidate.weightKg.toLocaleString('es-ES')} kg.`,
  ];
}

export function getPokemonFacts(candidate: Pick<PokemonCandidate, 'id' | 'name' | 'types' | 'weightKg'>): readonly string[] {
  return CURATED_POKEMON_FACTS[candidate.id] ?? fallbackFacts(candidate);
}
