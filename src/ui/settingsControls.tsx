// Controles comunes de la ventana de Ajustes (botones de acción y líneas de estadística), ≥ 44 px.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, PIXEL_FONT } from './theme';

export function ActionButton({
  label,
  onPress,
  disabled = false,
  danger = false,
  accessibilityLabel,
  variant = 'block',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
  /** block: ancho completo; row: comparte fila; stepper: botón cuadrado de − / +. */
  variant?: 'block' | 'row' | 'stepper';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        variant === 'row' && styles.actionInRow,
        variant === 'stepper' && styles.stepper,
        danger && styles.actionDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, variant === 'stepper' && styles.stepperText]}>{label}</Text>
    </Pressable>
  );
}

export function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statLine} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#30313C',
  },
  statLabel: { flex: 1, color: '#D4D4DA', fontSize: 13, lineHeight: 18 },
  statValue: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 15 },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#67686F',
    backgroundColor: '#25262F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInRow: { flexGrow: 1, flexBasis: 120 },
  stepper: { width: 56 },
  stepperText: { fontSize: 16, lineHeight: 20 },
  actionDanger: { borderColor: COLORS.orange, backgroundColor: '#3A1B0C' },
  actionText: { color: COLORS.white, fontFamily: PIXEL_FONT, fontSize: 8, lineHeight: 14, textAlign: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
