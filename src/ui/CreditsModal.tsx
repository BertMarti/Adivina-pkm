import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS, PIXEL_FONT } from './theme';

type Credit = { title: string; text: string; url?: string; linkLabel?: string };

const CREDITS: Credit[] = [
  {
    title: 'PROYECTO DE FANS',
    text: 'Proyecto de fans no oficial y sin ánimo de lucro. Pokémon y sus personajes © Nintendo, Creatures Inc. y GAME FREAK inc.; marcas de Nintendo y The Pokémon Company. No está afiliado ni respaldado por ellos.',
  },
  {
    title: 'RETRATOS Y FONDO',
    text: 'Pixel-art de SpriteCollab (PMD Collab), licencia CC BY-NC 4.0: solo uso no comercial. La autoría de cada retrato está en su web.',
    url: 'https://sprites.pmdcollab.org/',
    linkLabel: 'sprites.pmdcollab.org',
  },
  { title: 'DATOS DE POKÉMON', text: 'PokéAPI.', url: 'https://pokeapi.co/', linkLabel: 'pokeapi.co' },
  {
    title: 'ANIMACIONES Y SONIDOS',
    text: 'Las animaciones de espera (Poké Ball y Pikachu) y los sonidos de selección, victoria y derrota son material de fans y de los juegos Pokémon, propiedad de sus autores. Se usan sin ánimo de lucro y se retirarán si lo piden sus titulares.',
  },
  { title: 'TIPOGRAFÍA', text: 'PokeQuien Pixel, derivada de Press Start 2P (CodeMan38) con las mayúsculas acentuadas redibujadas. SIL Open Font License 1.1.' },
  {
    title: 'IDEA',
    text: 'Inspirado en «Adivina Quién Pokémon» de Checo_512.',
    url: 'https://adivina-quien-pokemon.vercel.app/',
    linkLabel: 'adivina-quien-pokemon.vercel.app',
  },
  {
    title: 'CÓDIGO',
    text: 'Licencia MIT (BertMarti). La licencia cubre solo el código, no los recursos anteriores.',
    url: 'https://github.com/BertMarti/Adivina-pkm',
    linkLabel: 'github.com/BertMarti/Adivina-pkm',
  },
];

/** Enlace del pie que abre la ventana de créditos y licencias. */
export function CreditsLink() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Créditos y licencias. Proyecto fan no oficial"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
      >
        <Text style={styles.footerText}>CRÉDITOS Y LICENCIAS · PROYECTO FAN NO OFICIAL</Text>
      </Pressable>
      <CreditsModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

export function CreditsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>CRÉDITOS Y LICENCIAS</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {CREDITS.map((credit) => (
              <View key={credit.title} style={styles.item}>
                <Text style={styles.itemTitle}>{credit.title}</Text>
                <Text style={styles.itemText}>{credit.text}</Text>
                {credit.url && (
                  <Text
                    accessibilityRole="link"
                    onPress={() => { void Linking.openURL(credit.url!).catch(() => {}); }}
                    style={styles.link}
                  >
                    {credit.linkLabel ?? credit.url}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar créditos"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>CERRAR</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footerLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, marginTop: 4 },
  footerText: { color: '#C9C9D1', fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 15, textAlign: 'center', textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 4, 10, 0.86)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.yellow,
    padding: 16,
    gap: 12,
  },
  title: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  list: { gap: 14, paddingBottom: 4 },
  item: { gap: 4 },
  itemTitle: { color: COLORS.yellow, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 14 },
  itemText: { color: COLORS.white, fontSize: 13, lineHeight: 19 },
  // Relleno con margen negativo: zona táctil de 44 px sin mover el texto.
  link: {
    alignSelf: 'flex-start',
    color: '#9DB6FF',
    fontSize: 13,
    lineHeight: 22,
    paddingVertical: 11,
    marginVertical: -11,
    textDecorationLine: 'underline',
  },
  close: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#505158',
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#74757A',
    borderBottomColor: '#2E2F34',
  },
  closeText: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 16 },
  pressed: { opacity: 0.85 },
});
