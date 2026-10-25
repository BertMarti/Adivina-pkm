// Preferencia del sistema «reducir movimiento».
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduceMotion(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}
