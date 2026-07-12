import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { cores, fontes } from '../theme/tokens';

interface Props {
  turno: number;
}

/** Banner "TURNO N" que dá um flash no centro da tela a cada virada de turno. */
export function TurnoBanner({ turno }: Props) {
  const op = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const primeiro = useRef(true);

  useEffect(() => {
    // Não anima no primeiro render (entrada na tela).
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    op.setValue(0);
    scale.setValue(0.8);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(480),
        Animated.timing(op, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno]);

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity: op }]}>
      <Animated.Text style={[styles.txt, { transform: [{ scale }] }]}>TURNO {turno}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontFamily: fontes.titulo,
    fontSize: 46,
    color: cores.gold1,
    textShadowColor: cores.gold2,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
});
