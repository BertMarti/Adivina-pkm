// Pantalla de inicio: crear sala, unirse, Solitario y sala de prueba.
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GENERATIONS, GenerationId } from '../data/pokemon';
import { HowToPlay } from '../ui/HowToPlay';
import { CreditsLink } from '../ui/CreditsModal';
import { normalizeRoomCodeInput } from '../game/roomErrors';
import { Button, RetroPanelHeader } from '../ui/components';
import { styles } from '../ui/appStyles';

export function HomeScreen({
  generation,
  setGeneration,
  onCreate,
  onJoin,
  onDemo,
  onCopyInvite,
  onSolo,
  onRetry,
  inviteCode,
  joinCode,
  setJoinCode,
  loading,
  loadingLabel,
  error,
  offerSolo,
  progress,
  notice,
  retryAction,
  reduceMotion,
}: {
  generation: GenerationId;
  setGeneration: (generation: GenerationId) => void;
  onCreate: () => void;
  onJoin: () => void;
  onDemo: () => void;
  onCopyInvite: () => void;
  onSolo: () => void;
  onRetry: () => void;
  inviteCode: string;
  joinCode: string;
  setJoinCode: (value: string) => void;
  loading: boolean;
  loadingLabel: string;
  error: string;
  offerSolo: boolean;
  progress: string;
  notice: string;
  retryAction: 'create' | 'join' | null;
  reduceMotion: boolean;
}) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      float.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(float, { toValue: 0, duration: 1700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [float, reduceMotion]);
  const logoY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  return (
    <ScrollView
      stickyHeaderIndices={[0]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.homeStickyBar}>
        <Text style={styles.homeStickyTitle}>⚡ POKÉQUIÉN</Text>
        <Text style={styles.homeStickyStatus}>MENÚ PRINCIPAL</Text>
      </View>
      <View style={styles.hero}>
        <Animated.Text style={[styles.logo, { transform: [{ translateY: logoY }] }]} accessibilityRole="header">
          POKÉ{`\n`}QUIÉN
        </Animated.Text>
        <Text style={styles.heroSubtitle}>ADIVINA EL SECRETO · DUELO PIXEL</Text>
      </View>
      <HowToPlay />
      <View style={styles.panel}>
        <RetroPanelHeader title="CREAR PARTIDA" />
        <Text style={styles.fieldLabel}>Generación:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.generationRow}>
          {GENERATIONS.map((item) => (
            <Pressable
              key={String(item.id)}
              accessibilityRole="radio"
              accessibilityLabel={`Generación ${item.label}`}
              accessibilityState={{ selected: generation === item.id }}
              onPress={() => setGeneration(item.id)}
              style={[styles.generationChip, generation === item.id && styles.generationChipActive]}
            >
              <Text style={[styles.generationText, generation === item.id && styles.generationTextActive]}>
                {item.id === 'all' ? '🎲  Todas (Aleatorio)' : item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.codeLabel}>TU CÓDIGO DE SALA:</Text>
        <View style={styles.codeInput}>
          <Text selectable style={styles.roomCode}>
            {inviteCode}
          </Text>
        </View>
        <Button label="COPIAR ENLACE" onPress={onCopyInvite} variant="orange" disabled={loading} />
        <Button label={loading ? 'CARGANDO POKÉDEX…' : 'CREAR SALA'} onPress={onCreate} disabled={loading} />
        {!!notice && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        )}
        {loading && !!progress && retryAction !== 'join' && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {progress}
          </Text>
        )}
      </View>
      <View style={styles.panel}>
        <RetroPanelHeader title="UNIRSE A PARTIDA" />
        <Text style={styles.fieldLabel}>Introduce el código de tu rival:</Text>
        <TextInput
          accessibilityLabel="Código de sala"
          accessibilityHint="8 letras o números"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          onChangeText={(value) => setJoinCode(normalizeRoomCodeInput(value))}
          onSubmitEditing={onJoin}
          returnKeyType="go"
          placeholder="EJ. K7XQ2MPA"
          placeholderTextColor="#777986"
          style={styles.input}
          value={joinCode}
        />
        <Button
          label={loading ? loadingLabel || 'CONECTANDO…' : 'CONECTAR'}
          onPress={onJoin}
          variant="primary"
          disabled={loading}
        />
        {loading && !!progress && retryAction === 'join' && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {progress}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Jugar contra la máquina"
        onPress={onSolo}
        style={({ pressed }) => [styles.soloCta, pressed && styles.pressed]}
      >
        <Text style={styles.soloCtaKicker}>MODO SOLITARIO</Text>
        <Text style={styles.soloCtaTitle}>JUGAR CONTRA LA MÁQUINA</Text>
        <Text style={styles.soloCtaText}>Responde solo SÍ o NO y deja que la Pokédex te descubra.</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDemo} style={styles.demoLink}>
        <Text style={styles.demoLinkText}>▶ CREAR SALA DE PRUEBA KANTO</Text>
        <Text style={styles.muted}>Crea una sala rápida para abrirla en dos pestañas.</Text>
      </Pressable>
      {!!error && (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
            {error}
          </Text>
          <Button label="REINTENTAR" onPress={onRetry} variant="gray" disabled={loading} />
          {offerSolo && <Button label="JUGAR AL SOLITARIO" onPress={onSolo} variant="orange" />}
        </View>
      )}
      <CreditsLink />
    </ScrollView>
  );
}
