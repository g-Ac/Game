import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { cores } from '../theme/tokens';

interface Props {
  /** Contador que incrementa a cada combate — dispara o flash. */
  seq: number;
  cor: 'vitoria' | 'derrota' | null;
}

/** Flash de tela cheia (verde vitória / vermelho derrota) disparado a cada combate. */
export function FlashOverlay({ seq, cor }: Props) {
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (seq === 0 || !cor) return;
    op.setValue(0);
    Animated.sequence([
      Animated.timing(op, { toValue: 0.45, duration: 110, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  const bg = cor === 'vitoria' ? cores.money : cores.blood;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: op }]}
    />
  );
}
