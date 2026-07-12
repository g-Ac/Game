import { StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fontes } from '../theme/tokens';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  label: string;
  valor: number;
  /** Prefixo mostrado antes do número (ex.: "$"). */
  prefixo?: string;
  cor?: string;
}

export function StatPill({ label, valor, prefixo, cor = cores.gold1 }: Props) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
      <AnimatedNumber valor={valor} prefixo={prefixo} style={[styles.valor, { color: cor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: cores.bgElev,
    borderWidth: 1,
    borderColor: cores.cardBorder,
    borderRadius: 3,
    paddingVertical: espaco.xs,
    paddingHorizontal: espaco.sm,
    alignItems: 'center',
    minWidth: 64,
  },
  label: {
    fontFamily: fontes.corpo,
    fontSize: 13,
    color: cores.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  valor: {
    fontFamily: fontes.corpo,
    fontSize: 20,
    lineHeight: 22,
  },
});
