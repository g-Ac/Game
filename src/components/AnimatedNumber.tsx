import { useEffect, useRef, useState } from 'react';
import { Animated, Text, type StyleProp, type TextStyle } from 'react-native';

interface Props {
  valor: number;
  prefixo?: string;
  style?: StyleProp<TextStyle>;
}

/** Número que "conta" animado do valor anterior até o novo (caixa, respeito, etc). */
export function AnimatedNumber({ valor, prefixo = '', style }: Props) {
  const anim = useRef(new Animated.Value(valor)).current;
  const [display, setDisplay] = useState(valor);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(anim, { toValue: valor, duration: 450, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [valor, anim]);

  return (
    <Text style={style}>
      {prefixo}
      {display}
    </Text>
  );
}
