import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, PIXEL_FONT } from './theme';

// Clave con prefijo del proyecto: todas las webs de bertmarti.github.io comparten localStorage.
const GUIDE_SEEN_KEY = 'adivina-pkm:guia-vista';

const STEPS = [
  'Crea una sala y envía el enlace a un amigo. ¿Juegas solo? Pulsa JUGAR CONTRA LA MÁQUINA.',
  'Cada uno elige en secreto un Pokémon del mismo tablero de 25.',
  'Haceos preguntas de sí o no (en persona, por voz o por chat) y tachad los que no encajen. Gana quien deje solo el Pokémon del rival.',
];

/** Guía de la primera partida: desplegada en la primera visita, plegable y recordada en el dispositivo. */
export function HowToPlay() {
  // null = todavía no sabemos si ya la vio (evita un parpadeo al cargar).
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(GUIDE_SEEN_KEY)
      .then((value) => { if (active) setOpen(value !== '1'); })
      .catch(() => { if (active) setOpen(true); });
    return () => { active = false; };
  }, []);

  const close = () => {
    setOpen(false);
    AsyncStorage.setItem(GUIDE_SEEN_KEY, '1').catch(() => {});
  };

  if (open === null) return null;

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cómo se juega: ver la guía de 3 pasos"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.reopen, pressed && styles.pressed]}
      >
        <Text style={styles.reopenText}>❔ ¿CÓMO SE JUEGA?</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel} accessibilityLabel="Guía: cómo se juega en 3 pasos">
      <Text accessibilityRole="header" style={styles.title}>CÓMO SE JUEGA · 3 PASOS</Text>
      {STEPS.map((step, index) => (
        <View key={step} style={styles.step} accessible accessibilityLabel={`Paso ${index + 1}: ${step}`}>
          <Text style={styles.number}>{index + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Entendido, ocultar la guía"
        onPress={close}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>¡ENTENDIDO!</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(17, 22, 48, 0.95)',
    borderRadius: 18,
    padding: 15,
    gap: 12,
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  title: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 10, lineHeight: 18, textAlign: 'center' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  number: {
    color: COLORS.ink,
    backgroundColor: COLORS.yellow,
    fontFamily: PIXEL_FONT,
    fontSize: 14,
    lineHeight: 34,
    width: 34,
    height: 34,
    borderRadius: 6,
    textAlign: 'center',
    overflow: 'hidden',
  },
  stepText: { flex: 1, color: COLORS.white, fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: COLORS.yellow,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#FFE46B',
    borderBottomColor: '#A88600',
  },
  buttonText: { color: COLORS.ink, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 16 },
  reopen: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  reopenText: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 16, textDecorationLine: 'underline' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
